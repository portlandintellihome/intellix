// Admin-only management of external integrations.
// The full `secret` value is returned exactly ONCE — when the admin creates
// or regenerates it via PATCH. The GET list only ever exposes the last 4
// characters so it can't be lifted from a screen share or browser cache.

import crypto from 'node:crypto'
import { Router } from 'express'

import { query } from '../db.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { handleProposalSync, handleContactSync } from './webhooks.js'

const router = Router()

function publicShape(row) {
  if (!row) return null
  const secret = row.secret || ''
  return {
    id: row.id,
    kind: row.kind,
    connected: Boolean(row.connected),
    secret_last4: secret ? secret.slice(-4) : null,
    secret_set: Boolean(secret),
    default_location_id: row.default_location_id,
    last_synced_at: row.last_synced_at,
    created_at: row.created_at,
  }
}

router.get('/', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM integrations ORDER BY kind ASC')
    res.json(rows.map(publicShape))
  } catch (err) { next(err) }
})

router.patch('/:kind', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const body = req.body || {}
    const existing = await query('SELECT * FROM integrations WHERE kind = $1', [req.params.kind])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' })

    const setClauses = []
    const params = []
    let newSecret = null

    if ('connected' in body) {
      params.push(Boolean(body.connected))
      setClauses.push(`connected = $${params.length}`)
    }
    if ('default_location_id' in body) {
      const v = body.default_location_id === '' || body.default_location_id == null
        ? null : Number(body.default_location_id) || null
      params.push(v)
      setClauses.push(`default_location_id = $${params.length}`)
    }
    if (body.regenerate_secret) {
      newSecret = crypto.randomBytes(24).toString('hex') // 48 hex chars
      params.push(newSecret)
      setClauses.push(`secret = $${params.length}`)
    }

    if (setClauses.length === 0) {
      return res.json({ ...publicShape(existing.rows[0]), full_secret: null })
    }

    params.push(req.params.kind)
    const { rows } = await query(
      `UPDATE integrations SET ${setClauses.join(', ')} WHERE kind = $${params.length} RETURNING *`,
      params,
    )

    // Return full secret exactly once when it was just regenerated.
    res.json({
      ...publicShape(rows[0]),
      full_secret: newSecret,
    })
  } catch (err) { next(err) }
})

// POST /api/integrations/:kind/test
// Fires a synthetic event through the actual receiver so admins can confirm
// the integration is wired correctly without touching Zapier. Uses a fixed
// portal_contact_id/portal_proposal_id so subsequent test runs reuse the
// same test client/proposal (UPDATE, no duplication).
router.post('/:kind/test', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (req.params.kind !== 'portal_io') {
      return res.status(400).json({ error: 'Test only implemented for portal_io' })
    }
    const r = await query('SELECT * FROM integrations WHERE kind = $1', [req.params.kind])
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    const integration = r.rows[0]

    const synthetic = {
      portal_proposal_id: 'INTELLIX_TEST_PROPOSAL',
      status: 'draft',
      name: 'Synthetic test proposal',
      value: 100,
      labor: 50,
      materials: 50,
      client: {
        portal_contact_id: 'INTELLIX_TEST_CONTACT',
        name: 'Intellix Test Contact',
        email: 'intellix-test@example.invalid',
        phone: null,
        address: null,
      },
    }

    const result = await handleProposalSync(synthetic, integration)
    res.json({
      ok: true,
      message: `Test proposal ${result.action}. Test client+proposal use the fixed ID "INTELLIX_TEST_PROPOSAL" — safe to delete from Clients/Proposals after verification.`,
      result,
    })
  } catch (err) {
    console.error('[integrations] test failed', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

export default router

// Public webhook receivers. NO requireAuth — these endpoints are called
// by external integrations (Zapier → Portal.io). Security is via the
// per-integration secret in the URL path, which is generated server-side
// and only ever delivered through the admin UI.

import { Router } from 'express'
import { query } from '../db.js'

const router = Router()

// --- helpers ----------------------------------------------------------------

async function loadIntegration(kind) {
  const r = await query('SELECT * FROM integrations WHERE kind = $1', [kind])
  return r.rows[0] || null
}

// Map Portal.io's lowercase status strings to our existing capitalized ones.
const STATUS_MAP = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Declined',
}
function mapStatus(portalStatus) {
  return STATUS_MAP[String(portalStatus || '').toLowerCase()] || 'Draft'
}

// Zapier's "Webhooks by Zapier → POST" sometimes ships dot-notation keys
// (e.g. `"client.name": "X"`) instead of nesting them, even with Unflatten
// turned on. Reshape the body before handler logic runs so both formats
// behave identically. Mutates `body` in place and returns it.
function unflattenClientKeys(body) {
  if (!body || typeof body !== 'object') return body
  if (body.client && typeof body.client === 'object') return body
  const prefix = 'client.'
  const nested = {}
  let found = false
  for (const key of Object.keys(body)) {
    if (key.startsWith(prefix)) {
      nested[key.slice(prefix.length)] = body[key]
      delete body[key]
      found = true
    }
  }
  if (found) body.client = nested
  return body
}

async function findOrCreateClient(client, defaultLocationId, queryFn) {
  const q = queryFn || query
  if (!client || typeof client !== 'object') {
    throw Object.assign(new Error('client object is required'), { status: 400 })
  }

  let row = null
  if (client.portal_contact_id) {
    const r = await q('SELECT * FROM clients WHERE portal_contact_id = $1 LIMIT 1',
      [client.portal_contact_id])
    row = r.rows[0] || null
  }
  if (!row && client.email) {
    const r = await q('SELECT * FROM clients WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [client.email])
    row = r.rows[0] || null
  }

  if (!row) {
    const ins = await q(
      `INSERT INTO clients (portal_contact_id, name, email, phone, address, location_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        client.portal_contact_id || null,
        client.name || '(unknown)',
        client.email || null,
        client.phone || null,
        client.address || null,
        defaultLocationId || null,
      ],
    )
    return { row: ins.rows[0], created: true }
  }

  // Patch the existing client with anything new from Portal (don't overwrite
  // populated fields with nulls).
  const updates = []
  const params = []
  const setIf = (col, val) => {
    if (val != null && val !== '' && val !== row[col]) {
      params.push(val); updates.push(`${col} = $${params.length}`)
    }
  }
  setIf('portal_contact_id', client.portal_contact_id)
  setIf('name', client.name)
  setIf('email', client.email)
  setIf('phone', client.phone)
  setIf('address', client.address)

  if (updates.length === 0) return { row, created: false }
  params.push(row.id)
  const upd = await q(
    `UPDATE clients SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  )
  return { row: upd.rows[0], created: false }
}

async function touchSync(kind, queryFn) {
  const q = queryFn || query
  await q('UPDATE integrations SET last_synced_at = NOW() WHERE kind = $1', [kind])
}

// --- proposal sync handler (extracted so the test endpoint can call it) ----

export async function handleProposalSync(body, integration, queryFn) {
  const q = queryFn || query
  unflattenClientKeys(body)
  const {
    portal_proposal_id,
    status,
    name,
    value,
    labor,
    materials,
    client,
  } = body || {}

  if (!portal_proposal_id) {
    throw Object.assign(new Error('portal_proposal_id is required'), { status: 400 })
  }
  if (!client) {
    throw Object.assign(new Error('client object is required'), { status: 400 })
  }

  const { row: clientRow } = await findOrCreateClient(client, integration.default_location_id, q)
  const mappedStatus = mapStatus(status)

  let action, proposalRow
  const existing = await q(
    'SELECT * FROM proposals WHERE portal_proposal_id = $1 LIMIT 1',
    [portal_proposal_id],
  )

  if (existing.rows.length === 0) {
    const ins = await q(
      `INSERT INTO proposals
         (portal_proposal_id, client_id, status, scope, labor, materials, total, location_id, portal_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        portal_proposal_id, clientRow.id, mappedStatus,
        name || null, labor ?? null, materials ?? null, value ?? null,
        clientRow.location_id, portal_proposal_id,
      ],
    )
    proposalRow = ins.rows[0]
    action = 'created'
  } else {
    const upd = await q(
      `UPDATE proposals SET
         status = $1, scope = $2,
         labor = COALESCE($3, labor),
         materials = COALESCE($4, materials),
         total = COALESCE($5, total),
         client_id = $6,
         location_id = COALESCE(location_id, $7)
       WHERE portal_proposal_id = $8
       RETURNING *`,
      [
        mappedStatus, name || null,
        labor ?? null, materials ?? null, value ?? null,
        clientRow.id, clientRow.location_id, portal_proposal_id,
      ],
    )
    proposalRow = upd.rows[0]
    action = 'updated'
  }

  // On 'Accepted', create a job linked to the proposal if one doesn't
  // already exist (deduped by jobs.proposal_id).
  let jobId = null
  if (mappedStatus === 'Accepted') {
    const existingJob = await q(
      'SELECT id FROM jobs WHERE proposal_id = $1 LIMIT 1',
      [proposalRow.id],
    )
    if (existingJob.rows.length > 0) {
      jobId = existingJob.rows[0].id
    } else {
      const jobIns = await q(
        `INSERT INTO jobs (name, client_id, address, status, priority, scope, location_id, proposal_id)
         VALUES ($1, $2, $3, 'scheduled', 'Normal', $4, $5, $6)
         RETURNING id`,
        [
          name || `Proposal ${portal_proposal_id}`,
          clientRow.id,
          clientRow.address || null,
          proposalRow.scope || null,
          proposalRow.location_id || clientRow.location_id,
          proposalRow.id,
        ],
      )
      jobId = jobIns.rows[0].id
    }
  }

  await touchSync(integration.kind, q)
  return { action, proposal_id: proposalRow.id, job_id: jobId, client_id: clientRow.id }
}

// --- contact sync handler ---------------------------------------------------

export async function handleContactSync(body, integration, queryFn) {
  const q = queryFn || query
  unflattenClientKeys(body)
  const { portal_contact_id, name, email, phone, address } = body || {}
  if (!portal_contact_id && !email) {
    throw Object.assign(
      new Error('portal_contact_id or email is required to identify the contact'),
      { status: 400 },
    )
  }
  const { row, created } = await findOrCreateClient(
    { portal_contact_id, name, email, phone, address },
    integration.default_location_id,
    q,
  )
  await touchSync(integration.kind, q)
  return { action: created ? 'created' : 'updated', client_id: row.id }
}

// --- routes -----------------------------------------------------------------

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res)
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message })
      next(err)
    }
  }
}

async function validatedIntegration(kind, secret) {
  const integration = await loadIntegration(kind)
  if (!integration || !integration.secret || integration.secret !== secret) {
    const err = new Error('Invalid webhook secret')
    err.status = 401
    throw err
  }
  if (!integration.connected) {
    // We still accept the request when not "connected" — admins use the
    // toggle to gate things, but we don't want to drop syncs because
    // someone forgot to flip the switch. Just log it.
    console.warn('[webhook]', kind, 'received while integration.connected=false')
  }
  return integration
}

router.post('/portal-io/proposal/:secret', asyncRoute(async (req, res) => {
  const integration = await validatedIntegration('portal_io', req.params.secret)
  console.log('[webhook] portal_io proposal', { portal_proposal_id: req.body?.portal_proposal_id, status: req.body?.status })
  const result = await handleProposalSync(req.body, integration)
  res.json(result)
}))

router.post('/portal-io/contact/:secret', asyncRoute(async (req, res) => {
  const integration = await validatedIntegration('portal_io', req.params.secret)
  console.log('[webhook] portal_io contact', { portal_contact_id: req.body?.portal_contact_id })
  const result = await handleContactSync(req.body, integration)
  res.json(result)
}))

export default router

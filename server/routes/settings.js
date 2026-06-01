import { Router } from 'express'
import { query } from '../db.js'
import { generateCheckinEmail } from '../services/aiProcessor.js'

const router = Router()

const DEFAULTS = {
  company_name: '',
  company_address: '',
  company_phone: '',
  company_email: '',
  company_logo_url: '',
  checkin_delay_days: 3,
  checkin_tone: 'warm',
  checkin_email_subject: "How's your IntelliHome system working?",
  checkin_email_body: '',
  email_notifications: true,
  in_app_notifications: true,
}

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM settings WHERE id = 1')
    if (rows.length === 0) return res.json({ ...DEFAULTS })
    res.json(rows[0])
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {}
    // Only accept known keys; ignore anything else.
    const delayParsed = Number(body.checkin_delay_days)
    const data = {
      company_name: typeof body.company_name === 'string' ? body.company_name : '',
      company_address: typeof body.company_address === 'string' ? body.company_address : '',
      company_phone: typeof body.company_phone === 'string' ? body.company_phone : '',
      company_email: typeof body.company_email === 'string' ? body.company_email : '',
      company_logo_url: typeof body.company_logo_url === 'string' ? body.company_logo_url : '',
      checkin_delay_days: Number.isFinite(delayParsed) && delayParsed >= 0 ? Math.floor(delayParsed) : 3,
      checkin_tone: body.checkin_tone === 'professional' ? 'professional' : 'warm',
      email_notifications: Boolean(body.email_notifications),
      in_app_notifications: Boolean(body.in_app_notifications),
    }

    // checkin_email_subject/body are DEPRECATED (AI-generated now) and no
    // longer accepted from the client; COALESCE preserves any existing values
    // as the fallback template without the UI being able to clear them.
    const { rows } = await query(
      `INSERT INTO settings (id, company_name, company_address, company_phone, company_email,
                             company_logo_url,
                             checkin_delay_days, checkin_tone,
                             email_notifications, in_app_notifications, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (id) DO UPDATE SET
         company_name = EXCLUDED.company_name,
         company_address = EXCLUDED.company_address,
         company_phone = EXCLUDED.company_phone,
         company_email = EXCLUDED.company_email,
         company_logo_url = EXCLUDED.company_logo_url,
         checkin_delay_days = EXCLUDED.checkin_delay_days,
         checkin_tone = EXCLUDED.checkin_tone,
         email_notifications = EXCLUDED.email_notifications,
         in_app_notifications = EXCLUDED.in_app_notifications,
         updated_at = NOW()
       RETURNING *`,
      [
        data.company_name, data.company_address, data.company_phone, data.company_email,
        data.company_logo_url,
        data.checkin_delay_days, data.checkin_tone,
        data.email_notifications, data.in_app_notifications,
      ]
    )
    res.json(rows[0])
  } catch (err) { next(err) }
})

// POST /api/settings/checkin-preview — generate a sample AI check-in email so
// the user can verify output before relying on it. Uses fixed sample data.
router.post('/checkin-preview', async (req, res, next) => {
  try {
    const tone = req.body?.tone === 'professional' ? 'professional' : 'warm'
    const gen = await generateCheckinEmail({
      client: { name: 'Jamie Reyes', address: '742 Evergreen Terrace, Portland OR' },
      job: {
        name: 'Living-room theater install',
        scope: 'Control4 EA-3 controller, Sonos Arc + sub, Lutron Caséta lighting (4 rooms), ' +
          'Araknis network, "Movie Night" and "Good Morning" scenes.',
      },
      location: {
        name: 'Portland',
        phone: '(503) 500-0180',
        email: 'info@intellihomeav.com',
        google_review_url: 'https://g.page/r/your-place-id/review',
      },
      days_since_install: 1,
      tone,
    })
    res.json(gen)
  } catch (err) {
    if (err.code === 'missing_key') return res.status(503).json({ error: 'AI is not configured (set ANTHROPIC_API_KEY).', code: err.code })
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code })
    next(err)
  }
})

export default router

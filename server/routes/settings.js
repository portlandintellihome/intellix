import { Router } from 'express'
import { query } from '../db.js'
import { generateCheckinEmail } from '../services/aiProcessor.js'

const router = Router()

// SMS template defaults mirror schema.sql so a first-time settings insert can't
// null them out if the client didn't send them.
const SMS_DEFAULTS = {
  sms_template_scheduled: "Hi {client_name}, this is {company}. Your service visit is scheduled. We'll see you then!",
  sms_template_on_the_way: 'Hi {client_name}, {employee_name} from {company} is on the way{eta}. See you soon!',
  sms_template_completed: 'Hi {client_name}, your service with {company} is complete. Thank you — reach out any time if you need anything.',
  sms_template_review: 'Hi {client_name}, thanks again for choosing {company}! If you were happy with our work, a quick review means a lot: {review_link}',
}

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
  sms_enabled: false,
  ...SMS_DEFAULTS,
  sms_quiet_hours_start: 21,
  sms_quiet_hours_end: 8,
  sms_review_delay_hours: 24,
  sms_timezone: 'America/Los_Angeles',
  default_hourly_rate: 0,
}

// Clamp an hour-of-day (0-23) with a fallback.
function hour(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 && n <= 23 ? Math.floor(n) : fallback
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
      // SMS config. Template strings preserve the current DB value when the
      // client omits them (falls back to defaults on first insert).
      sms_enabled: Boolean(body.sms_enabled),
      sms_template_scheduled: typeof body.sms_template_scheduled === 'string' ? body.sms_template_scheduled : SMS_DEFAULTS.sms_template_scheduled,
      sms_template_on_the_way: typeof body.sms_template_on_the_way === 'string' ? body.sms_template_on_the_way : SMS_DEFAULTS.sms_template_on_the_way,
      sms_template_completed: typeof body.sms_template_completed === 'string' ? body.sms_template_completed : SMS_DEFAULTS.sms_template_completed,
      sms_template_review: typeof body.sms_template_review === 'string' ? body.sms_template_review : SMS_DEFAULTS.sms_template_review,
      sms_quiet_hours_start: hour(body.sms_quiet_hours_start, 21),
      sms_quiet_hours_end: hour(body.sms_quiet_hours_end, 8),
      sms_review_delay_hours: Number.isFinite(Number(body.sms_review_delay_hours)) && Number(body.sms_review_delay_hours) >= 0 ? Math.floor(Number(body.sms_review_delay_hours)) : 24,
      sms_timezone: typeof body.sms_timezone === 'string' && body.sms_timezone.trim() ? body.sms_timezone.trim() : 'America/Los_Angeles',
      default_hourly_rate: Number.isFinite(Number(body.default_hourly_rate)) && Number(body.default_hourly_rate) >= 0 ? Number(body.default_hourly_rate) : 0,
    }

    // checkin_email_subject/body are DEPRECATED (AI-generated now) and no
    // longer accepted from the client; COALESCE preserves any existing values
    // as the fallback template without the UI being able to clear them.
    const { rows } = await query(
      `INSERT INTO settings (id, company_name, company_address, company_phone, company_email,
                             company_logo_url,
                             checkin_delay_days, checkin_tone,
                             email_notifications, in_app_notifications,
                             sms_enabled, sms_template_scheduled, sms_template_on_the_way,
                             sms_template_completed, sms_template_review,
                             sms_quiet_hours_start, sms_quiet_hours_end,
                             sms_review_delay_hours, sms_timezone, default_hourly_rate, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9,
               $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
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
         sms_enabled = EXCLUDED.sms_enabled,
         sms_template_scheduled = EXCLUDED.sms_template_scheduled,
         sms_template_on_the_way = EXCLUDED.sms_template_on_the_way,
         sms_template_completed = EXCLUDED.sms_template_completed,
         sms_template_review = EXCLUDED.sms_template_review,
         sms_quiet_hours_start = EXCLUDED.sms_quiet_hours_start,
         sms_quiet_hours_end = EXCLUDED.sms_quiet_hours_end,
         sms_review_delay_hours = EXCLUDED.sms_review_delay_hours,
         sms_timezone = EXCLUDED.sms_timezone,
         default_hourly_rate = EXCLUDED.default_hourly_rate,
         updated_at = NOW()
       RETURNING *`,
      [
        data.company_name, data.company_address, data.company_phone, data.company_email,
        data.company_logo_url,
        data.checkin_delay_days, data.checkin_tone,
        data.email_notifications, data.in_app_notifications,
        data.sms_enabled, data.sms_template_scheduled, data.sms_template_on_the_way,
        data.sms_template_completed, data.sms_template_review,
        data.sms_quiet_hours_start, data.sms_quiet_hours_end,
        data.sms_review_delay_hours, data.sms_timezone, data.default_hourly_rate,
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

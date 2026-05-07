import { Router } from 'express'
import { query } from '../db.js'

const router = Router()

const DEFAULTS = {
  company_name: '',
  company_address: '',
  company_phone: '',
  company_email: '',
  company_logo_url: '',
  google_review_link: '',
  google_review_url: '',
  checkin_delay_days: 3,
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
      google_review_link: typeof body.google_review_link === 'string' ? body.google_review_link : '',
      google_review_url: typeof body.google_review_url === 'string' ? body.google_review_url : '',
      checkin_delay_days: Number.isFinite(delayParsed) && delayParsed >= 0 ? Math.floor(delayParsed) : 3,
      checkin_email_subject: typeof body.checkin_email_subject === 'string' ? body.checkin_email_subject : '',
      checkin_email_body: typeof body.checkin_email_body === 'string' ? body.checkin_email_body : '',
      email_notifications: Boolean(body.email_notifications),
      in_app_notifications: Boolean(body.in_app_notifications),
    }

    const { rows } = await query(
      `INSERT INTO settings (id, company_name, company_address, company_phone, company_email,
                             company_logo_url, google_review_link, google_review_url,
                             checkin_delay_days, checkin_email_subject, checkin_email_body,
                             email_notifications, in_app_notifications, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (id) DO UPDATE SET
         company_name = EXCLUDED.company_name,
         company_address = EXCLUDED.company_address,
         company_phone = EXCLUDED.company_phone,
         company_email = EXCLUDED.company_email,
         company_logo_url = EXCLUDED.company_logo_url,
         google_review_link = EXCLUDED.google_review_link,
         google_review_url = EXCLUDED.google_review_url,
         checkin_delay_days = EXCLUDED.checkin_delay_days,
         checkin_email_subject = EXCLUDED.checkin_email_subject,
         checkin_email_body = EXCLUDED.checkin_email_body,
         email_notifications = EXCLUDED.email_notifications,
         in_app_notifications = EXCLUDED.in_app_notifications,
         updated_at = NOW()
       RETURNING *`,
      [
        data.company_name, data.company_address, data.company_phone, data.company_email,
        data.company_logo_url, data.google_review_link, data.google_review_url,
        data.checkin_delay_days, data.checkin_email_subject, data.checkin_email_body,
        data.email_notifications, data.in_app_notifications,
      ]
    )
    res.json(rows[0])
  } catch (err) { next(err) }
})

export default router

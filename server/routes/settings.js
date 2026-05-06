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
    const data = {
      company_name: typeof body.company_name === 'string' ? body.company_name : '',
      company_address: typeof body.company_address === 'string' ? body.company_address : '',
      company_phone: typeof body.company_phone === 'string' ? body.company_phone : '',
      company_email: typeof body.company_email === 'string' ? body.company_email : '',
      company_logo_url: typeof body.company_logo_url === 'string' ? body.company_logo_url : '',
      google_review_link: typeof body.google_review_link === 'string' ? body.google_review_link : '',
      email_notifications: Boolean(body.email_notifications),
      in_app_notifications: Boolean(body.in_app_notifications),
    }

    const { rows } = await query(
      `INSERT INTO settings (id, company_name, company_address, company_phone, company_email,
                             company_logo_url, google_review_link, email_notifications,
                             in_app_notifications, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET
         company_name = EXCLUDED.company_name,
         company_address = EXCLUDED.company_address,
         company_phone = EXCLUDED.company_phone,
         company_email = EXCLUDED.company_email,
         company_logo_url = EXCLUDED.company_logo_url,
         google_review_link = EXCLUDED.google_review_link,
         email_notifications = EXCLUDED.email_notifications,
         in_app_notifications = EXCLUDED.in_app_notifications,
         updated_at = NOW()
       RETURNING *`,
      [
        data.company_name, data.company_address, data.company_phone, data.company_email,
        data.company_logo_url, data.google_review_link,
        data.email_notifications, data.in_app_notifications,
      ]
    )
    res.json(rows[0])
  } catch (err) { next(err) }
})

export default router

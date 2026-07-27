// Client SMS system (Twilio). Net-new outbound transport — the check-in
// system only ever prepared email for an external runner (see routes/checkins.js);
// this is the first code path that actually sends.
//
// Design mirrors the existing pull-based model: nothing is sent by an
// in-process timer. Messages are written to the sms_messages outbox with a
// send_after gate (immediate for scheduled/on-the-way/completed, +24h for the
// review request, or bumped to the next allowed window when quiet hours apply).
// An external cron flushes the queue via GET /api/sms/process-due. Immediate
// messages are also processed synchronously at enqueue time so they go out at
// once when outside quiet hours.
//
// Env (read at call time, never hardcoded; absent → we degrade gracefully and
// leave messages queued rather than throwing):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function smsEnv() {
  return {
    sid: (process.env.TWILIO_ACCOUNT_SID || '').trim(),
    token: (process.env.TWILIO_AUTH_TOKEN || '').trim(),
    from: (process.env.TWILIO_FROM_NUMBER || '').trim(),
  }
}

export function isSmsConfigured() {
  const { sid, token, from } = smsEnv()
  return Boolean(sid && token && from)
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

// Coerce a raw phone (possibly scientific-notation float, formatted, or blank)
// to E.164. US-centric: a clean 10-digit number gets +1; an 11-digit starting
// with 1 gets +. Anything already starting with + is kept. Returns null when
// there aren't enough digits to be a real number.
export function normalizePhone(raw) {
  if (raw == null) return null
  let s = String(raw).trim()
  if (!s) return null
  // Expand scientific notation (e.g. "3.104098e+09") to a plain integer string.
  if (/e\+?\d+/i.test(s) && !isNaN(Number(s))) {
    s = Number(s).toFixed(0)
  }
  const hasPlus = s.trim().startsWith('+')
  const digits = s.replace(/\D/g, '')
  if (!digits) return null
  if (hasPlus) return '+' + digits
  if (digits.length === 10) return '+1' + digits
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits
  if (digits.length < 7) return null // too short to be a real number
  return '+' + digits
}

const MERGE_KEYS = ['client_name', 'employee_name', 'company', 'eta', 'review_link']

// Replace {field} tokens. Unknown/blank merge fields render as '' so a customer
// never receives a literal "{employee_name}". `eta` is expected pre-formatted
// by the caller (e.g. " (ETA 3:30 PM)") so the surrounding template reads well.
export function renderTemplate(tpl, values = {}) {
  if (!tpl) return ''
  return String(tpl).replace(/\{(\w+)\}/g, (_, key) => {
    if (MERGE_KEYS.includes(key)) return values[key] != null ? String(values[key]) : ''
    return values[key] != null ? String(values[key]) : ''
  }).replace(/\s{2,}/g, ' ').trim()
}

// Local hour (0-23) in the given IANA timezone.
function localHour(date, tz) {
  try {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'America/Los_Angeles', hour: 'numeric', hour12: false }).format(date)
    let h = parseInt(s, 10)
    if (!Number.isFinite(h)) return date.getHours()
    if (h === 24) h = 0
    return h
  } catch {
    return date.getHours()
  }
}

// Is `date` inside the nightly quiet window [start, end)? Handles the normal
// overnight case (start=21, end=8) and same-day windows. start===end → no quiet.
export function isWithinQuietHours(date, { start = 21, end = 8, timezone } = {}) {
  const s = Number(start), e = Number(end)
  if (!Number.isFinite(s) || !Number.isFinite(e) || s === e) return false
  const h = localHour(date, timezone)
  return s < e ? (h >= s && h < e) : (h >= s || h < e)
}

// First instant at/after `date` that is NOT in quiet hours. Steps hour-by-hour
// (cheap, bounded) — good enough to defer completion/review texts to morning.
export function nextAllowedSendTime(date, opts = {}) {
  if (!isWithinQuietHours(date, opts)) return date
  let d = new Date(date)
  for (let i = 0; i < 48; i++) {
    d = new Date(d.getTime() + 3600 * 1000)
    if (!isWithinQuietHours(d, opts)) return d
  }
  return d
}

// ---------------------------------------------------------------------------
// Twilio transport (REST via fetch — no SDK dependency)
// ---------------------------------------------------------------------------

export async function sendViaTwilio({ to, body }) {
  const { sid, token, from } = smsEnv()
  if (!sid || !token || !from) {
    const err = new Error('SMS is not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)')
    err.code = 'sms_unconfigured'
    throw err
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`
  const form = new URLSearchParams({ To: to, From: from, Body: body })
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.message || `Twilio error ${res.status}`)
    err.code = 'twilio_error'
    err.status = res.status
    err.twilioCode = data?.code
    throw err
  }
  return { sid: data.sid, status: data.status }
}

// ---------------------------------------------------------------------------
// DB orchestration (query is injectable for tests, like makeRouter in jobs.js)
// ---------------------------------------------------------------------------

const TEMPLATE_COLUMN = {
  scheduled: 'sms_template_scheduled',
  on_the_way: 'sms_template_on_the_way',
  completed: 'sms_template_completed',
  review: 'sms_template_review',
}
const QUIET_HOURS_KEYS = new Set(['completed', 'review'])

async function loadSettings(query) {
  const { rows } = await query('SELECT * FROM settings WHERE id = 1')
  return rows[0] || {}
}

// Assemble the merge-field context for a job's client. Returns null if the job
// or its client can't be found.
export async function buildJobContext(query, jobId) {
  const { rows } = await query(
    `SELECT j.id AS job_id, j.location_id,
            c.id AS client_id, c.name AS client_name, c.phone AS client_phone,
            COALESCE(c.sms_opt_out, FALSE) AS sms_opt_out,
            loc.google_review_url
       FROM jobs j
       JOIN clients c ON c.id = j.client_id
       LEFT JOIN locations loc ON loc.id = j.location_id
      WHERE j.id = $1`,
    [jobId],
  )
  return rows[0] || null
}

function firstName(full) {
  if (!full) return 'there'
  return String(full).trim().split(/\s+/)[0] || 'there'
}

// Insert one outbox row. Renders the body from the settings template for
// template_key. Opt-out and missing-phone are recorded as 'skipped' audit rows
// (never sent) so the client's SMS history is complete. Returns the inserted row.
export async function enqueueMessage(query, {
  client_id, job_id = null, template_key, values = {}, sendAfter = null,
  settings = null, clientPhone = null, optedOut = false,
}) {
  const s = settings || await loadSettings(query)
  const tpl = s[TEMPLATE_COLUMN[template_key]] || ''
  const mergeValues = {
    client_name: firstName(values.client_name),
    employee_name: values.employee_name || '',
    company: values.company || s.company_name || 'us',
    eta: values.eta || '',
    review_link: values.review_link || '',
  }
  const body = renderTemplate(tpl, mergeValues)
  const to = normalizePhone(clientPhone)

  let status = 'queued'
  let error = null
  if (optedOut) { status = 'skipped'; error = 'client opted out of SMS' }
  else if (!to) { status = 'skipped'; error = 'no valid phone number' }

  const { rows } = await query(
    `INSERT INTO sms_messages (client_id, job_id, template_key, to_number, body, status, error, send_after)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()))
     RETURNING *`,
    [client_id, job_id, template_key, to, body, status, error, sendAfter],
  )
  return rows[0]
}

// Attempt to send one queued message by id. Idempotent: no-ops unless the row
// is still 'queued'. Re-checks opt-out at send time (critical: a client may
// have texted STOP after the review was enqueued). Defers completion/review
// texts that land in quiet hours by bumping send_after. Leaves the row queued
// (with an error note) when Twilio isn't configured, so it sends once it is.
export async function processMessage(query, id, { now = new Date(), settings = null } = {}) {
  const { rows } = await query('SELECT * FROM sms_messages WHERE id = $1', [id])
  const msg = rows[0]
  if (!msg || msg.status !== 'queued') return msg || null

  // Live opt-out re-check.
  const cr = await query('SELECT COALESCE(sms_opt_out, FALSE) AS opt_out FROM clients WHERE id = $1', [msg.client_id])
  if (cr.rows[0]?.opt_out) {
    const u = await query(
      `UPDATE sms_messages SET status = 'canceled', error = 'client opted out of SMS' WHERE id = $1 RETURNING *`, [id])
    return u.rows[0]
  }

  const s = settings || await loadSettings(query)
  // Quiet-hours deferral for completion/review only.
  if (QUIET_HOURS_KEYS.has(msg.template_key)) {
    const quietOpts = { start: s.sms_quiet_hours_start, end: s.sms_quiet_hours_end, timezone: s.sms_timezone }
    if (isWithinQuietHours(now, quietOpts)) {
      const next = nextAllowedSendTime(now, quietOpts)
      const u = await query(
        `UPDATE sms_messages SET send_after = $2 WHERE id = $1 RETURNING *`, [id, next])
      return u.rows[0]
    }
  }

  if (!msg.to_number) {
    const u = await query(
      `UPDATE sms_messages SET status = 'skipped', error = 'no valid phone number' WHERE id = $1 RETURNING *`, [id])
    return u.rows[0]
  }

  if (!isSmsConfigured()) {
    // Leave queued so a later (configured) run can pick it up; record why.
    const u = await query(
      `UPDATE sms_messages SET error = 'SMS not configured (Twilio env unset)' WHERE id = $1 RETURNING *`, [id])
    return u.rows[0]
  }

  try {
    const r = await sendViaTwilio({ to: msg.to_number, body: msg.body })
    const u = await query(
      `UPDATE sms_messages SET status = 'sent', twilio_sid = $2, sent_at = NOW(), error = NULL WHERE id = $1 RETURNING *`,
      [id, r.sid || null])
    return u.rows[0]
  } catch (err) {
    const u = await query(
      `UPDATE sms_messages SET status = 'failed', error = $2 WHERE id = $1 RETURNING *`,
      [id, String(err.message || 'send failed').slice(0, 500)])
    return u.rows[0]
  }
}

// Flush every message that is now due. Called by the external cron via
// GET /api/sms/process-due. Returns a summary for the response/logs.
export async function processDue(query, { now = new Date(), limit = 200 } = {}) {
  const { rows } = await query(
    `SELECT id FROM sms_messages WHERE status = 'queued' AND send_after <= $1 ORDER BY send_after ASC LIMIT $2`,
    [now, limit],
  )
  const settings = await loadSettings(query)
  const summary = { processed: 0, sent: 0, failed: 0, skipped: 0, deferred: 0, canceled: 0, queued: 0 }
  for (const { id } of rows) {
    const r = await processMessage(query, id, { now, settings })
    summary.processed++
    const st = r?.status
    if (st === 'sent') summary.sent++
    else if (st === 'failed') summary.failed++
    else if (st === 'skipped') summary.skipped++
    else if (st === 'canceled') summary.canceled++
    else if (st === 'queued') { r && new Date(r.send_after) > now ? summary.deferred++ : summary.queued++ }
  }
  return summary
}

// --- Trigger helpers (called from routes) ----------------------------------

// Enqueue + (for immediate ones) attempt to send now. All swallow "job/client
// not found" gracefully so a trigger never breaks the primary action.
async function triggerImmediate(query, jobId, template_key, extraValues = {}) {
  const ctx = await buildJobContext(query, jobId)
  if (!ctx) return null
  const settings = await loadSettings(query)
  const msg = await enqueueMessage(query, {
    client_id: ctx.client_id, job_id: ctx.job_id, template_key,
    values: { client_name: ctx.client_name, ...extraValues },
    clientPhone: ctx.client_phone, optedOut: ctx.sms_opt_out, settings,
  })
  if (msg.status === 'queued') return processMessage(query, msg.id, { settings })
  return msg
}

export function onJobScheduled(query, jobId) {
  return triggerImmediate(query, jobId, 'scheduled')
}

export function onJobOnTheWay(query, jobId, { employee_name = '', eta = '' } = {}) {
  const etaVal = eta ? ` (ETA ${String(eta).trim()})` : ''
  return triggerImmediate(query, jobId, 'on_the_way', { employee_name, eta: etaVal })
}

// Completion fires TWO messages: the completed text now (quiet-hours aware) and
// the review request delayed by sms_review_delay_hours — scheduled by this
// event, never sent back-to-back with the completed text.
export async function onJobCompleted(query, jobId) {
  const ctx = await buildJobContext(query, jobId)
  if (!ctx) return null
  const settings = await loadSettings(query)

  // 1) Completed — immediate (processMessage defers it if within quiet hours).
  const completed = await enqueueMessage(query, {
    client_id: ctx.client_id, job_id: ctx.job_id, template_key: 'completed',
    values: { client_name: ctx.client_name }, clientPhone: ctx.client_phone,
    optedOut: ctx.sms_opt_out, settings,
  })
  if (completed.status === 'queued') await processMessage(query, completed.id, { settings })

  // 2) Review — delayed. Only enqueue if there's a review link to send.
  const delayHours = Number.isFinite(Number(settings.sms_review_delay_hours))
    ? Number(settings.sms_review_delay_hours) : 24
  const sendAfter = new Date(Date.now() + delayHours * 3600 * 1000)
  const review = await enqueueMessage(query, {
    client_id: ctx.client_id, job_id: ctx.job_id, template_key: 'review',
    values: { client_name: ctx.client_name, review_link: ctx.google_review_url || '' },
    clientPhone: ctx.client_phone, optedOut: ctx.sms_opt_out, settings, sendAfter,
  })
  return { completed, review }
}

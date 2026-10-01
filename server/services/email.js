// Global kill switch for outbound CLIENT email, mirroring SMS_ENABLED in
// services/sms.js. FAIL-CLOSED: client email is OFF unless EMAIL_ENABLED is
// exactly "true". A missing, empty, or malformed value keeps it disabled, so
// losing the env var can never silently start emailing clients.
//
// Scope: client-facing email only. Intellix never sends email itself; the
// only client email path is GET /api/checkins/due, which hands composed
// check-in / review-request emails to the external n8n runner to send. When
// this is off that endpoint returns an empty batch, so there is nothing for
// the runner to send. Internal/staff email is unaffected (the password-reset
// email in routes/auth.js is console-only and never sent).
export function isEmailEnabled() {
  return String(process.env.EMAIL_ENABLED || '').trim().toLowerCase() === 'true'
}

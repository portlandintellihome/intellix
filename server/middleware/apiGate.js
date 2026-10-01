// Deny-by-default gate for every /api route. Mounted in index.js ahead of all
// routers, so a route is protected unless it is listed here. That way a route
// added later is safe even if it forgets its own requireAuth.
//
// Public routes are matched on method + exact path shape (relative to /api,
// trailing slash ignored). They are public for a reason and protect
// themselves where needed:
//   - health check (Railway)
//   - login / forgot / reset password (used before there is a session)
//   - inbound webhooks, authenticated by the secret in the URL
//   - n8n / cron endpoints, authenticated by X-Internal-Key in their routers
//   - on/off status endpoints that return booleans only
// Everything else requires a valid JWT (requireAuth sets req.user).

import { requireAuth } from './auth.js'

const PUBLIC_API_ROUTES = [
  ['GET', /^\/health$/],

  ['POST', /^\/auth\/login$/],
  ['POST', /^\/auth\/forgot-password$/],
  ['POST', /^\/auth\/reset-password$/],

  ['POST', /^\/webhooks\/twilio\/inbound\/[^/]+$/],
  ['POST', /^\/webhooks\/portal-io\/proposal\/[^/]+$/],
  ['POST', /^\/webhooks\/portal-io\/contact\/[^/]+$/],

  ['GET', /^\/checkins\/due$/],
  ['POST', /^\/checkins\/[^/]+\/sent$/],
  ['GET', /^\/sms\/process-due$/],
  ['POST', /^\/sms\/process-due$/],

  ['GET', /^\/sms\/status$/],
  ['GET', /^\/checkins\/status$/],
  ['GET', /^\/ai\/status$/],
  ['GET', /^\/assist\/status$/],
]

// `path` is relative to the /api mount (e.g. "/clients/3").
export function isPublicApiRoute(method, path) {
  const p = path.length > 1 ? path.replace(/\/+$/, '') : path
  return PUBLIC_API_ROUTES.some(([m, re]) => m === method && re.test(p))
}

export function apiGate(req, res, next) {
  // CORS preflights carry no credentials; cors() answers them before this runs.
  if (req.method === 'OPTIONS') return next()
  if (isPublicApiRoute(req.method, req.path)) return next()
  return requireAuth(req, res, next)
}

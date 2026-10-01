// The deny-by-default /api gate: public routes stay reachable without a token,
// every data route returns 401 without a valid JWT, and a valid JWT passes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'

import { apiGate, isPublicApiRoute } from './apiGate.js'
import { JWT_SECRET } from './auth.js'

// Data routes that were reachable without a login before the gate existed.
const PROTECTED = [
  ['GET', '/clients'], ['GET', '/clients/1'], ['PATCH', '/clients/1'],
  ['GET', '/clients/1/jobs'], ['GET', '/clients/1/sms'],
  ['PATCH', '/clients/1/homedoc'], ['PATCH', '/clients/1/plan'],
  ['GET', '/jobs'], ['GET', '/jobs/1'], ['POST', '/jobs'], ['PATCH', '/jobs/1'],
  ['GET', '/proposals'], ['GET', '/proposals/1'], ['POST', '/proposals'], ['PATCH', '/proposals/1'],
  ['GET', '/settings'], ['POST', '/settings'], ['POST', '/settings/checkin-preview'],
  ['GET', '/check-ins'], ['POST', '/check-ins'],
  ['GET', '/team'], ['GET', '/team/1'],
  ['GET', '/reporting'],
  ['GET', '/composer-builds'], ['GET', '/composer-builds/1'],
  ['GET', '/drivers'], ['GET', '/drivers/1'],
  ['GET', '/inventory'], ['GET', '/inventory/1'],
  // Unknown / future routes are denied too.
  ['GET', '/racks'], ['GET', '/does-not-exist'],
]

const PUBLIC = [
  ['GET', '/health'],
  ['POST', '/auth/login'], ['POST', '/auth/forgot-password'], ['POST', '/auth/reset-password'],
  ['POST', '/webhooks/twilio/inbound/abc123'],
  ['POST', '/webhooks/portal-io/proposal/abc123'],
  ['POST', '/webhooks/portal-io/contact/abc123'],
  ['GET', '/checkins/due'], ['POST', '/checkins/42/sent'],
  ['GET', '/sms/process-due'], ['POST', '/sms/process-due'],
  ['GET', '/sms/status'], ['GET', '/checkins/status'], ['GET', '/ai/status'], ['GET', '/assist/status'],
]

test('allowlist: public routes are public, data routes are not', () => {
  for (const [m, p] of PUBLIC) assert.equal(isPublicApiRoute(m, p), true, `${m} ${p} should be public`)
  for (const [m, p] of PROTECTED) assert.equal(isPublicApiRoute(m, p), false, `${m} ${p} must require auth`)
})

test('allowlist matches method + exact shape, not prefixes', () => {
  assert.equal(isPublicApiRoute('GET', '/auth/login'), false, 'login is POST only')
  assert.equal(isPublicApiRoute('POST', '/sms/status'), false)
  assert.equal(isPublicApiRoute('GET', '/auth/me'), false)
  assert.equal(isPublicApiRoute('POST', '/auth/register'), false)
  assert.equal(isPublicApiRoute('POST', '/webhooks/twilio/inbound'), false, 'secret segment required')
  assert.equal(isPublicApiRoute('POST', '/webhooks/twilio/inbound/abc/extra'), false)
  assert.equal(isPublicApiRoute('GET', '/healthz'), false)
  assert.equal(isPublicApiRoute('GET', '/health/'), true, 'trailing slash tolerated')
  assert.equal(isPublicApiRoute('GET', '/clients/../health'), false)
})

function appWithGate() {
  const app = express()
  app.use(express.json())
  app.use('/api', apiGate)
  // Stand-in for every router: echoes who the gate let through.
  app.all(/^\/api\/.*/, (req, res) => res.json({ ok: true, user: req.user?.id ?? null }))
  return new Promise(resolve => {
    const srv = app.listen(0, () => resolve({ srv, base: `http://127.0.0.1:${srv.address().port}/api` }))
  })
}

async function call(base, method, path, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: method === 'GET' ? undefined : '{}',
  })
  return res.status
}

test('over HTTP: 401 without a token or with a bad one, 200 with a valid one', async () => {
  const { srv, base } = await appWithGate()
  const good = jwt.sign({ id: 1, email: 'admin@example.invalid' }, JWT_SECRET, { expiresIn: '5m' })
  const forged = jwt.sign({ id: 1, email: 'x' }, 'not-the-secret')
  const expired = jwt.sign({ id: 1, email: 'x', exp: Math.floor(Date.now() / 1000) - 60 }, JWT_SECRET)
  try {
    for (const [m, p] of PROTECTED) {
      assert.equal(await call(base, m, p), 401, `${m} ${p} without token`)
      assert.equal(await call(base, m, p, forged), 401, `${m} ${p} with forged token`)
      assert.equal(await call(base, m, p, expired), 401, `${m} ${p} with expired token`)
      assert.equal(await call(base, m, p, good), 200, `${m} ${p} with valid token`)
    }
    for (const [m, p] of PUBLIC) assert.equal(await call(base, m, p), 200, `${m} ${p} public`)
  } finally { srv.close() }
})

// Tests for the homedocs route — validation, generate+persist flow, and
// delete authorization. Mounts makeRouter() with injected fakes (no DB, no AI)
// on a throwaway express server; real requireAuth runs, so we sign test JWTs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'

import { makeRouter } from './homedocs.js'
import { JWT_SECRET } from '../middleware/auth.js'

function authHeader(user) {
  return { Authorization: `Bearer ${jwt.sign(user, JWT_SECRET)}`, 'Content-Type': 'application/json' }
}

async function buildServer({ query, generate }) {
  const app = express()
  app.use(express.json())
  app.use('/api/homedocs', makeRouter({ query, generate }))
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => { res.status(500).json({ error: err.message }) })
  const srv = await new Promise(r => { const s = app.listen(0, () => r(s)) })
  return { srv, base: `http://127.0.0.1:${srv.address().port}` }
}

async function req(base, method, path, user, body) {
  const res = await fetch(base + path, {
    method,
    headers: authHeader(user),
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

const ADMIN = { id: 1, role: 'Admin' }
const FORM = {
  client_name: 'Jane Doe', contact_name: 'Jane', phone: '555', email: 'j@x.com',
  address: '1 St', install_date: '2026-06-01', technicians: ['AL'],
}

test('POST /generate rejects an unknown doc_type', async () => {
  const { srv, base } = await buildServer({ query: async () => ({ rows: [] }), generate: async () => ({ html: '<p>x</p>' }) })
  try {
    const { status, body } = await req(base, 'POST', '/api/homedocs/generate', ADMIN,
      { client_id: 5, doc_type: 'nope', form_data: FORM, details_text: 'x' })
    assert.equal(status, 400)
    assert.match(body.error, /doc_type must be one of/)
  } finally { srv.close() }
})

test('POST /generate requires client_id', async () => {
  const { srv, base } = await buildServer({ query: async () => ({ rows: [] }), generate: async () => ({ html: '<p>x</p>' }) })
  try {
    const { status, body } = await req(base, 'POST', '/api/homedocs/generate', ADMIN,
      { doc_type: 'handover_guide', form_data: FORM, details_text: 'x' })
    assert.equal(status, 400)
    assert.match(body.error, /client_id is required/)
  } finally { srv.close() }
})

test('POST /generate calls the AI, persists, and returns the row', async () => {
  const calls = { generate: [], inserts: [] }
  const generate = async (docType, payload) => { calls.generate.push({ docType, payload }); return { html: '<h1>Handover</h1>' } }
  const query = async (sql, params) => {
    const s = sql.replace(/\s+/g, ' ').trim()
    if (/^INSERT INTO homedocs/i.test(s)) { calls.inserts.push(params); return { rows: [{ id: 42 }] } }
    if (/SELECT h\.\*/i.test(s)) return { rows: [{ id: 42, doc_type: 'handover_guide', generated_html: '<h1>Handover</h1>', client_name: 'Jane Doe' }] }
    return { rows: [] }
  }
  const { srv, base } = await buildServer({ query, generate })
  try {
    const { status, body } = await req(base, 'POST', '/api/homedocs/generate', ADMIN,
      { client_id: 5, job_id: 9, doc_type: 'handover_guide', form_data: FORM, details_text: 'Installed EA-5' })
    assert.equal(status, 201)
    assert.equal(body.id, 42)
    assert.equal(body.generated_html, '<h1>Handover</h1>')
    assert.equal(calls.generate.length, 1)
    assert.equal(calls.generate[0].docType, 'handover_guide')
    assert.equal(calls.inserts[0][5], '<h1>Handover</h1>') // generated_html param
  } finally { srv.close() }
})

test('GET / filters by client_id and orders newest first', async () => {
  let seenSql = ''
  const query = async (sql) => { seenSql = sql; return { rows: [{ id: 1 }] } }
  const { srv, base } = await buildServer({ query, generate: async () => ({}) })
  try {
    const { status } = await req(base, 'GET', '/api/homedocs?client_id=5', ADMIN)
    assert.equal(status, 200)
    assert.match(seenSql, /WHERE h\.client_id = \$1/)
    assert.match(seenSql, /ORDER BY h\.created_at DESC/)
  } finally { srv.close() }
})

test('DELETE forbids a non-owner non-admin', async () => {
  const query = async (sql) => {
    if (/SELECT generated_by_user_id/.test(sql)) return { rows: [{ generated_by_user_id: 99 }] }
    if (/SELECT role FROM users/.test(sql)) return { rows: [{ role: 'Technician' }] }
    return { rows: [] }
  }
  const { srv, base } = await buildServer({ query, generate: async () => ({}) })
  try {
    const { status, body } = await req(base, 'DELETE', '/api/homedocs/7', { id: 2, role: 'Technician' })
    assert.equal(status, 403)
    assert.match(body.error, /admin or the document creator/)
  } finally { srv.close() }
})

test('DELETE allows the owner', async () => {
  const query = async (sql) => {
    if (/SELECT generated_by_user_id/.test(sql)) return { rows: [{ generated_by_user_id: 2 }] }
    return { rows: [] }
  }
  const { srv, base } = await buildServer({ query, generate: async () => ({}) })
  try {
    const { status, body } = await req(base, 'DELETE', '/api/homedocs/7', { id: 2, role: 'Technician' })
    assert.equal(status, 200)
    assert.equal(body.ok, true)
  } finally { srv.close() }
})

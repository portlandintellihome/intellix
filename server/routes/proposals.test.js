// Tests for the proposals route — happy-path create/update plus the
// schema-drift diagnostic. Mounts makeRouter() with a fake query on a
// throwaway express server and hits it over HTTP (no DB, no supertest dep).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'

import { makeRouter } from './proposals.js'

function serverWith(query) {
  const app = express()
  app.use(express.json())
  app.use('/api/proposals', makeRouter(query))
  app.use((err, _req, res, _next) => { res.status(500).json({ error: err.message }) }) // eslint-disable-line no-unused-vars
  return new Promise(resolve => {
    const srv = app.listen(0, () => {
      const { port } = srv.address()
      resolve({ srv, base: `http://127.0.0.1:${port}` })
    })
  })
}

async function req(base, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

const EDIT_PAYLOAD = {
  client_id: 3, location_id: 2, address: '12 Oak St',
  scope: 'Add Sonos to patio', devices: 'Sonos Amp', rooms: 1,
  labor: 400, materials: 250, total: 650, status: 'Sent',
}

test('PATCH /api/proposals/:id — happy path updates and returns the row', async () => {
  const calls = []
  const query = async (sql, params) => {
    calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params })
    return { rows: [{ id: 7, ...EDIT_PAYLOAD }] }
  }
  const { srv, base } = await serverWith(query)
  try {
    const { status, body } = await req(base, 'PATCH', '/api/proposals/7', EDIT_PAYLOAD)
    assert.equal(status, 200)
    assert.equal(body.id, 7)
    const update = calls.find(c => /UPDATE proposals SET/.test(c.sql))
    assert.ok(update, 'expected an UPDATE proposals statement')
    // scope column referenced (not renamed), and the id is the last param.
    assert.match(update.sql, /scope = \$/)
    assert.equal(update.params[update.params.length - 1], '7')
  } finally { srv.close() }
})

test('PATCH with no known fields returns the existing row (no-op)', async () => {
  const query = async (sql) => {
    if (/SELECT/.test(sql)) return { rows: [{ id: 7, scope: 'x' }] }
    throw new Error('should not UPDATE on empty patch')
  }
  const { srv, base } = await serverWith(query)
  try {
    const { status, body } = await req(base, 'PATCH', '/api/proposals/7', { not_a_column: 1 })
    assert.equal(status, 200)
    assert.equal(body.id, 7)
  } finally { srv.close() }
})

test('PATCH surfaces a missing column (42703) as an actionable 400, not a 500', async () => {
  const query = async () => {
    const err = new Error('column "location_id" of relation "proposals" does not exist')
    err.code = '42703'
    throw err
  }
  const { srv, base } = await serverWith(query)
  try {
    const { status, body } = await req(base, 'PATCH', '/api/proposals/7', EDIT_PAYLOAD)
    assert.equal(status, 400)
    assert.equal(body.code, '42703')
    assert.match(body.error, /schema is out of date/i)
  } finally { srv.close() }
})

test('POST /api/proposals — happy path inserts and returns 201', async () => {
  const query = async (sql) => {
    if (/SELECT location_id FROM clients/.test(sql)) return { rows: [{ location_id: 2 }] }
    return { rows: [{ id: 9, ...EDIT_PAYLOAD }] }
  }
  const { srv, base } = await serverWith(query)
  try {
    const { status, body } = await req(base, 'POST', '/api/proposals', EDIT_PAYLOAD)
    assert.equal(status, 201)
    assert.equal(body.id, 9)
  } finally { srv.close() }
})

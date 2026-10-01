// Tests for the jobs route — exercises the canonical status lifecycle and the
// completed_at stamp. Mounts makeRouter() with a fake query on a throwaway
// express server and hits it over HTTP (no DB, no supertest dep). Phase is
// deprecated and must no longer appear in INSERT/UPDATE statements.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'

import { makeRouter } from './jobs.js'

function serverWith(query) {
  const app = express()
  app.use(express.json())
  app.use('/api/jobs', makeRouter(query))
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

test('POST /api/jobs — defaults status to pending and never inserts phase', async () => {
  const calls = []
  const query = async (sql, params) => {
    calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params })
    return { rows: [{ id: 1, name: 'Smith install', status: 'pending' }] }
  }
  const { srv, base } = await serverWith(query)
  try {
    const { status, body } = await req(base, 'POST', '/api/jobs', { name: 'Smith install', client_id: 3, location_id: 2 })
    assert.equal(status, 201)
    assert.equal(body.status, 'pending')
    const insert = calls.find(c => /INSERT INTO jobs/.test(c.sql))
    assert.ok(insert, 'expected an INSERT INTO jobs')
    assert.doesNotMatch(insert.sql, /phase/, 'phase must not appear in the INSERT')
    // status default flows through as a positional param.
    assert.ok(insert.params.includes('pending'))
  } finally { srv.close() }
})

test('PATCH status -> completed stamps completed_at automatically', async () => {
  const calls = []
  const query = async (sql, params) => {
    calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params })
    if (/SELECT id, status, completed_at/.test(sql)) {
      return { rows: [{ id: 9, status: 'in_progress', completed_at: null }] }
    }
    return { rows: [{ id: 9, status: 'completed' }] }
  }
  const { srv, base } = await serverWith(query)
  try {
    const { status, body } = await req(base, 'PATCH', '/api/jobs/9', { status: 'completed' })
    assert.equal(status, 200)
    assert.equal(body.status, 'completed')
    const update = calls.find(c => /UPDATE jobs SET/.test(c.sql))
    assert.ok(update, 'expected an UPDATE jobs statement')
    assert.match(update.sql, /completed_at = NOW\(\)/, 'completed_at should be stamped on the transition')
  } finally { srv.close() }
})

test('PATCH status -> completed does NOT re-stamp when already completed', async () => {
  const calls = []
  const query = async (sql) => {
    calls.push({ sql: sql.replace(/\s+/g, ' ').trim() })
    if (/SELECT id, status, completed_at/.test(sql)) {
      return { rows: [{ id: 9, status: 'completed', completed_at: '2026-01-01T00:00:00Z' }] }
    }
    return { rows: [{ id: 9, status: 'completed' }] }
  }
  const { srv, base } = await serverWith(query)
  try {
    const { status } = await req(base, 'PATCH', '/api/jobs/9', { status: 'completed' })
    assert.equal(status, 200)
    const update = calls.find(c => /UPDATE jobs SET/.test(c.sql))
    assert.ok(update)
    assert.doesNotMatch(update.sql, /completed_at = NOW\(\)/, 'must not re-stamp an already-completed job')
  } finally { srv.close() }
})

test('PATCH ignores phase (deprecated, not patchable)', async () => {
  const calls = []
  const query = async (sql) => {
    calls.push({ sql: sql.replace(/\s+/g, ' ').trim() })
    if (/SELECT id, status, completed_at/.test(sql)) {
      return { rows: [{ id: 9, status: 'in_progress', completed_at: null }] }
    }
    return { rows: [{ id: 9, status: 'in_progress' }] }
  }
  const { srv, base } = await serverWith(query)
  try {
    const { status, body } = await req(base, 'PATCH', '/api/jobs/9', { phase: 'Installation' })
    // No patchable fields → no-op returns the existing row, no UPDATE issued.
    assert.equal(status, 200)
    assert.equal(body.id, 9)
    assert.equal(calls.some(c => /UPDATE jobs SET/.test(c.sql)), false, 'phase-only patch must not UPDATE')
  } finally { srv.close() }
})

test('POST /api/jobs created as completed stamps completed_at', async () => {
  const calls = []
  const query = async (sql, params) => {
    calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params })
    return { rows: [{ id: 2, name: 'Done already', status: 'completed' }] }
  }
  const { srv, base } = await serverWith(query)
  try {
    const { status } = await req(base, 'POST', '/api/jobs', { name: 'Done already', status: 'completed', location_id: 1 })
    assert.equal(status, 201)
    const insert = calls.find(c => /INSERT INTO jobs/.test(c.sql))
    assert.match(insert.sql, /completed_at\) VALUES/, 'completed_at must be in the INSERT column list')
    assert.match(insert.sql, /CASE WHEN \$4 = 'completed' THEN NOW\(\) END/)
  } finally { srv.close() }
})

test('PATCH completed -> scheduled (reopen) clears completed_at and a cleanup-suppressed check-in', async () => {
  const calls = []
  const query = async (sql, params) => {
    calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params })
    if (/SELECT id, status, completed_at/.test(sql)) {
      return { rows: [{ id: 9, status: 'completed', completed_at: '2026-09-30T20:00:00Z' }] }
    }
    return { rows: [{ id: 9, status: 'scheduled' }] }
  }
  const { srv, base } = await serverWith(query)
  try {
    const { status } = await req(base, 'PATCH', '/api/jobs/9', { status: 'scheduled' })
    assert.equal(status, 200)
    const update = calls.find(c => /UPDATE jobs SET/.test(c.sql))
    assert.match(update.sql, /completed_at = NULL/)
    assert.match(update.sql, /checkin_sent_at = CASE WHEN checkin_sent_at = completed_at THEN NULL ELSE checkin_sent_at END/)
  } finally { srv.close() }
})

test('PATCH that keeps a job completed does not clear completed_at', async () => {
  const calls = []
  const query = async (sql) => {
    calls.push({ sql: sql.replace(/\s+/g, ' ').trim() })
    if (/SELECT id, status, completed_at/.test(sql)) {
      return { rows: [{ id: 9, status: 'completed', completed_at: '2026-09-30T20:00:00Z' }] }
    }
    return { rows: [{ id: 9, status: 'completed' }] }
  }
  const { srv, base } = await serverWith(query)
  try {
    await req(base, 'PATCH', '/api/jobs/9', { scope: 'notes only' })
    const update = calls.find(c => /UPDATE jobs SET/.test(c.sql))
    assert.doesNotMatch(update.sql, /completed_at = NULL/)
  } finally { srv.close() }
})

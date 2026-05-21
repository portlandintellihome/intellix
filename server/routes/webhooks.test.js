// Unit tests for the Portal.io webhook handlers. The Express layer (route
// dispatch + secret validation) is exercised separately by hitting the
// /api/webhooks/portal-io/proposal/:secret endpoint. These tests cover the
// pure handlers that do the create/update logic.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { handleProposalSync, handleContactSync } from './webhooks.js'

// Minimal in-memory "Postgres" — enough to exercise the SQL patterns the
// handlers actually use (LIMIT 1, LOWER(email), simple inserts/updates).
// Each test gets its own instance.
function makeFakeDb() {
  const tables = {
    clients: [],
    proposals: [],
    jobs: [],
    integrations: [],
  }
  let ids = { clients: 0, proposals: 0, jobs: 0 }

  function insertReturning(table, cols, vals) {
    ids[table] += 1
    const row = { id: ids[table] }
    cols.forEach((c, i) => { row[c] = vals[i] })
    tables[table].push(row)
    return row
  }

  async function query(sql, params = []) {
    const s = sql.replace(/\s+/g, ' ').trim()

    // SELECT integrations (used only to make integration objects; we
    // construct them inline in tests, so this path is unused).

    // SELECT * FROM clients WHERE portal_contact_id = $1 LIMIT 1
    if (/^SELECT \* FROM clients WHERE portal_contact_id = \$1 LIMIT 1/i.test(s)) {
      const hit = tables.clients.find(c => c.portal_contact_id === params[0])
      return { rows: hit ? [hit] : [] }
    }
    // SELECT * FROM clients WHERE LOWER(email) = LOWER($1) LIMIT 1
    if (/^SELECT \* FROM clients WHERE LOWER\(email\) = LOWER\(\$1\) LIMIT 1/i.test(s)) {
      const target = String(params[0] || '').toLowerCase()
      const hit = tables.clients.find(c => String(c.email || '').toLowerCase() === target)
      return { rows: hit ? [hit] : [] }
    }
    // INSERT INTO clients (...)
    if (/^INSERT INTO clients/i.test(s)) {
      const row = insertReturning('clients',
        ['portal_contact_id', 'name', 'email', 'phone', 'address', 'location_id'],
        params)
      return { rows: [row] }
    }
    // UPDATE clients SET ...
    if (/^UPDATE clients SET/i.test(s)) {
      const id = params[params.length - 1]
      const target = tables.clients.find(c => c.id === id)
      if (target) {
        // Parse "col = $N, col2 = $M" — params[0..N-2] in order match the SET clauses
        const setPart = s.match(/SET (.+) WHERE/i)?.[1] || ''
        const cols = setPart.split(',').map(p => p.trim().split('=')[0].trim())
        cols.forEach((col, i) => { target[col] = params[i] })
      }
      return { rows: target ? [target] : [] }
    }
    // SELECT * FROM proposals WHERE portal_proposal_id = $1 LIMIT 1
    if (/^SELECT \* FROM proposals WHERE portal_proposal_id = \$1 LIMIT 1/i.test(s)) {
      const hit = tables.proposals.find(p => p.portal_proposal_id === params[0])
      return { rows: hit ? [hit] : [] }
    }
    // INSERT INTO proposals
    if (/^INSERT INTO proposals/i.test(s)) {
      const row = insertReturning('proposals',
        ['portal_proposal_id', 'client_id', 'status', 'scope', 'labor', 'materials', 'total', 'location_id', 'portal_id'],
        params)
      return { rows: [row] }
    }
    // UPDATE proposals SET ...
    if (/^UPDATE proposals SET/i.test(s)) {
      // Last param is the portal_proposal_id
      const ppid = params[params.length - 1]
      const target = tables.proposals.find(p => p.portal_proposal_id === ppid)
      if (target) {
        target.status = params[0]
        target.scope = params[1]
        if (params[2] != null) target.labor = params[2]
        if (params[3] != null) target.materials = params[3]
        if (params[4] != null) target.total = params[4]
        target.client_id = params[5]
        if (target.location_id == null) target.location_id = params[6]
      }
      return { rows: target ? [target] : [] }
    }
    // SELECT id FROM jobs WHERE proposal_id = $1 LIMIT 1
    if (/^SELECT id FROM jobs WHERE proposal_id = \$1 LIMIT 1/i.test(s)) {
      const hit = tables.jobs.find(j => j.proposal_id === params[0])
      return { rows: hit ? [{ id: hit.id }] : [] }
    }
    // INSERT INTO jobs
    if (/^INSERT INTO jobs/i.test(s)) {
      const row = insertReturning('jobs',
        ['name', 'client_id', 'address', 'scope', 'location_id', 'proposal_id'],
        params)
      row.status = 'Scheduled'
      return { rows: [{ id: row.id }] }
    }
    // UPDATE integrations SET last_synced_at
    if (/^UPDATE integrations SET last_synced_at/i.test(s)) {
      return { rows: [] }
    }
    throw new Error('Unmocked query: ' + s.slice(0, 120))
  }

  return { query, tables }
}

function makeIntegration({ default_location_id = 2 } = {}) {
  return {
    id: 1,
    kind: 'portal_io',
    connected: true,
    secret: 'test-secret',
    default_location_id,
    last_synced_at: null,
  }
}

// --- tests ------------------------------------------------------------------

test('proposal sync: new client + new proposal → both created', async () => {
  const db = makeFakeDb()
  const result = await handleProposalSync({
    portal_proposal_id: 'PORTAL-1',
    status: 'sent',
    name: 'Living-room theater',
    value: 12500, labor: 4500, materials: 8000,
    client: {
      portal_contact_id: 'CT-1', name: 'Jane Smith',
      email: 'jane@example.com', phone: '5035550100', address: '742 Evergreen',
    },
  }, makeIntegration({ default_location_id: 2 }), db.query)

  assert.equal(result.action, 'created')
  assert.equal(result.job_id, null)
  assert.equal(db.tables.clients.length, 1)
  assert.equal(db.tables.clients[0].portal_contact_id, 'CT-1')
  assert.equal(db.tables.clients[0].location_id, 2) // default_location_id
  assert.equal(db.tables.proposals.length, 1)
  assert.equal(db.tables.proposals[0].status, 'Sent')
  assert.equal(db.tables.proposals[0].total, 12500)
})

test('proposal sync: same portal_proposal_id with status change → updated, no duplicate', async () => {
  const db = makeFakeDb()
  const integ = makeIntegration()
  // First sync — draft
  await handleProposalSync({
    portal_proposal_id: 'PORTAL-2', status: 'draft',
    name: 'Test', value: 100, labor: 50, materials: 50,
    client: { portal_contact_id: 'CT-2', name: 'X', email: 'x@x.com' },
  }, integ, db.query)
  // Second sync — same proposal, now sent
  const second = await handleProposalSync({
    portal_proposal_id: 'PORTAL-2', status: 'sent',
    name: 'Test (renamed)', value: 200, labor: 50, materials: 150,
    client: { portal_contact_id: 'CT-2', name: 'X', email: 'x@x.com' },
  }, integ, db.query)

  assert.equal(second.action, 'updated')
  assert.equal(db.tables.proposals.length, 1)
  assert.equal(db.tables.proposals[0].status, 'Sent')
  assert.equal(db.tables.proposals[0].scope, 'Test (renamed)')
  assert.equal(db.tables.proposals[0].total, 200)
  assert.equal(db.tables.clients.length, 1)
})

test('proposal sync: status=accepted → job auto-created', async () => {
  const db = makeFakeDb()
  const result = await handleProposalSync({
    portal_proposal_id: 'PORTAL-3', status: 'accepted',
    name: 'Done deal', value: 5000, labor: 2000, materials: 3000,
    client: { portal_contact_id: 'CT-3', name: 'Y', email: 'y@y.com' },
  }, makeIntegration(), db.query)

  assert.equal(result.action, 'created')
  assert.ok(result.job_id, 'expected job_id to be set on accepted')
  assert.equal(db.tables.jobs.length, 1)
  assert.equal(db.tables.jobs[0].proposal_id, result.proposal_id)
})

test('proposal sync: second accepted hit → no duplicate job', async () => {
  const db = makeFakeDb()
  const integ = makeIntegration()
  await handleProposalSync({
    portal_proposal_id: 'PORTAL-4', status: 'accepted',
    name: 'Once', value: 100, labor: 50, materials: 50,
    client: { portal_contact_id: 'CT-4', name: 'Z', email: 'z@z.com' },
  }, integ, db.query)
  const second = await handleProposalSync({
    portal_proposal_id: 'PORTAL-4', status: 'accepted',
    name: 'Once', value: 100, labor: 50, materials: 50,
    client: { portal_contact_id: 'CT-4', name: 'Z', email: 'z@z.com' },
  }, integ, db.query)

  assert.equal(db.tables.jobs.length, 1)
  assert.equal(second.action, 'updated')
})

test('proposal sync: client matched by email when no portal_contact_id supplied', async () => {
  const db = makeFakeDb()
  const integ = makeIntegration()
  // Existing client by email
  await db.query(
    'INSERT INTO clients (portal_contact_id, name, email, phone, address, location_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [null, 'Existing', 'reuse@example.com', null, null, 1],
  )
  const result = await handleProposalSync({
    portal_proposal_id: 'PORTAL-5', status: 'draft',
    name: 'X', value: 1, labor: 1, materials: 0,
    client: { portal_contact_id: 'NEW-CT', name: 'Existing', email: 'reuse@example.com' },
  }, integ, db.query)

  assert.equal(db.tables.clients.length, 1, 'should reuse existing client')
  // portal_contact_id should now be backfilled on the existing row
  assert.equal(db.tables.clients[0].portal_contact_id, 'NEW-CT')
  assert.equal(result.client_id, db.tables.clients[0].id)
})

test('contact sync: creates new client', async () => {
  const db = makeFakeDb()
  const result = await handleContactSync({
    portal_contact_id: 'CT-CONTACT-1',
    name: 'Contact Tester',
    email: 'contact@example.com',
    phone: null,
    address: '1 Main',
  }, makeIntegration(), db.query)
  assert.equal(result.action, 'created')
  assert.equal(db.tables.clients.length, 1)
})

test('contact sync: missing both portal_contact_id and email → 400', async () => {
  const db = makeFakeDb()
  await assert.rejects(
    handleContactSync({ name: 'X' }, makeIntegration(), db.query),
    err => err.status === 400,
  )
})

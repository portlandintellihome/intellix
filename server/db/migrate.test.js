// Tests for the schema-drift guard. expectedColumns() is the parser that
// powers verifySchema(); these lock in that columns added to a CREATE TABLE
// block AND columns added via ALTER are both recognised — the exact gap that
// let proposals.address silently miss production.
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { expectedColumns } from './migrate.js'

test('expectedColumns parses CREATE TABLE column defs', () => {
  const sql = `
CREATE TABLE IF NOT EXISTS proposals (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  address TEXT,
  scope TEXT,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`
  const e = expectedColumns(sql)
  assert.ok(e.proposals.has('id'))
  assert.ok(e.proposals.has('address'))
  assert.ok(e.proposals.has('scope'))
  assert.ok(e.proposals.has('assigned_to'))
  assert.ok(e.proposals.has('created_at'))
})

test('expectedColumns includes ALTER ADD COLUMN [IF NOT EXISTS]', () => {
  const sql = `
CREATE TABLE IF NOT EXISTS proposals ( id SERIAL PRIMARY KEY
);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);
ALTER TABLE proposals ADD COLUMN portal_proposal_id TEXT;`
  const e = expectedColumns(sql)
  assert.ok(e.proposals.has('location_id'))
  assert.ok(e.proposals.has('portal_proposal_id'))
})

test('expectedColumns skips table-level constraints', () => {
  const sql = `
CREATE TABLE IF NOT EXISTS t (
  id SERIAL PRIMARY KEY,
  a TEXT,
  PRIMARY KEY (id),
  FOREIGN KEY (a) REFERENCES x(a)
);`
  const e = expectedColumns(sql)
  assert.deepEqual([...e.t].sort(), ['a', 'id'])
})

test('the real schema.sql declares proposals.address (regression guard)', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const url = await import('node:url')
  const dir = path.dirname(url.fileURLToPath(import.meta.url))
  const sql = fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8')
  const e = expectedColumns(sql)
  // address must be reachable via ALTER (not only the CREATE block), since
  // prod's proposals table predates it. Assert an ALTER exists.
  assert.match(sql, /ALTER TABLE proposals ADD COLUMN IF NOT EXISTS address TEXT/)
  assert.ok(e.proposals.has('address'))
  assert.ok(e.proposals.has('assigned_to'))
})

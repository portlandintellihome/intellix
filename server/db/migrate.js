import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = path.resolve(__dirname, 'schema.sql')

// Split a SQL file on top-level semicolons while respecting:
//   - dollar-quoted blocks  ($$ … $$)   so DO blocks survive
//   - single-quoted strings ('…')        so semicolons in literals survive
//   - line comments         (-- … \n)    so semicolons in comments survive
//   - block comments        (/* … */)    same
//
// The previous version only handled $$, which meant a single inline ";"
// inside a `--` comment would shred the surrounding statement into
// garbage fragments and Postgres would 42601 the resulting nonsense.
function splitStatements(sql) {
  const out = []
  let buf = ''
  let inDollar = false
  let inSingleQuote = false
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]
    const next = sql[i + 1]

    // Comment handling — comments are passed through to the buffer so
    // Postgres still sees them, but their contents (including ;) are
    // ignored by the splitter.
    if (inLineComment) {
      buf += c
      if (c === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      buf += c
      if (c === '*' && next === '/') { buf += next; i++; inBlockComment = false }
      continue
    }
    // Dollar-quoted block — ignore everything between $$ … $$ except the
    // closing delimiter. Single quotes inside $$ blocks are literal.
    if (inDollar) {
      if (c === '$' && next === '$') { buf += '$$'; i++; inDollar = false; continue }
      buf += c
      continue
    }
    // Single-quoted string literal — handle '' (escaped quote) but
    // otherwise treat as opaque.
    if (inSingleQuote) {
      buf += c
      if (c === "'" && next === "'") { buf += next; i++; continue }
      if (c === "'") inSingleQuote = false
      continue
    }

    // Outside any quoted/commented region: detect openers.
    if (c === '-' && next === '-') { buf += '--'; i++; inLineComment = true; continue }
    if (c === '/' && next === '*') { buf += '/*'; i++; inBlockComment = true; continue }
    if (c === '$' && next === '$') { buf += '$$'; i++; inDollar = true; continue }
    if (c === "'") { buf += c; inSingleQuote = true; continue }

    if (c === ';') {
      const trimmed = buf.trim()
      if (trimmed) out.push(trimmed)
      buf = ''
      continue
    }
    buf += c
  }
  const tail = buf.trim()
  if (tail) out.push(tail)
  return out
}

// One-line summary for log lines: drop comments, collapse whitespace, clip.
function summary(stmt) {
  const clean = stmt
    .split('\n')
    .map(l => l.replace(/--.*$/, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return clean.length > 100 ? clean.slice(0, 100) + '…' : clean
}

// Parse the columns schema.sql *declares* for each table, from both the
// CREATE TABLE blocks and any `ALTER TABLE x ADD COLUMN [IF NOT EXISTS] y`.
// Used by verifySchema() to catch the silent-drift bug class: a column added
// to a CREATE TABLE block never lands on an already-existing (prod) table,
// because CREATE TABLE IF NOT EXISTS is a no-op there. Every column that is
// expected MUST therefore also appear via ALTER — this check enforces that.
export function expectedColumns(sql) {
  const expected = {} // table -> Set(columns)
  const add = (t, c) => { (expected[t] ||= new Set()).add(c.toLowerCase()) }

  // CREATE TABLE [IF NOT EXISTS] name ( ...col defs... )
  const createRe = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\)/gi
  let m
  while ((m = createRe.exec(sql))) {
    const table = m[1]
    for (const raw of m[2].split('\n')) {
      const line = raw.trim().replace(/,$/, '')
      if (!line || line.startsWith('--')) continue
      // Skip table-level constraints; a column def starts with an identifier.
      if (/^(PRIMARY|FOREIGN|UNIQUE|CONSTRAINT|CHECK)\b/i.test(line)) continue
      const col = line.match(/^"?(\w+)"?\s/)
      if (col) add(table, col[1])
    }
  }

  // ALTER TABLE name ADD COLUMN [IF NOT EXISTS] col ...
  const alterRe = /ALTER TABLE (\w+)\s+ADD COLUMN (?:IF NOT EXISTS )?"?(\w+)"?/gi
  while ((m = alterRe.exec(sql))) add(m[1], m[2])

  return expected
}

// After migrating, confirm every column schema.sql declares actually exists
// on the live DB. Throws (listing the gaps) if any are missing — this is the
// guard that turns silent schema drift into a loud boot failure.
async function verifySchema(client, sql, { verbose = true } = {}) {
  const expected = expectedColumns(sql)
  const { rows } = await client.query(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
  )
  const live = {} // table -> Set(columns)
  for (const r of rows) (live[r.table_name] ||= new Set()).add(r.column_name.toLowerCase())

  const missing = []
  let checked = 0
  for (const [table, cols] of Object.entries(expected)) {
    // Only verify tables that exist live (expected-but-absent table would have
    // failed the migration step already).
    if (!live[table]) continue
    for (const c of cols) {
      checked++
      if (!live[table].has(c)) missing.push(`${table}.${c}`)
    }
  }

  if (missing.length) {
    // Warn loudly but do NOT fail the boot: one stale table shouldn't take the
    // whole app down. The drift is surfaced in Railway logs so it's actionable.
    // Root cause is always the same — a column added to a CREATE TABLE block
    // (or renamed) without a matching idempotent ALTER, which CREATE TABLE IF
    // NOT EXISTS silently skips on an existing DB.
    console.warn(`[migrate] ⚠️  SCHEMA DRIFT — ${missing.length} declared column(s) missing on the live DB: ${missing.join(', ')}. ` +
      `Add a matching "ALTER TABLE ... ADD/RENAME COLUMN" to schema.sql so it lands on existing databases. App will still boot.`)
  }
  if (verbose) {
    console.log(`[migrate] schema check: ${checked} declared columns verified across ${Object.keys(expected).length} tables, ${missing.length} missing`)
  }
  return { checked, missing }
}

export async function migrate({ verbose = true } = {}) {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set')
  }

  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8')
  const statements = splitStatements(sql)

  if (verbose) console.log(`[migrate] schema.sql → ${statements.length} statements`)

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' || process.env.PGSSLMODE === 'require'
      ? { rejectUnauthorized: false }
      : false,
  })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      const label = summary(stmt)
      try {
        const res = await client.query(stmt)
        if (verbose) console.log(`[migrate] (${i + 1}/${statements.length}) ok — ${label}${res.command ? ` [${res.command}]` : ''}`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`[migrate] (${i + 1}/${statements.length}) FAILED — ${label}`)
        console.error('[migrate] error:', {
          code: err.code,
          message: err.message,
          detail: err.detail,
          hint: err.hint,
          position: err.position,
        })
        throw err
      }
    }

    await client.query('COMMIT')
    if (verbose) console.log(`[migrate] committed ${statements.length} statements`)

    // Guard against the silent-drift bug class: verify the live schema has
    // every column schema.sql declares. Runs after COMMIT (read-only check);
    // throws → bootstrap() exits non-zero rather than serving a stale schema.
    await verifySchema(client, sql, { verbose })
  } finally {
    client.release()
    await pool.end()
  }
}

// Run when invoked directly via `node server/db/migrate.js` or `npm run db:migrate`.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  migrate()
    .then(() => { console.log('[migrate] done'); process.exit(0) })
    .catch(err => { console.error('[migrate] failed:', err.message); process.exit(1) })
}

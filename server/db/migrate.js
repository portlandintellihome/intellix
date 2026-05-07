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

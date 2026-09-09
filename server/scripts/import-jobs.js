// One-off importer for the Housecall Pro-style JOBS export.
//
//   DRY RUN (default — reads DB read-only, inserts NOTHING):
//     DATABASE_URL="<public-url>" PGSSLMODE=require \
//       node server/scripts/import-jobs.js /Users/work/import-data/intellihome-jobs-exportus.csv
//
//   COMMIT (wraps all inserts in a single transaction):
//     ... node server/scripts/import-jobs.js <csv> --commit
//
// Requires the migration in jobs-import-migration.sql (source_id, source_system,
// source_meta, scheduled_start_at). Idempotent on jobs.source_id ("Job #").
//
// There is NO shared identifier between the jobs export and the customer
// export, so a job is linked to a client by matching "Customer name" against
// clients.name. Unmatched jobs are still imported, with client_id NULL.

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { parseCsv, toObjects } from './import-clients.js'

const { Pool } = pg
const SOURCE_SYSTEM = 'housecall_pro_jobs'

// Housecall exports "Job #" as a spreadsheet-armoured formula: ="1234". The
// CSV parser hands us =""1234"" -> ="1234"; strip the wrapper to a plain number.
export function stripJobNumber(raw) {
  const s = String(raw == null ? '' : raw).trim()
  const m = s.match(/^="?(.*?)"?$/)
  const inner = (m ? m[1] : s).replace(/^"+|"+$/g, '').trim()
  return inner || null
}

// Housecall status -> the app's canonical job lifecycle vocabulary
// (pending | scheduled | in_progress | completed | cancelled).
const STATUS_MAP = {
  'completed': 'completed',
  'scheduled': 'scheduled',
  'in progress': 'in_progress',
  'needs scheduling': 'pending',
}
export function mapStatus(raw) {
  const k = String(raw || '').trim().toLowerCase()
  return STATUS_MAP[k] || null
}

// "$1,234.56" -> 1234.56. Zero is a real value from the source and is kept as
// 0.00, not collapsed to NULL.
export function parseAmount(raw) {
  if (raw == null || String(raw).trim() === '') return null
  const n = Number(String(raw).replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

export function parseTs(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

// Normalised key for client-name matching: case/punctuation/whitespace folded,
// and "&" treated as "and" so "Bob & Marni" matches "Bob and Marni".
export function nameKey(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function mapRow(row) {
  const sourceId = stripJobNumber(row['Job #'])
  const customer = (row['Customer name'] || '').trim()
  const desc = (row['Job description'] || '').trim()
  const rawStatus = (row['Job status'] || '').trim()
  const address = (row['Address'] || '').trim()
  const createdAt = parseTs(row['Job created date'])
  const startAt = parseTs(row['Job scheduled start date'])

  // jobs.name is NOT NULL. 638 rows have a blank description, so fall back to a
  // traceable label rather than inventing prose or dropping the row.
  const name = desc || (sourceId ? `Job #${sourceId}` : 'Untitled job')

  return {
    sourceId,
    customer,
    customerKey: nameKey(customer),
    unmappedStatus: rawStatus && !mapStatus(rawStatus) ? rawStatus : null,
    payload: {
      name,
      status: mapStatus(rawStatus),
      address: address || null,
      created_at: createdAt,
      scheduled_start_at: startAt,
      // start_date is DATE; keep it aligned with the timestamp for the UI.
      start_date: startAt ? startAt.toISOString().slice(0, 10) : null,
      amount: parseAmount(row['Job amount']),
      source_id: sourceId,
      source_system: SOURCE_SYSTEM,
      source_meta: {
        job_number: sourceId,
        customer_name: customer,
        job_description: desc || null,
        job_status_raw: rawStatus || null,
        address_raw: address || null,
        created_raw: row['Job created date'] || null,
        scheduled_start_raw: row['Job scheduled start date'] || null,
        // Raw source string, kept alongside the parsed jobs.amount column.
        job_amount: row['Job amount'] || null,
      },
    },
  }
}

async function main() {
  const args = process.argv.slice(2)
  const commit = args.includes('--commit')
  const csvPath = args.find(a => !a.startsWith('--'))
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set.'); process.exit(1) }
  if (!csvPath || !fs.existsSync(csvPath)) { console.error(`CSV not found: ${csvPath}`); process.exit(1) }

  console.log(`[jobs] file: ${csvPath}`)
  console.log(`[jobs] mode: ${commit ? 'COMMIT (will insert)' : 'DRY RUN (no writes)'}\n`)

  const raw = parseCsv(fs.readFileSync(csvPath, 'utf8'))
  const records = toObjects(raw)
  console.log(`[jobs] ${raw[0].length} columns, ${records.length} data rows`)
  console.log('[jobs] headers:', raw[0].map(h => h.trim()).join(' | '))

  console.log(`\n[jobs] MAPPING (source -> jobs):
    Job # (="N" -> N)                    -> source_id  [DEDUPE KEY], source_system='${SOURCE_SYSTEM}'
    Customer name                        -> client_id  (matched on clients.name; NULL when unmatched)
    Job description                      -> name       (blank -> "Job #<n>", since jobs.name is NOT NULL)
    Job status                           -> status     (Completed/Scheduled/In progress/Needs scheduling
                                                        -> completed/scheduled/in_progress/pending)
    Address                              -> address    (blank -> NULL)
    Job created date                     -> created_at
    Job scheduled start date             -> scheduled_start_at (+ start_date), NULL when blank
    Job amount ("$1,234.56" -> numeric)  -> amount     (0.00 kept as 0.00; raw string also in source_meta)
    Full source row                      -> source_meta (JSONB)\n`)

  const mapped = records.map(mapRow)

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' || process.env.PGSSLMODE === 'require'
      ? { rejectUnauthorized: false } : false,
  })

  try {
    const { rows: clients } = await pool.query('SELECT id, name FROM clients')
    const byName = new Map()
    for (const c of clients) {
      const k = nameKey(c.name)
      if (!byName.has(k)) byName.set(k, [])
      byName.get(k).push(c.id)
    }

    // Existing source_ids so a re-run is a no-op.
    let existing = new Set()
    try {
      const { rows } = await pool.query(
        `SELECT source_id FROM jobs WHERE source_id = ANY($1)`,
        [mapped.map(m => m.sourceId).filter(Boolean)])
      existing = new Set(rows.map(r => String(r.source_id)))
    } catch (err) {
      if (err.code === '42703') console.log('[jobs] note: jobs.source_id does not exist yet — migration not applied. Treating all rows as new.\n')
      else throw err
    }

    const matched = [], unmatched = [], ambiguous = [], dupes = []
    for (const m of mapped) {
      if (m.sourceId && existing.has(String(m.sourceId))) { dupes.push(m); continue }
      const hit = byName.get(m.customerKey)
      if (!hit) { unmatched.push(m); m.payload.client_id = null; continue }
      // Deterministic tie-break: lowest client id wins. That is the older,
      // more established record -- and the one that received the Housecall
      // backfill during the customer import. Every choice is logged below.
      const sorted = [...hit].sort((a, b) => a - b)
      const chosen = sorted[0]
      if (sorted.length > 1) ambiguous.push({ m, ids: sorted, chosen })
      m.payload.client_id = chosen
      matched.push(m)
    }

    const noStatus = mapped.filter(m => m.unmappedStatus)
    const nullStart = mapped.filter(m => !m.payload.scheduled_start_at).length
    const fallbackName = mapped.filter(m => /^Job #\d+$/.test(m.payload.name)).length
    const nullAddr = mapped.filter(m => !m.payload.address).length

    console.log('========================= DRY-RUN SUMMARY =========================')
    console.log(`  total jobs in file:           ${records.length}`)
    console.log(`  MATCHED to a client:          ${matched.length}`)
    console.log(`  UNMATCHED (client_id NULL):   ${unmatched.length}`)
    console.log(`  already imported (skipped):   ${dupes.length}`)
    console.log(`  TOTAL to insert:              ${matched.length + unmatched.length}`)
    console.log('===================================================================')
    console.log(`  scheduled_start_at NULL (blank in source): ${nullStart}`)
    console.log(`  address NULL (blank in source):            ${nullAddr}`)
    console.log(`  name fell back to "Job #<n>":              ${fallbackName}`)
    console.log(`  unmapped status values:                    ${noStatus.length}`)
    console.log(`  ambiguous name matches (>1 client):        ${ambiguous.length}`)

    const st = {}
    for (const m of mapped) st[m.payload.status || '(unmapped)'] = (st[m.payload.status || '(unmapped)'] || 0) + 1
    console.log('\n[jobs] status mapping result:')
    Object.entries(st).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${String(k).padEnd(14)} ${v}`))

    const uniqUnmatched = [...new Set(unmatched.map(m => m.customer))].sort()
    console.log(`\n[jobs] UNMATCHED customer names (${uniqUnmatched.length} distinct, ${unmatched.length} jobs):`)
    uniqUnmatched.forEach(n => {
      const cnt = unmatched.filter(m => m.customer === n).length
      console.log(`   "${n}"  (${cnt} job${cnt === 1 ? '' : 's'})`)
    })

    const amounts = mapped.map(m => m.payload.amount).filter(a => a != null)
    const nonZero = amounts.filter(a => a > 0)
    console.log('\n[jobs] amount import:')
    console.log(`   rows with an amount:  ${amounts.length}`)
    console.log(`   non-zero:             ${nonZero.length}`)
    console.log(`   zero ($0.00):         ${amounts.length - nonZero.length}`)
    console.log(`   total:                $${amounts.reduce((a, b) => a + b, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    console.log(`   max single job:       $${Math.max(...amounts).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

    if (ambiguous.length) {
      console.log(`\n[jobs] AMBIGUOUS-MATCH LOG — ${ambiguous.length} jobs across ${new Set(ambiguous.map(a => a.m.customer)).size} customer names.`)
      console.log('   Lowest client id chosen. Review and correct any wrong ones after import.')
      console.log('   job#     customer                        candidates            chosen')
      console.log('   ' + '-'.repeat(88))
      const byCustomer = new Map()
      for (const a of ambiguous) {
        if (!byCustomer.has(a.m.customer)) byCustomer.set(a.m.customer, [])
        byCustomer.get(a.m.customer).push(a)
      }
      for (const [cust, list] of [...byCustomer.entries()].sort((x, y) => y[1].length - x[1].length)) {
        for (const a of list.sort((x, y) => Number(x.m.sourceId) - Number(y.m.sourceId))) {
          console.log(`   ${String(a.m.sourceId).padEnd(8)} ${cust.slice(0, 30).padEnd(31)} ${a.ids.join(',').padEnd(21)} ${a.chosen}`)
        }
      }
      const csv = ['job_number,customer_name,candidate_client_ids,chosen_client_id']
        .concat(ambiguous
          .sort((x, y) => Number(x.m.sourceId) - Number(y.m.sourceId))
          .map(a => `${a.m.sourceId},"${a.m.customer.replace(/"/g, '""')}","${a.ids.join(' ')}",${a.chosen}`))
        .join('\n')
      fs.writeFileSync('/Users/work/import-data/ambiguous-job-matches.csv', csv)
      console.log('\n   full log written: /Users/work/import-data/ambiguous-job-matches.csv')
    }

    console.log('\n[jobs] sample of first 5 mapped inserts:')
    ;[...matched, ...unmatched].slice(0, 5).forEach(m => {
      const p = m.payload
      console.log(`   #${p.source_id} "${p.name.slice(0, 42)}" | client=${p.client_id ?? 'NULL'} | ${p.status} | start=${p.scheduled_start_at ? p.scheduled_start_at.toISOString().slice(0, 16) : 'none'} | ${(p.address || '(no address)').slice(0, 40)}`)
    })

    if (!commit) {
      console.log('\n[jobs] DRY RUN complete — nothing was written.')
      return
    }

    const toInsert = [...matched, ...unmatched]
    console.log(`\n[jobs] COMMIT: inserting ${toInsert.length} jobs in one transaction…`)
    const client = await pool.connect()
    let inserted = 0
    try {
      await client.query('BEGIN')
      for (const m of toInsert) {
        const p = m.payload
        const res = await client.query(
          `INSERT INTO jobs
             (name, client_id, address, status, created_at, start_date,
              scheduled_start_at, amount, source_id, source_system, source_meta)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (source_id) WHERE source_id IS NOT NULL DO NOTHING`,
          [p.name, p.client_id ?? null, p.address, p.status, p.created_at, p.start_date,
           p.scheduled_start_at, p.amount, p.source_id, p.source_system, JSON.stringify(p.source_meta)],
        )
        inserted += res.rowCount
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('[jobs] insert failed — rolled back. No rows written.')
      throw err
    } finally { client.release() }
    console.log(`\n[jobs] DONE — inserted ${inserted}.`)
  } finally { await pool.end() }
}

import { fileURLToPath } from 'node:url'
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  main().catch(err => {
    console.error('[jobs] failed:', err.message)
    if (err.code) console.error('[jobs] pg code:', err.code)
    process.exit(1)
  })
}

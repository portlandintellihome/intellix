// One-off importer for the Housecall Pro-style customer export.
//
//   DRY RUN (default — reads DB read-only, inserts NOTHING):
//     DATABASE_URL="<public-url>" PGSSLMODE=require \
//       node server/scripts/import-clients.js ~/Desktop/Intellihome_customer_export.csv
//
//   COMMIT (wraps all inserts in a single transaction):
//     DATABASE_URL="<public-url>" PGSSLMODE=require \
//       node server/scripts/import-clients.js ~/Desktop/Intellihome_customer_export.csv --commit
//
// Scope: clients only. There are NO per-job records in this file, so the jobs
// table is never touched. Idempotent: dedupes on clients.source_id (the
// Housecall Pro customer ID) first, then name+phone, so re-running never
// creates duplicates. Skips obvious test/internal rows and lists them.

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const { Pool } = pg
const SOURCE_SYSTEM = 'housecall_pro'
const DEFAULT_CSV = path.join(process.env.HOME || '', 'Desktop', 'Intellihome_customer_export.csv')

// Test/internal records to skip. Matched case-insensitively against the display
// name; the info@ email is skipped regardless of name. 'Nima Namakian' (a real
// full name / likely the owner) is intentionally NOT in this list — all
// nima-matching rows are printed so they can be eyeballed.
const TEST_NAME_BLOCKLIST = new Set(['nima pro', 'nima n', 'nima', 'nima office'])
const TEST_EMAILS = new Set(['info@getintellihome.com'])

// --- tiny RFC4180-ish CSV parser (no dependency) ---------------------------
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  // Strip a UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else field += c
  }
  // Trailing field/row (file not ending in newline).
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

function toObjects(rows) {
  const headers = rows[0].map(h => h.trim())
  return rows.slice(1)
    .filter(r => r.some(v => (v || '').trim() !== '')) // drop fully-blank lines
    .map(r => {
      const o = {}
      headers.forEach((h, i) => { o[h] = r[i] != null ? r[i] : '' })
      return o
    })
}

// --- field coercion --------------------------------------------------------

// Phones export as scientific-notation floats in some Housecall exports
// (e.g. "3.104098e+09"); this file has clean strings, but coerce defensively.
function cleanPhone(raw) {
  if (raw == null) return ''
  let s = String(raw).trim()
  if (!s) return ''
  if (/e\+?\d+/i.test(s) && !Number.isNaN(Number(s))) s = Number(s).toFixed(0)
  const digits = s.replace(/\D/g, '')
  return digits.length >= 7 ? digits : ''
}

function cleanEmail(raw) {
  const s = String(raw || '').trim()
  return s && s.includes('@') ? s.toLowerCase() : ''
}

function parseMoney(raw) {
  if (raw == null) return null
  const n = Number(String(raw).replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseDate(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function truthy(raw) {
  return String(raw || '').trim().toLowerCase() === 'true'
}

function buildAddress(row, n) {
  const street1 = (row[`Address_${n} Street Line 1`] || '').trim()
  const street2 = (row[`Address_${n} Street Line 2`] || '').trim()
  const city = (row[`Address_${n} City`] || '').trim()
  const state = (row[`Address_${n} State`] || '').trim()
  const zip = (row[`Address_${n} Postal Code`] || '').trim()
  if (!street1 && !city && !state && !zip) return null
  const line1 = [street1, street2].filter(Boolean).join(' ')
  const line2 = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return {
    text: [line1, line2].filter(Boolean).join(', '),
    billing: truthy(row[`Address_${n} Billing?`]),
    state,
  }
}

// Map one CSV row to a clients insert payload (or a skip reason).
function mapRow(row) {
  const first = (row['First Name'] || '').trim()
  const last = (row['Last Name'] || '').trim()
  const display = (row['Display Name'] || '').trim()
  const name = display || [first, last].filter(Boolean).join(' ').trim()
  const email = cleanEmail(row['Email'])
  const nameKey = name.toLowerCase()

  // --- skip rules ---
  if (!name) return { skip: 'no-name' }
  if (TEST_EMAILS.has(email)) return { skip: 'test-record', reason: `email ${email}` }
  if (TEST_NAME_BLOCKLIST.has(nameKey)) return { skip: 'test-record', reason: `placeholder name "${name}"` }

  const sourceId = (row['ID'] || '').trim()
  const mobile = cleanPhone(row['Mobile Number'])
  const home = cleanPhone(row['Home Number'])
  const work = cleanPhone(row['Work Number'])
  const phone = mobile || home || work || ''

  const addresses = [1, 2, 3].map(n => buildAddress(row, n)).filter(Boolean)
  const primary = addresses.find(a => a.billing) || addresses[0] || null
  const extraAddresses = addresses.filter(a => a !== primary)

  const additionalEmails = (row['Additional Emails'] || '').trim()
  const notesParts = []
  if ((row['Notes'] || '').trim()) notesParts.push(row['Notes'].trim())
  if (home) notesParts.push(`Home phone: ${home}`)
  if (work) notesParts.push(`Work phone: ${work}`)
  if (additionalEmails) notesParts.push(`Additional emails: ${additionalEmails}`)
  extraAddresses.forEach((a, i) => notesParts.push(`Additional address ${i + 1}: ${a.text}`))
  const notes = notesParts.join('\n')

  const doNotService = truthy(row['Do Not Service'])
  const notificationsEnabled = String(row['Customer notifications enabled'] || '').trim().toLowerCase() !== 'false'
  // Respect the source's consent + do-not-service flags as an SMS opt-out.
  const smsOptOut = doNotService || !notificationsEnabled

  // Infer location from the primary address state: CA -> Los Angeles(2), else Portland(1).
  const state = (primary?.state || '').toUpperCase()
  const locationId = state === 'CA' ? 2 : 1

  const sourceMeta = {
    housecall_id: sourceId,
    first_name: first, last_name: last,
    role: (row['Role'] || '').trim() || null,
    company: (row['Company'] || '').trim() || null,
    customer_type: (row['Customer Type'] || '').trim() || null,
    lead_source: (row['Lead Source'] || '').trim() || null,
    is_contractor: truthy(row['Customer is Contractor']),
    notifications_enabled: notificationsEnabled,
    do_not_service: doNotService,
    tags: (row['Tags'] || '').trim() || null,
    created_at_source: (row['Customer created at'] || '').trim() || null,
    mobile, home, work,
    email, additional_emails: additionalEmails || null,
    addresses: addresses.map(a => a.text),
  }

  return {
    payload: {
      name,
      email: email || null,
      phone: phone || null,
      address: primary?.text || null,
      since: (row['Customer created at'] || '').trim() || null,
      status: doNotService ? 'Inactive' : 'Active',
      notes: notes || null,
      location_id: locationId,
      sms_opt_out: smsOptOut,
      source_id: sourceId || null,
      source_system: SOURCE_SYSTEM,
      company: (row['Company'] || '').trim() || null,
      lead_source: (row['Lead Source'] || '').trim() || null,
      customer_type: (row['Customer Type'] || '').trim() || null,
      lifetime_value: parseMoney(row['Lifetime value']),
      last_service_date: parseDate(row['Last service date']),
      source_meta: sourceMeta,
    },
    dedupeKey: sourceId,
    nameKey,
    phone,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const commit = args.includes('--commit')
  const csvPath = args.find(a => !a.startsWith('--')) || DEFAULT_CSV

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Example:')
    console.error('  DATABASE_URL="<DATABASE_PUBLIC_URL>" PGSSLMODE=require \\')
    console.error('    node server/scripts/import-clients.js <csv> [--commit]')
    process.exit(1)
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`)
    process.exit(1)
  }

  console.log(`[import] file: ${csvPath}`)
  console.log(`[import] mode: ${commit ? 'COMMIT (will insert)' : 'DRY RUN (no writes)'}\n`)

  const rawRows = parseCsv(fs.readFileSync(csvPath, 'utf8'))
  const records = toObjects(rawRows)
  const headers = rawRows[0].map(h => h.trim())

  console.log(`[import] ${headers.length} columns, ${records.length} data rows`)
  console.log('[import] headers:', headers.join(' | '))
  console.log('\n[import] first 3 rows (raw):')
  records.slice(0, 3).forEach((r, i) => {
    console.log(`  --- row ${i + 1} ---`)
    console.log(`    Display Name: ${r['Display Name']} | Mobile: ${r['Mobile Number']} | Email: ${r['Email']} | ID: ${r['ID']} | LTV: ${r['Lifetime value']} | Addr1: ${r['Address_1 Street Line 1']}, ${r['Address_1 City']} ${r['Address_1 State']}`)
  })

  console.log(`\n[import] MAPPING (source -> clients):
    Display Name / First+Last            -> name
    Email (+ Additional Emails in notes) -> email
    Mobile > Home > Work (cleaned)       -> phone   (home/work also in notes + source_meta)
    Address w/ Billing?=true, else #1    -> address (extras in notes + source_meta)
    ID (Housecall customer id)           -> source_id  [DEDUPE KEY], source_system='housecall_pro'
    Company / Lead Source / Customer Type-> company / lead_source / customer_type
    Lifetime value ($ -> numeric)        -> lifetime_value
    Last service date (ISO -> date)      -> last_service_date
    Customer created at                  -> since
    Do Not Service=true                  -> status='Inactive' + sms_opt_out=true
    Customer notifications enabled=false -> sms_opt_out=true
    Address state CA -> location 2 (LA), else 1 (Portland)
    Full source row                      -> source_meta (JSONB, nothing lost)\n`)

  // Map + partition.
  const mapped = []
  const testSkips = []
  const noNameSkips = []
  for (const row of records) {
    const m = mapRow(row)
    if (m.skip === 'no-name') { noNameSkips.push(row); continue }
    if (m.skip === 'test-record') { testSkips.push({ name: (row['Display Name'] || '').trim(), id: row['ID'], reason: m.reason }); continue }
    mapped.push(m)
  }

  // Dedupe within the file on source_id (keep first).
  const seen = new Set()
  const deduped = []
  let intraFileDupes = 0
  for (const m of mapped) {
    const key = m.dedupeKey || `${m.nameKey}|${m.phone}`
    if (seen.has(key)) { intraFileDupes++; continue }
    seen.add(key)
    deduped.push(m)
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' || process.env.PGSSLMODE === 'require'
      ? { rejectUnauthorized: false } : false,
  })

  try {
    // Existing dedupe: by source_id, and by name+phone as a secondary check.
    const sourceIds = deduped.map(m => m.dedupeKey).filter(Boolean)
    const existingBySource = new Set()
    if (sourceIds.length) {
      const { rows } = await pool.query(
        'SELECT source_id FROM clients WHERE source_id = ANY($1)', [sourceIds])
      rows.forEach(r => existingBySource.add(String(r.source_id)))
    }
    const { rows: allExisting } = await pool.query(
      `SELECT lower(name) AS name, regexp_replace(COALESCE(phone,''),'\\D','','g') AS phone FROM clients`)
    const existingNamePhone = new Set(allExisting.map(r => `${r.name}|${r.phone}`))

    const toInsert = []
    let dupExisting = 0
    for (const m of deduped) {
      if (m.dedupeKey && existingBySource.has(String(m.dedupeKey))) { dupExisting++; continue }
      if (existingNamePhone.has(`${m.nameKey}|${m.phone}`)) { dupExisting++; continue }
      toInsert.push(m)
    }

    // --- summary ---
    console.log('========================= DRY-RUN SUMMARY =========================')
    console.log(`  data rows in file:            ${records.length}`)
    console.log(`  skipped — no name:            ${noNameSkips.length}`)
    console.log(`  skipped — test/internal:      ${testSkips.length}`)
    console.log(`  skipped — duplicate in file:  ${intraFileDupes}`)
    console.log(`  skipped — already in DB:      ${dupExisting}`)
    console.log(`  NEW clients to insert:        ${toInsert.length}`)
    console.log('===================================================================')

    if (testSkips.length) {
      console.log('\n[import] test/internal rows skipped (eyeball these):')
      testSkips.forEach(t => console.log(`   - id=${t.id}  "${t.name}"  (${t.reason})`))
    }
    // Show all rows mentioning "nima" that we are KEEPING, so they can be reviewed.
    const nimaKept = toInsert.filter(m => m.payload.name.toLowerCase().includes('nima'))
    if (nimaKept.length) {
      console.log('\n[import] "nima"-matching rows we are KEEPING (not treated as test):')
      nimaKept.forEach(m => console.log(`   - id=${m.dedupeKey}  "${m.payload.name}"  ${m.payload.phone || '(no phone)'}`))
    }

    console.log('\n[import] sample of first 5 mapped inserts:')
    toInsert.slice(0, 5).forEach(m => {
      const p = m.payload
      console.log(`   - "${p.name}" | ${p.phone || '(no phone)'} | ${p.email || '(no email)'} | loc=${p.location_id} | LTV=${p.lifetime_value ?? '-'} | opt_out=${p.sms_opt_out} | src=${p.source_id}`)
    })

    if (!commit) {
      console.log('\n[import] DRY RUN complete — nothing was written. Re-run with --commit to insert.')
      return
    }

    // --- COMMIT: single transaction ---
    console.log(`\n[import] COMMIT: inserting ${toInsert.length} clients in one transaction…`)
    const client = await pool.connect()
    let inserted = 0
    try {
      await client.query('BEGIN')
      for (const m of toInsert) {
        const p = m.payload
        // ON CONFLICT on the partial unique index (source_id) is the final
        // idempotency backstop even under a concurrent/re-run.
        const res = await client.query(
          `INSERT INTO clients
             (name, email, phone, address, since, status, notes, location_id,
              sms_opt_out, source_id, source_system, company, lead_source,
              customer_type, lifetime_value, last_service_date, source_meta)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           ON CONFLICT (source_id) WHERE source_id IS NOT NULL DO NOTHING`,
          [p.name, p.email, p.phone, p.address, p.since, p.status, p.notes, p.location_id,
           p.sms_opt_out, p.source_id, p.source_system, p.company, p.lead_source,
           p.customer_type, p.lifetime_value, p.last_service_date, JSON.stringify(p.source_meta)],
        )
        inserted += res.rowCount
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('[import] insert failed — rolled back. No rows written.')
      throw err
    } finally {
      client.release()
    }
    console.log(`\n[import] DONE — inserted ${inserted}, skipped ${deduped.length - toInsert.length + testSkips.length + noNameSkips.length} (dupes/test/no-name).`)
  } finally {
    await pool.end()
  }
}

// Only auto-run when invoked directly (not when imported for testing the pure
// parse/map helpers).
import { fileURLToPath } from 'node:url'
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) {
  main().catch(err => {
    console.error('[import] failed:', err.message)
    if (err.code) console.error('[import] pg code:', err.code)
    process.exit(1)
  })
}

export { parseCsv, toObjects, mapRow, cleanPhone, parseMoney, parseDate }

import 'dotenv/config'
import bcrypt from 'bcrypt'
import pg from 'pg'

const { Pool } = pg
const BCRYPT_ROUNDS = 10

async function main() {
  const [emailArg, password] = process.argv.slice(2)
  if (!emailArg || !password) {
    console.error('Usage: node server/scripts/reset-password.js <email> <new_password>')
    console.error('       npm run reset-password -- <email> <new_password>')
    process.exit(2)
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Use the Railway public URL, e.g.:')
    console.error('  DATABASE_URL="<DATABASE_PUBLIC_URL>" PGSSLMODE=require \\')
    console.error('    npm run reset-password -- <email> "<new_password>"')
    process.exit(1)
  }

  const email = emailArg.toLowerCase()

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' || process.env.PGSSLMODE === 'require'
      ? { rejectUnauthorized: false }
      : false,
  })

  try {
    console.log(`[reset-password] hashing new password (cost ${BCRYPT_ROUNDS})…`)
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    console.log(`[reset-password] updating users where lower(email) = '${email}'`)
    const { rows: updated } = await pool.query(
      `UPDATE users
       SET password_hash = $1,
           must_change_password = FALSE
       WHERE lower(email) = $2
       RETURNING id, name, email, role, must_change_password`,
      [hash, email]
    )

    if (updated.length === 0) {
      console.error(`[reset-password] no user found with email ${email}`)
      process.exit(1)
    }
    if (updated.length > 1) {
      console.warn(`[reset-password] WARNING: ${updated.length} rows updated`)
    }

    console.log('[reset-password] updated row:')
    console.table(updated)

    // Verification SELECT — confirms the row independently of the UPDATE's RETURNING.
    const { rows: verify } = await pool.query(
      `SELECT id, name, email, role, must_change_password, created_at
       FROM users
       WHERE lower(email) = $1`,
      [email]
    )
    console.log('[reset-password] verification SELECT:')
    console.table(verify)

    console.log('[reset-password] done — sign in with the new password.')
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error('[reset-password] failed:', err.message)
  if (err.code) console.error('[reset-password] pg code:', err.code)
  process.exit(1)
})

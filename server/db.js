import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set — database queries will fail until it is configured.')
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export const query = (text, params) => pool.query(text, params)

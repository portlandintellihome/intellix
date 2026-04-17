import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'

import authRouter from './routes/auth.js'
import jobsRouter from './routes/jobs.js'
import clientsRouter from './routes/clients.js'
import ticketsRouter from './routes/tickets.js'
import inventoryRouter from './routes/inventory.js'
import teamRouter from './routes/team.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '..', 'dist')

const app = express()
const PORT = process.env.PORT

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRouter)
app.use('/api/jobs', jobsRouter)
app.use('/api/clients', clientsRouter)
app.use('/api/tickets', ticketsRouter)
app.use('/api/inventory', inventoryRouter)
app.use('/api/team', teamRouter)

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.method !== 'GET') return next()
    res.sendFile(path.join(distDir, 'index.html'))
  })
} else {
  console.warn('dist/ not found — run `npm run build` to serve the frontend.')
}

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Intellix listening on http://localhost:${PORT}`)
})

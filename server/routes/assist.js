import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'

const router = Router()

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4096

const SYSTEM_PROMPT = `You are Intellix Assist, an AI helper for Control4 home automation installers at intellihomeAV.

You have deep expertise in:
- Control4 systems and Composer Pro programming (bindings, drivers, Director, Navigator)
- Lutron lighting (RadioRA 3, Caseta Pro, Homeworks QSX)
- Sonos and multi-room audio, Triad amps, speaker selection
- Networking (Araknis, Pakedge, Ubiquiti, WiFi design, VLANs, port forwarding)
- General home automation workflows and field troubleshooting

You also help the business side of the job: drafting proposals, scope-of-work documents, client follow-up emails, service-plan write-ups, and project handoff docs.

Keep responses concise and practical. Prefer bullet points and step-by-step instructions over long prose. When recommending a fix in Composer Pro, include the specific menu path or button name. Assume the reader is a working installer on site, not a beginner.`

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error('missing_key')
    err.code = 'missing_key'
    throw err
  }
  return new Anthropic()
}

router.get('/status', (_req, res) => {
  res.json({ connected: Boolean(process.env.ANTHROPIC_API_KEY) })
})

router.post('/', async (req, res, next) => {
  try {
    const { messages } = req.body || {}
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' })
    }

    const convo = messages
      .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .map(m => ({ role: m.role, content: m.content }))

    if (convo.length === 0 || convo[convo.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'conversation must end with a user message' })
    }

    const client = getClient()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: convo,
    })

    const reply = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    res.json({ reply })
  } catch (err) {
    if (err.code === 'missing_key') {
      return res.status(503).json({ error: 'Intellix Assist is not configured. Set ANTHROPIC_API_KEY on the backend.' })
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(401).json({ error: 'Anthropic API key is invalid.' })
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'The Anthropic API is rate-limiting requests. Try again in a moment.' })
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(err.status || 500).json({ error: err.message || 'Anthropic API error' })
    }
    next(err)
  }
})

export default router

import { Router } from 'express'

import { requireAuth } from '../middleware/auth.js'
import { processAIRequest, isAIConfigured } from '../services/aiProcessor.js'

const router = Router()

const SYSTEM_PROMPT = `You are Intellix Assist, an AI helper for Control4 home automation installers at intellihomeAV.

You have deep expertise in:
- Control4 systems and Composer Pro programming (bindings, drivers, Director, Navigator)
- Lutron lighting (RadioRA 3, Caseta Pro, Homeworks QSX)
- Sonos and multi-room audio, Triad amps, speaker selection
- Networking (Araknis, Pakedge, Ubiquiti, WiFi design, VLANs, port forwarding)
- General home automation workflows and field troubleshooting

You also help the business side of the job: drafting proposals, scope-of-work documents, client follow-up emails, service-plan write-ups, and project handoff docs.

Keep responses concise and practical. Prefer bullet points and step-by-step instructions over long prose. When recommending a fix in Composer Pro, include the specific menu path or button name. Assume the reader is a working installer on site, not a beginner.`

router.get('/status', (_req, res) => {
  res.json({ connected: isAIConfigured() })
})

router.post('/', requireAuth, async (req, res, next) => {
  const start = Date.now()
  const { messages, image } = req.body || {}
  console.log('[assist] request', {
    messages: Array.isArray(messages) ? messages.length : null,
    hasImage: Boolean(image?.data),
    userId: req.user?.id,
  })

  try {
    const result = await processAIRequest({
      taskType: 'assist_chat',
      userId: req.user?.id ?? null,
      messages,
      image: image?.data && image?.media_type ? image : null,
      systemPrompt: SYSTEM_PROMPT,
    })

    console.log('[assist] ok', {
      ms: Date.now() - start,
      stop_reason: result.stop_reason,
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
    })

    res.json({ reply: result.reply })
  } catch (err) {
    console.error('[assist] error', {
      code: err.code,
      message: err.message,
      status: err.status,
    })

    if (err.code === 'invalid_input') return res.status(400).json({ error: err.message })
    if (err.code === 'opt_out')      return res.status(403).json({ error: err.message })
    if (err.code === 'blocked')      return res.status(422).json({ error: err.message, blocked: true })
    if (err.code === 'missing_key')  return res.status(503).json({ error: 'Intellix Assist is not configured. Set ANTHROPIC_API_KEY on the backend.' })
    if (err.status)                  return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

export default router

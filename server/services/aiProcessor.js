// Central AI gateway. Every Claude call in Intellix routes through here so
// we have one place that:
//   - Holds the ANTHROPIC_API_KEY (no other module imports the SDK directly)
//   - Enforces the per-client ai_opt_out flag
//   - Runs the hard-block PII guard on every user-supplied input
//   - Writes an audit row to ai_interactions for every attempt (success,
//     refused, error)
//
// Public API:
//   processAIRequest({ taskType, userId, clientId?, jobId?, ticketId?,
//                       prompt? | messages?, systemPrompt?, model? }) → { reply, usage }
//   isAIConfigured() → boolean
//
// Errors:
//   throws Error with .code in { 'opt_out', 'blocked', 'missing_key',
//                                 'invalid_input', 'upstream' }

import Anthropic from '@anthropic-ai/sdk'
import { query as defaultQuery } from '../db.js'
import { guardPII } from './redactor.js'

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4096

export function isAIConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

function makeError(code, message, status) {
  const err = new Error(message)
  err.code = code
  if (status) err.status = status
  return err
}

async function logInteraction(queryFn, row) {
  try {
    await queryFn(
      `INSERT INTO ai_interactions
         (user_id, task_type, client_id, job_id, ticket_id,
          redacted_prompt, raw_response, model,
          tokens_input, tokens_output, status, error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        row.userId ?? null,
        row.taskType,
        row.clientId ?? null,
        row.jobId ?? null,
        row.ticketId ?? null,
        row.prompt ?? null,
        row.response ?? null,
        row.model ?? null,
        row.tokensInput ?? null,
        row.tokensOutput ?? null,
        row.status,
        row.errorMessage ?? null,
      ],
    )
  } catch (logErr) {
    // Never let an audit-log failure break the user-facing request.
    console.error('[aiProcessor] failed to write audit row', logErr)
  }
}

export async function processAIRequest(opts, deps = {}) {
  const queryFn = deps.queryFn || defaultQuery
  const anthropicClient = deps.anthropic // injected client for tests

  const {
    taskType,
    userId = null,
    clientId = null,
    jobId = null,
    ticketId = null,
    prompt = null,
    messages = null,
    systemPrompt = null,
    model = DEFAULT_MODEL,
    image = null, // optional { media_type, data } base64 image for vision
    skipPiiGuard = false, // bypass the hard-block PII guard (see below)
    maxTokens = MAX_TOKENS,
  } = opts || {}

  if (!taskType) throw makeError('invalid_input', 'taskType is required', 400)

  // Normalize input into a messages[] array for Anthropic.
  let convo
  let invalidReason = null
  if (Array.isArray(messages) && messages.length > 0) {
    convo = messages
      .filter(m => (m.role === 'user' || m.role === 'assistant')
        && typeof m.content === 'string' && m.content.trim())
      .map(m => ({ role: m.role, content: m.content }))
    if (convo.length === 0 || convo[convo.length - 1].role !== 'user') {
      invalidReason = 'conversation must end with a user message'
    }
  } else if (typeof prompt === 'string' && prompt.trim()) {
    convo = [{ role: 'user', content: prompt }]
  } else {
    invalidReason = 'prompt or messages is required'
  }
  if (invalidReason) {
    await logInteraction(queryFn, {
      userId, taskType, clientId, jobId, ticketId,
      prompt: convo ? combinedText(convo) : null,
      model,
      status: 'invalid_input',
      errorMessage: invalidReason,
    })
    throw makeError('invalid_input', invalidReason, 400)
  }

  // Per-client opt-out: refuse before anything else.
  if (clientId != null) {
    const r = await queryFn('SELECT ai_opt_out FROM clients WHERE id = $1', [clientId])
    if (r.rows[0]?.ai_opt_out) {
      await logInteraction(queryFn, {
        userId, taskType, clientId, jobId, ticketId,
        prompt: combinedText(convo),
        model,
        status: 'refused_opt_out',
        errorMessage: 'Client has opted out of AI processing',
      })
      throw makeError('opt_out', 'This client has opted out of AI processing.', 403)
    }
  }

  // Hard-block PII guard on every user-authored message in the convo.
  // Customer-document generation sets skipPiiGuard: the client's name, phone,
  // email and address ARE the document's required content (not stray PII
  // leaking into a chat), so guarding them would block the feature. The
  // per-client opt-out + audit logging above still apply.
  for (const m of (skipPiiGuard ? [] : convo)) {
    if (m.role !== 'user') continue
    const guard = guardPII(m.content)
    if (guard.blocked) {
      await logInteraction(queryFn, {
        userId, taskType, clientId, jobId, ticketId,
        prompt: combinedText(convo),
        model,
        status: 'blocked',
        errorMessage: guard.blockReason,
      })
      throw makeError('blocked', guard.blockReason, 422)
    }
  }

  if (!isAIConfigured() && !anthropicClient) {
    await logInteraction(queryFn, {
      userId, taskType, clientId, jobId, ticketId,
      prompt: combinedText(convo),
      model,
      status: 'missing_key',
      errorMessage: 'ANTHROPIC_API_KEY is not configured on the backend',
    })
    throw makeError('missing_key', 'AI is not configured. Set ANTHROPIC_API_KEY on the backend.', 503)
  }

  const client = anthropicClient || new Anthropic()

  // Build the Anthropic payload from the validated string convo. When an
  // image is attached, the final user turn becomes a multimodal content
  // array (text + image block). convo stays string-only so validation, the
  // PII guard, and audit logging above are unaffected. Images are NOT
  // redacted — Claude vision sees whatever the user chose to attach.
  let apiMessages = convo
  if (image?.data && image?.media_type) {
    const lastUserIdx = convo.length - 1
    apiMessages = convo.map((m, i) => {
      if (i !== lastUserIdx || m.role !== 'user') return m
      return {
        role: 'user',
        content: [
          ...(m.content ? [{ type: 'text', text: m.content }] : []),
          { type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } },
        ],
      }
    })
  }

  let response
  try {
    response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages: apiMessages,
    })
  } catch (err) {
    await logInteraction(queryFn, {
      userId, taskType, clientId, jobId, ticketId,
      prompt: combinedText(convo),
      model,
      status: 'error',
      errorMessage: err?.message || 'unknown upstream error',
    })
    err.code = err.code || 'upstream'
    throw err
  }

  const reply = (response.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')

  await logInteraction(queryFn, {
    userId, taskType, clientId, jobId, ticketId,
    prompt: combinedText(convo),
    response: reply,
    model,
    tokensInput: response.usage?.input_tokens ?? null,
    tokensOutput: response.usage?.output_tokens ?? null,
    status: 'ok',
  })

  return {
    reply,
    usage: {
      input_tokens: response.usage?.input_tokens ?? null,
      output_tokens: response.usage?.output_tokens ?? null,
    },
    stop_reason: response.stop_reason,
  }
}

function combinedText(convo) {
  return convo.map(m => `${m.role}: ${m.content}`).join('\n\n')
}

// ---------------------------------------------------------------------------
// Customer document generation
// ---------------------------------------------------------------------------

const INTELLIHOME_CONTACT =
  'IntelliHome AV — Portland (503) 500-0180 · Los Angeles (310) 409-7655 · info@intellihomeav.com'

const DOC_SYSTEM_PROMPTS = {
  handover_guide:
    'You are writing a polished, friendly system handover document for a homeowner from ' +
    'IntelliHome AV, a Control4 dealer. The tone is warm, professional, and clear — assume the ' +
    'reader is not technical. The document should welcome them to their new system, summarize ' +
    'what was installed, explain how to use the key features in plain language, and provide ' +
    'guidance on getting support. Format the response as clean semantic HTML (no markdown, no ' +
    '<html>/<head>/<body> wrapper — just the content elements). Use <h1>, <h2>, <p>, <ul>, etc. ' +
    'Include sections for: Welcome, Your System Overview, How to Use It, Common Scenarios, ' +
    'Care & Maintenance, and Getting Help (with IntelliHome AV contact info). The document is ' +
    'meant to be printed/downloaded as a PDF so it should read well as a single document, not as ' +
    'a web page. Do not invent equipment or features that are not supported by the details given.',
  quick_reference:
    'You are creating a one-page quick reference card for a homeowner — printable, scannable, ' +
    'focused on the most useful day-to-day information. Format as clean HTML (no markdown, no ' +
    '<html>/<head>/<body> wrapper) designed to fit on one printed page. Use a compact layout ' +
    'where appropriate. Include only essential information: lighting scenes (if any), AV system ' +
    'basics, security/thermostat shortcuts, and an emergency contact for IntelliHome AV. Avoid ' +
    'lengthy explanations — this is a fridge-magnet style reference, not a manual. Use <h2> for ' +
    'section headers, <ul> or <table> for entries, keep total content tight. Only include the ' +
    'most-used commands and shortcuts; omit anything not clearly supported by the details given.',
}

export const DOC_TYPES = Object.keys(DOC_SYSTEM_PROMPTS)

// Build the user message that carries all the context the model needs.
function buildDocUserMessage(form = {}, detailsText = '') {
  const techs = Array.isArray(form.technicians)
    ? form.technicians.join(', ')
    : (form.technicians || '')
  const lines = [
    'Generate the document using the following information.',
    '',
    `Client: ${form.client_name || '(unknown)'}`,
    `Site address: ${form.address || '(not provided)'}`,
    `Install date: ${form.install_date || '(not provided)'}`,
    `Primary contact: ${form.contact_name || '(not provided)'}` +
      `${form.phone ? ` · ${form.phone}` : ''}${form.email ? ` · ${form.email}` : ''}`,
    `Installed by: ${techs || '(not provided)'}`,
    `Dealer contact to include in the document: ${INTELLIHOME_CONTACT}`,
    '',
    'Installation & configuration details from the technician (the source of truth — base the ',
    'document on this; do not fabricate beyond it):',
    '"""',
    detailsText || '(no details provided)',
    '"""',
  ]
  return lines.join('\n')
}

// generateDocument(docType, { form_data, details_text }, deps?) → { html, usage }
// Routes through processAIRequest so per-client opt-out + audit logging apply,
// with skipPiiGuard since the customer's own contact details are the document
// content. Vision is intentionally not used (text in, HTML out).
export async function generateDocument(docType, payload = {}, deps = {}) {
  const system = DOC_SYSTEM_PROMPTS[docType]
  if (!system) {
    throw makeError('invalid_input', `Unknown doc_type "${docType}". Expected one of: ${DOC_TYPES.join(', ')}`, 400)
  }
  const { form_data = {}, details_text = '', userId = null, clientId = null, jobId = null } = payload

  const result = await processAIRequest({
    taskType: `homedoc_${docType}`,
    userId, clientId, jobId,
    systemPrompt: system,
    prompt: buildDocUserMessage(form_data, details_text),
    skipPiiGuard: true,
    maxTokens: 4096,
  }, deps)

  return { html: result.reply, usage: result.usage }
}

// ---------------------------------------------------------------------------
// AI-personalized post-job check-in email
// ---------------------------------------------------------------------------

const CHECKIN_TONES = {
  warm: 'warm and casual — like a friendly text from someone who genuinely cares',
  professional: 'professional and polished — courteous and concise, still human',
}

function firstNameOf(fullName) {
  if (!fullName) return 'there'
  return String(fullName).trim().split(/\s+/)[0] || 'there'
}

const CHECKIN_SYSTEM_PROMPT =
  'You are writing a follow-up email from IntelliHome AV (a Control4 dealer) to a customer about ' +
  'a day after their installation. The tone is warm, brief, and human — not a corporate template. ' +
  'Reference what was installed (from the job notes/details provided), thank them by first name, and ' +
  'invite them to leave a Google review at the provided link. Keep it under 150 words. Do NOT write ' +
  '"Dear [Customer]" — use natural phrasing like "Hi {first_name},". ' +
  // (1) No emojis.
  'Do not use any emojis, emoticons, or decorative symbols anywhere in the email. The email should ' +
  'read as a clean, human-written follow-up. ' +
  // (2) No character-level formatting; only the CTA button may carry styling.
  'Do not use bold, italic, underline, or any character-level formatting in the body text. The only ' +
  'HTML allowed for styling is the CTA button at the bottom (a "Leave Us a Review" link). All other ' +
  'content must be plain paragraphs (<p> tags only) — no <strong>, <b>, <em>, <i>, <u>, <h1>-<h6>, ' +
  'or <ul>/<li>. ' +
  // (3) Per-location sign-off — handled by the user message which supplies the
  // single correct location's contact info; reinforce single-office rule here.
  'Sign the email with IntelliHome AV\'s contact info for the ONE location provided in the user ' +
  'message only — do not reference, mention, or list any other office, city, or phone number. ' +
  'Format as email-safe HTML (inline styles only; no <html>/<head>/<body> wrapper, no markdown). ' +
  'Return ONLY a JSON object: {"subject": "...", "html_body": "..."} with no surrounding prose or ' +
  'code fences. Do not invent installed equipment beyond the details given.'

// Build the user message from the job/client context. The single correct
// location (the one that did the install) supplies the only contact info that
// should appear in the sign-off — never the global multi-office string.
function buildCheckinUserMessage({ client = {}, job = {}, location = {}, days_since_install, tone }) {
  const toneDesc = CHECKIN_TONES[tone] || CHECKIN_TONES.warm
  const locName = location.name ? `IntelliHome AV ${location.name}` : 'IntelliHome AV'
  const signoff = [
    `Sign the email with this ONE location's contact info only — ${locName}`,
    location.phone ? `, phone ${location.phone}` : '',
    location.email ? `, email ${location.email}` : '',
    '. Do not reference any other office or location.',
  ].join('')
  return [
    `Desired tone: ${toneDesc}.`,
    '',
    `Customer first name: ${firstNameOf(client.name)}`,
    `Customer full name: ${client.name || '(unknown)'}`,
    `Install address: ${client.address || job.address || '(not provided)'}`,
    `Days since install: ${days_since_install ?? '(about 1)'}`,
    `Technicians: ${Array.isArray(job.technicians) ? job.technicians.join(', ') : (job.assigned ? [].concat(job.assigned).join(', ') : '(not provided)')}`,
    `Google review link to embed: ${location.google_review_url || '(none provided — omit the review button if blank)'}`,
    signoff,
    '',
    'What was installed / job notes (base the email on this; do not fabricate beyond it):',
    '"""',
    [job.name, job.scope, job.details, job.notes].filter(Boolean).join('\n') || '(no details provided)',
    '"""',
  ].join('\n')
}

// Strip accidental code fences and parse the JSON the model returns.
function parseCheckinJson(reply) {
  let s = String(reply || '').trim()
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try {
    const obj = JSON.parse(s)
    if (obj && typeof obj.subject === 'string' && typeof obj.html_body === 'string') return obj
  } catch { /* fall through */ }
  return null
}

// generateCheckinEmail({ client, job, location, days_since_install, tone }, deps?)
//   → { subject, html_body, usage }
// Routes through processAIRequest (audit logging + opt-out apply). skipPiiGuard
// because the customer's own name/address are required email content. Throws
// makeError('missing_key', ...) when ANTHROPIC_API_KEY is absent.
export async function generateCheckinEmail(ctx = {}, deps = {}) {
  const result = await processAIRequest({
    taskType: 'checkin_email',
    userId: ctx.userId ?? null,
    clientId: ctx.client?.id ?? ctx.clientId ?? null,
    jobId: ctx.job?.id ?? ctx.jobId ?? null,
    systemPrompt: CHECKIN_SYSTEM_PROMPT,
    prompt: buildCheckinUserMessage(ctx),
    skipPiiGuard: true,
    maxTokens: 1024,
  }, deps)

  const parsed = parseCheckinJson(result.reply)
  if (!parsed) {
    throw makeError('upstream', 'AI returned an unparseable check-in email (expected JSON with subject + html_body).', 502)
  }
  return { subject: parsed.subject, html_body: parsed.html_body, usage: result.usage }
}

export { CHECKIN_TONES }

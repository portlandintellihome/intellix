#!/usr/bin/env node
// Build + activate the "Support intake flow" workflow in n8n via REST API.
//
// Usage:
//   N8N_API_KEY=<key> node scripts/build-n8n-support-intake.js
//   node scripts/build-n8n-support-intake.js <key>
//
// Reads the n8n API key from N8N_API_KEY env var or argv[2]. Looks up the
// credential ID for "Resend support", builds the workflow JSON, POSTs it,
// then activates it. Prints the production webhook URL and a curl test
// command.

const N8N_BASE = process.env.N8N_BASE_URL || 'https://n8n-production-195e.up.railway.app'
const CREDENTIAL_NAME = 'SMTP account'
const WORKFLOW_NAME = 'Support intake flow'
const WEBHOOK_PATH = 'support-intake'
const FROM_EMAIL = 'onboarding@resend.dev'
const FROM_NAME = 'Intellix Support'
const TEAM_EMAIL = 'support@intellihomeav.com'

const apiKey = process.env.N8N_API_KEY || process.argv[2]
if (!apiKey) {
  console.error('Error: n8n API key is required.')
  console.error('  N8N_API_KEY=<key> node scripts/build-n8n-support-intake.js')
  console.error('  node scripts/build-n8n-support-intake.js <key>')
  process.exit(1)
}

async function n8n(method, path, body) {
  const res = await fetch(`${N8N_BASE}/api/v1${path}`, {
    method,
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let parsed
  try { parsed = text ? JSON.parse(text) : null } catch { parsed = text }
  if (!res.ok) {
    const detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
    throw new Error(`n8n ${method} ${path} → ${res.status}: ${detail}`)
  }
  return parsed
}

async function findCredentialId(name) {
  // n8n Public API supports GET /credentials only on Enterprise tiers in
  // some versions; many self-hosted instances 405 this. Try the standard
  // listing endpoint first, then fall back to /credentials/schema lookup.
  try {
    const list = await n8n('GET', '/credentials')
    const arr = Array.isArray(list) ? list : list?.data || []
    const hit = arr.find(c => c.name === name)
    if (hit) return hit.id
    throw new Error(`credential "${name}" not found in /credentials list (got ${arr.length} entries: ${arr.map(c => c.name).join(', ')})`)
  } catch (err) {
    throw new Error(
      `Could not look up credential "${name}". On n8n Community Edition the GET /credentials endpoint is restricted; ` +
      `find the credential ID manually in the n8n UI (Credentials → click "${name}" → copy the ID from the URL: ` +
      `/credentials/<ID>) and re-run with: CREDENTIAL_ID=<id> ${process.argv0} ${process.argv[1]}\n` +
      `Original error: ${err.message}`,
    )
  }
}

function buildWorkflow(credentialId) {
  // Node positions are arbitrary; n8n auto-layouts on first open.
  const webhookNode = {
    parameters: {
      httpMethod: 'POST',
      path: WEBHOOK_PATH,
      responseMode: 'onReceived',
      options: {},
    },
    id: 'webhook-trigger',
    name: 'Webhook',
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2,
    position: [240, 300],
    webhookId: WEBHOOK_PATH,
  }

  const teamHtml = `<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1d1d1f; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="margin: 0 0 16px; font-size: 20px;">New support request</h2>
  <p style="margin: 0 0 20px; color: #555;">Submitted via the public /support form.</p>

  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr><td style="padding: 8px 0; color: #8e8e93; width: 160px;">Reference</td><td style="padding: 8px 0; font-weight: 600;">{{ $json.body.reference_number }}</td></tr>
    <tr><td style="padding: 8px 0; color: #8e8e93;">Ticket ID</td><td style="padding: 8px 0;">{{ $json.body.ticket_id }}</td></tr>
    <tr><td style="padding: 8px 0; color: #8e8e93;">Client matched</td><td style="padding: 8px 0;">{{ $json.body.client_matched ? 'Yes (linked to existing client #' + $json.body.client_id + ')' : 'No — new contact' }}</td></tr>
    <tr><td style="padding: 8px 0; color: #8e8e93;">Name</td><td style="padding: 8px 0;">{{ $json.body.contact_name }}</td></tr>
    <tr><td style="padding: 8px 0; color: #8e8e93;">Email</td><td style="padding: 8px 0;"><a href="mailto:{{ $json.body.contact_email }}">{{ $json.body.contact_email }}</a></td></tr>
    <tr><td style="padding: 8px 0; color: #8e8e93;">Phone</td><td style="padding: 8px 0;"><a href="tel:{{ $json.body.contact_phone }}">{{ $json.body.contact_phone }}</a></td></tr>
    <tr><td style="padding: 8px 0; color: #8e8e93;">Address</td><td style="padding: 8px 0;">{{ $json.body.contact_address }}</td></tr>
  </table>

  <div style="margin-top: 24px; padding: 16px; background: #f5f5f7; border-radius: 8px;">
    <div style="font-size: 12px; color: #8e8e93; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Description</div>
    <div style="font-size: 14px; white-space: pre-wrap; line-height: 1.5;">{{ $json.body.description }}</div>
  </div>

  {{ $json.body.attachment_url ? '<div style="margin-top: 20px;"><a href="' + $json.body.attachment_url + '" style="display: inline-block; padding: 10px 16px; background: #0066cc; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">View attached photo</a></div>' : '' }}

  <p style="margin-top: 32px; font-size: 12px; color: #8e8e93;">Intellix · intellihomeAV</p>
</body></html>`

  const clientHtml = `<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1d1d1f; max-width: 560px; margin: 0 auto; padding: 28px;">
  <p style="font-size: 16px; line-height: 1.55; margin: 0 0 16px;">Hi {{ $json.body.contact_name.split(' ')[0] }},</p>

  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px; color: #3a3a3c;">
    Thanks for reaching out — we got your support request and someone from our team will be in touch within one business day.
  </p>

  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px; color: #3a3a3c;">
    For your records, your reference number is:
  </p>

  <div style="background: #f5f5f7; padding: 16px 20px; border-radius: 10px; text-align: center; margin-bottom: 28px;">
    <div style="font-size: 11px; color: #8e8e93; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Reference</div>
    <div style="font-size: 22px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #1d1d1f; letter-spacing: 0.5px;">{{ $json.body.reference_number }}</div>
  </div>

  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px; color: #3a3a3c;">
    If anything urgent comes up before then, just reply to this email and we'll see it.
  </p>

  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 4px; color: #3a3a3c;">Thanks,</p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0; color: #1d1d1f; font-weight: 600;">The IntelliHome team</p>
</body></html>`

  const notifyTeamNode = {
    parameters: {
      fromEmail: FROM_EMAIL,
      toEmail: TEAM_EMAIL,
      subject: '=New support request from {{ $json.body.contact_name }} (Ref #{{ $json.body.reference_number }})',
      emailFormat: 'html',
      html: '=' + teamHtml,
      options: {
        senderName: FROM_NAME,
      },
    },
    id: 'notify-team',
    name: 'Notify team',
    type: 'n8n-nodes-base.emailSend',
    typeVersion: 2.1,
    position: [560, 200],
    credentials: {
      smtp: { id: credentialId, name: CREDENTIAL_NAME },
    },
  }

  const confirmClientNode = {
    parameters: {
      fromEmail: FROM_EMAIL,
      toEmail: '={{ $json.body.contact_email }}',
      subject: 'We got your IntelliHome support request',
      emailFormat: 'html',
      html: '=' + clientHtml,
      options: {
        senderName: FROM_NAME,
      },
    },
    id: 'confirm-client',
    name: 'Confirm to client',
    type: 'n8n-nodes-base.emailSend',
    typeVersion: 2.1,
    position: [560, 400],
    credentials: {
      smtp: { id: credentialId, name: CREDENTIAL_NAME },
    },
  }

  return {
    name: WORKFLOW_NAME,
    nodes: [webhookNode, notifyTeamNode, confirmClientNode],
    connections: {
      Webhook: {
        main: [
          // Parallel fan-out: outer array index 0 is "main output 0" of
          // Webhook; nested array lists every node that should fire on that
          // output. Both Notify team and Confirm to client receive the same
          // payload.
          [
            { node: 'Notify team',       type: 'main', index: 0 },
            { node: 'Confirm to client', type: 'main', index: 0 },
          ],
        ],
      },
    },
    settings: { executionOrder: 'v1' },
  }
}

async function main() {
  console.log(`[n8n] base URL: ${N8N_BASE}`)

  let credentialId = process.env.CREDENTIAL_ID
  if (credentialId) {
    console.log(`[n8n] using credential ID from env: ${credentialId}`)
  } else {
    console.log(`[n8n] looking up credential "${CREDENTIAL_NAME}"...`)
    credentialId = await findCredentialId(CREDENTIAL_NAME)
    console.log(`[n8n] found credential ID: ${credentialId}`)
  }

  console.log('[n8n] building workflow JSON...')
  const workflow = buildWorkflow(credentialId)

  console.log(`[n8n] creating workflow "${WORKFLOW_NAME}"...`)
  const created = await n8n('POST', '/workflows', workflow)
  const workflowId = created?.id || created?.data?.id
  if (!workflowId) {
    throw new Error(`workflow created but no id returned: ${JSON.stringify(created)}`)
  }
  console.log(`[n8n] workflow created: id=${workflowId}`)

  console.log('[n8n] activating workflow...')
  await n8n('POST', `/workflows/${workflowId}/activate`)
  console.log('[n8n] workflow activated.')

  const webhookUrl = `${N8N_BASE}/webhook/${WEBHOOK_PATH}`
  const samplePayload = {
    ticket_id: 12345,
    reference_number: 'INT-ABC12345',
    contact_name: 'Test Customer',
    contact_email: 'test@example.com',
    contact_phone: '5035550100',
    contact_address: '123 Main St, Portland, OR',
    description: 'Living-room speakers stopped working after the power outage last night.',
    client_matched: false,
    client_id: null,
    attachment_url: null,
  }

  console.log('\n========================================')
  console.log('Workflow is live.\n')
  console.log(`Production webhook URL:\n  ${webhookUrl}\n`)
  console.log('Test it with:\n')
  console.log(
    `curl -X POST ${webhookUrl} \\\n` +
    `  -H "Content-Type: application/json" \\\n` +
    `  -d '${JSON.stringify(samplePayload).replace(/'/g, "'\\''")}'`,
  )
  console.log('\nSet this URL in your Intellix backend env:')
  console.log(`  SUPPORT_INTAKE_WEBHOOK_URL=${webhookUrl}`)
  console.log('========================================\n')
}

main().catch(err => {
  console.error('\n[n8n] FAILED:', err.message)
  process.exit(1)
})

# Portal.io ↔ Intellix sync (via Zapier)

Two Zaps move data from Portal.io into Intellix. Both are simple "Portal.io
trigger → Webhooks by Zapier (POST) → Intellix" flows.

## Where to find the webhook URLs

Sign in to Intellix as an admin → **Integrations & APIs** → **Portal.io**
card. Copy the two URLs shown there ("Proposal sync" and "Contact sync").
They look like:

```
https://intellix-production.up.railway.app/api/webhooks/portal-io/proposal/<32-char-secret>
https://intellix-production.up.railway.app/api/webhooks/portal-io/contact/<32-char-secret>
```

The secret is regenerable from that same page. **Regenerating immediately
invalidates the old URLs**, so you'll need to update both Zaps if you do.

The full secret is only shown the moment it's generated. Subsequent visits
to the page only show the last four characters — copy the URLs to a safe
place when you first connect, or just leave them in Zapier.

## Zap 1 — Proposal sync

- **Trigger app:** Portal.io
- **Trigger event:** Update Proposal Status *(use whatever Portal.io's
  closest equivalent is — anything that fires on draft / sent /
  accepted / rejected state changes)*
- **Action app:** Webhooks by Zapier
- **Action event:** POST
- **URL:** the **Proposal sync URL** copied from Intellix
- **Payload type:** `json`
- **Data (field mapping):**

```json
{
  "portal_proposal_id": "{{Portal.Proposal.ID}}",
  "status": "{{Portal.Proposal.Status}}",
  "name": "{{Portal.Proposal.Name}}",
  "value": "{{Portal.Proposal.Total}}",
  "labor": "{{Portal.Proposal.Labor}}",
  "materials": "{{Portal.Proposal.Materials}}",
  "client": {
    "portal_contact_id": "{{Portal.Contact.ID}}",
    "name": "{{Portal.Contact.Name}}",
    "email": "{{Portal.Contact.Email}}",
    "phone": "{{Portal.Contact.Phone}}",
    "address": "{{Portal.Contact.Address}}"
  }
}
```

### Status mapping

Intellix normalizes Portal.io's status strings into its own vocabulary:

| Portal sends | Intellix stores |
|--------------|-----------------|
| `draft`      | `Draft`         |
| `sent`       | `Sent`          |
| `accepted`   | `Accepted`      |
| `rejected`   | `Declined`      |

Anything else falls back to `Draft`.

### What Intellix does with each event

1. Look up the client by `portal_contact_id`. If no match, look up by
   `client.email`. If still no match, **create a new client** with the
   default location set on the Integrations page (Los Angeles unless
   you changed it).
2. Backfill `portal_contact_id` on the matched client if it was matched
   by email and didn't have one yet.
3. Look up the proposal by `portal_proposal_id`. If not found, **create
   it** with the client's location. If found, **update** its status,
   scope, labor, materials, and total in place.
4. **If status is `accepted` and no job exists for this proposal yet**,
   create a new job linked to the proposal, defaulted to status
   `Scheduled` with the proposal's location.
5. Stamp `integrations.last_synced_at` with the current time.

The response is JSON: `{ action, proposal_id, job_id?, client_id }`.
`action` is `created` or `updated`. `job_id` is set only when a job
was created in step 4.

## Zap 2 — Contact sync

- **Trigger app:** Portal.io
- **Trigger event:** Contact Modification *(or equivalent — fires when
  a contact is created or edited in Portal)*
- **Action app:** Webhooks by Zapier
- **Action event:** POST
- **URL:** the **Contact sync URL** copied from Intellix
- **Payload:**

```json
{
  "portal_contact_id": "{{Portal.Contact.ID}}",
  "name": "{{Portal.Contact.Name}}",
  "email": "{{Portal.Contact.Email}}",
  "phone": "{{Portal.Contact.Phone}}",
  "address": "{{Portal.Contact.Address}}"
}
```

Intellix looks up the client the same way (portal_contact_id → email)
and either creates a new client (with the default location) or patches
the existing one with whatever non-null fields came through. It will
not overwrite a populated field with a null value from Portal — i.e.
clearing a phone number in Portal does not clear it in Intellix.

Response: `{ action: 'created' | 'updated', client_id }`.

## Field mapping notes

- **`value`** is the proposal's grand total. **`labor`** and
  **`materials`** are the line-item subtotals. If you don't have a
  way to separate labor and materials in Portal, leave them null
  and just send `value` — Intellix preserves whatever values were
  already on the proposal when `null` comes through on an update.
- **`portal_contact_id`** should be Portal's stable unique ID for the
  contact (not the email, not the name). If Portal can change a
  contact's email but the ID stays the same, the email-fallback
  lookup will still work for first-touch.
- **Phone format** is not normalized server-side. Whatever Portal
  sends is what gets stored.
- **Status string** is case-insensitive. `"Accepted"`, `"ACCEPTED"`,
  and `"accepted"` all work.

## Testing the wiring before going live

Two ways:

1. **From Intellix:** Integrations → Portal.io → **Test webhook** button.
   Fires a synthetic proposal through the real receiver. Creates a test
   client and proposal with the fixed IDs `INTELLIX_TEST_CONTACT` and
   `INTELLIX_TEST_PROPOSAL` — safe to delete from the Clients and
   Proposals pages after verification. Subsequent test runs reuse the
   same test records (no duplication).

2. **From Zapier:** Use Zapier's "Test action" with sample data once
   the Zap is configured. The webhook returns the same JSON shape
   described above so you can verify the response in Zapier.

## What invalidates the connection

- Regenerating the secret in Intellix → both Zaps stop working until
  the new URLs are pasted into Zapier.
- Disconnecting the integration in Intellix → Intellix still **accepts**
  incoming webhooks but logs a warning. This is intentional — flipping
  the toggle off is a soft pause, not a hard block. Use **Regenerate
  secret** if you need to actually cut the connection.

## Troubleshooting

| Symptom in Zapier | Likely cause |
|---|---|
| 401 `Invalid webhook secret` | Secret was regenerated; copy the new URL from Intellix. |
| 400 `portal_proposal_id is required` | Trigger payload didn't include the proposal ID — re-check the Zap's field mapping. |
| 400 `client object is required` | Proposal payload missing the `client` object entirely — re-check the Zap body. |
| 500 with `column ... does not exist` | The Intellix backend is mid-migration; retry in a minute. |
| Webhook fires but proposal isn't showing | Verify the integration's `connected` flag is on (still saves data when off, but worth checking). Then check the **Last synced** timestamp on the Integrations page — if it advanced, the data is in; the proposal will be on the **Jobs & proposals** page. |

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'Employee',
  phone TEXT,
  initials TEXT,
  status TEXT DEFAULT 'Available',
  must_change_password BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill for DBs created before these columns existed. Safe no-ops otherwise.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS initials TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Available';
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- Multi-location support. Each client/job/proposal belongs to one location;
-- post-job check-ins pull google_review_url from the job's location.
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  google_review_url TEXT,
  support_email TEXT,
  support_phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- One-shot seed: only fires if the table is still empty after creation.
INSERT INTO locations (name, slug)
  SELECT 'Portland', 'portland'
  WHERE NOT EXISTS (SELECT 1 FROM locations);
INSERT INTO locations (name, slug)
  SELECT 'Los Angeles', 'la'
  WHERE NOT EXISTS (SELECT 1 FROM locations WHERE slug = 'la');

-- External integrations: each row is one tool (Portal.io, OVRC, etc).
-- secret is the URL-path token webhooks must include to prove they're
-- legitimate. default_location_id is applied to clients that come in
-- without enough info to match an existing one.
CREATE TABLE IF NOT EXISTS integrations (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL UNIQUE,
  connected BOOLEAN DEFAULT FALSE,
  secret TEXT,
  default_location_id INTEGER REFERENCES locations(id),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Seed the portal_io integration if missing. md5(random()::text || clock_timestamp()::text)
-- gives exactly 32 hex chars — enough randomness for a webhook secret.
INSERT INTO integrations (kind, connected, secret, default_location_id)
  SELECT 'portal_io',
         FALSE,
         md5(random()::text || clock_timestamp()::text),
         (SELECT id FROM locations WHERE name = 'Los Angeles' LIMIT 1)
  WHERE NOT EXISTS (SELECT 1 FROM integrations WHERE kind = 'portal_io');

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  since TEXT,
  status TEXT DEFAULT 'Active',
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  plan_tier TEXT DEFAULT 'None',
  plan_start_date DATE,
  plan_renewal_date DATE,
  homedoc JSONB DEFAULT '{}',
  ai_opt_out BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill for DBs created before the plan columns existed.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'None';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS plan_start_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS plan_renewal_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ai_opt_out BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);
UPDATE clients SET location_id = 1 WHERE location_id IS NULL;
-- Portal.io contact id, populated by the webhook receiver. Indexed for the
-- lookup that runs on every incoming sync.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_contact_id TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_portal_contact_id ON clients (portal_contact_id);

-- Rename intellifile -> homedoc if the old column exists (and the new
-- one doesn't yet). Idempotent: safe to re-run.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'intellifile')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'homedoc') THEN
    ALTER TABLE clients RENAME COLUMN intellifile TO homedoc;
  END IF;
END $$;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS homedoc JSONB DEFAULT '{}';

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  company_name TEXT,
  company_address TEXT,
  company_phone TEXT,
  company_email TEXT,
  company_logo_url TEXT,
  email_notifications BOOLEAN DEFAULT TRUE,
  in_app_notifications BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT settings_singleton CHECK (id = 1)
);

-- Google review check-in configuration. The review URL is per-location
-- (see locations.google_review_url), so settings only stores the global
-- delay/subject/body template.
ALTER TABLE settings DROP COLUMN IF EXISTS google_review_url;
-- Drop the legacy global review link too — review URLs are per-location now.
ALTER TABLE settings DROP COLUMN IF EXISTS google_review_link;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS checkin_delay_days INTEGER DEFAULT 3;
-- Voice preference passed to the AI check-in generator ('warm' | 'professional').
ALTER TABLE settings ADD COLUMN IF NOT EXISTS checkin_tone TEXT DEFAULT 'warm';
-- DEPRECATED: checkin_email_subject / checkin_email_body were the manually-edited
-- static templates. Check-in emails are now AI-generated per send via
-- aiProcessor.generateCheckinEmail (see /api/checkins/due). These columns are
-- retained for data safety + as a fallback if AI generation fails; the Settings
-- UI no longer edits them. Do not drop without confirming nothing reads them.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS checkin_email_subject TEXT
  DEFAULT 'How''s your IntelliHome system working?';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS checkin_email_body TEXT;
-- Seed default body if NULL (single-quote-escaped HTML below).
UPDATE settings SET checkin_email_body =
  '<!DOCTYPE html><html><body style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Helvetica, Arial, sans-serif; color: #1d1d1f; max-width: 560px; margin: 0 auto; padding: 28px;">
  <p style="font-size: 16px; line-height: 1.55; margin: 0 0 16px;">Hi {{first_name}},</p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 18px; color: #3a3a3c;">It''s been a few days since we wrapped up at {{address}} — just checking in to make sure everything is working the way you want it to.</p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 14px; color: #3a3a3c;"><strong>If everything is great</strong>, would you mind leaving us a quick Google review? It takes 30 seconds and it makes a big difference for a small business.</p>
  <p style="margin: 0 0 24px; text-align: center;"><a href="{{review_url}}" style="display: inline-block; padding: 12px 22px; background: #34c759; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Leave a Google review</a></p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 14px; color: #3a3a3c;"><strong>If something is not quite right</strong>, please let us know and we''ll come take care of it.</p>
  <p style="margin: 0 0 28px; text-align: center;"><a href="{{support_url}}" style="display: inline-block; padding: 12px 22px; background: #0066cc; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Submit a support request</a></p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 4px; color: #3a3a3c;">Thanks again for choosing IntelliHome.</p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0; color: #1d1d1f; font-weight: 600;">— The IntelliHome team</p>
</body></html>'
  WHERE id = 1 AND checkin_email_body IS NULL;
-- (Previously this block backfilled settings.google_review_url from the
-- legacy google_review_link. The column was dropped above when the review
-- URL moved per-location, so the backfill is intentionally gone.)

CREATE TABLE IF NOT EXISTS check_ins (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  interval_days INTEGER NOT NULL,
  scheduled_for DATE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, interval_days)
);

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  address TEXT,
  phase TEXT, -- DEPRECATED: replaced by status column, retained for data history.
  status TEXT,
  priority TEXT DEFAULT 'Normal',
  scope TEXT,
  assigned TEXT[] DEFAULT '{}',
  start_date DATE,
  end_date DATE,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill for the reporting route's "jobs closed this/last month" metric.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Google review check-in flow: completed_at marks when the job finished
-- (closed_at is the legacy name and is kept in sync via backfill below).
-- checkin_sent_at marks when the post-job follow-up email went out so we
-- never double-send.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS checkin_sent_at TIMESTAMPTZ;
UPDATE jobs SET completed_at = COALESCE(closed_at, created_at)
  WHERE status = 'Complete' AND completed_at IS NULL;

-- Multi-location: each job belongs to one location. Backfill from the
-- linked client's location_id, falling back to id=1 (Portland).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);
UPDATE jobs SET location_id = COALESCE(
    (SELECT location_id FROM clients WHERE clients.id = jobs.client_id),
    1
  )
  WHERE location_id IS NULL;

-- Status standardization: collapse the legacy free-text status/phase pair into
-- a single canonical lifecycle on `status`. `phase` is deprecated (kept for
-- history). NOTE: this runs AFTER the completed_at backfill above, which still
-- keys off the legacy 'Complete' value — keep that ordering. Idempotent: a
-- second run sees already-lowercased values and is a no-op.
--   pending | scheduled | in_progress | completed | cancelled
UPDATE jobs SET status = 'scheduled'   WHERE status IN ('Scheduled', 'scheduled');
UPDATE jobs SET status = 'in_progress' WHERE status IN ('In progress', 'On site', 'Review', 'In Progress', 'in progress');
UPDATE jobs SET status = 'completed'   WHERE status IN ('Complete', 'Completed', 'complete');
UPDATE jobs SET status = 'cancelled'   WHERE status IN ('Cancelled', 'Canceled', 'canceled', 'cancelled');
UPDATE jobs SET status = 'pending'     WHERE status IN ('Pending', 'pending');
-- Any row still outside the canonical set (null/unknown status): derive from
-- the deprecated phase value, with start_date disambiguating pending vs scheduled.
UPDATE jobs SET status = CASE
    WHEN phase IN ('Pending', 'Scheduling') AND start_date IS NOT NULL THEN 'scheduled'
    WHEN phase IN ('Pending', 'Scheduling')                            THEN 'pending'
    WHEN phase IN ('Installation', 'Programming', 'Sign-off')          THEN 'in_progress'
    WHEN phase = 'Completed'                                           THEN 'completed'
    WHEN phase = 'Cancelled'                                           THEN 'cancelled'
    ELSE 'pending'
  END
  WHERE status IS NULL
     OR status NOT IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled');

CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  initials TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'Available',
  current_job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DEPRECATED FEATURE: the Support Tickets UI (src/SupportTickets.jsx), the
-- public intake form (src/Support.jsx + /api/support), and that route were
-- removed. This table is RETAINED for data safety — historical tickets live
-- here and tickets.js / reporting.js / todos.js still reference it. Do not
-- drop without a data audit + removing those references.
CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,
  ticket_id TEXT UNIQUE,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  contact TEXT,
  phone TEXT,
  issue TEXT NOT NULL,
  type TEXT,
  priority TEXT DEFAULT 'Normal',
  status TEXT DEFAULT 'Open',
  assigned_to INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill for the reporting route's avg-resolution-time metric.
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Public support intake: tickets that arrive via the /support form rather
-- than the internal CRM. intake_source distinguishes them. contact_*
-- fields snapshot the form data at submit time (independent of any
-- matched client record). attachment_url points at the uploaded photo
-- (if any). raw_payload holds the full intake JSON for replay/debugging.
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS intake_source TEXT DEFAULT 'internal';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS contact_address TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS raw_payload JSONB;

CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  qty INTEGER DEFAULT 0,
  on_order INTEGER DEFAULT 0,
  location TEXT,
  cost NUMERIC(10,2),
  supplier TEXT,
  status TEXT DEFAULT 'In stock',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column names here match what production actually has (connection_type,
-- added_at). An earlier schema edit renamed these to connection/created_at
-- only in the CREATE block, which never reached the live table (CREATE TABLE
-- IF NOT EXISTS is a no-op on an existing table) — so the live names won, and
-- route/UI code reads them. Keep declaring the live names; the RENAMEs below
-- are idempotent (guarded) so a fresh DB built straight from this CREATE is
-- already correct and the guards simply no-op.
CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  connection_type TEXT,
  filename TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW()
);
-- Idempotent reconcilers: if an older DB still has the pre-rename names,
-- bring them to the live names. No-op once already in the target state.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='connection')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='connection_type')
  THEN ALTER TABLE drivers RENAME COLUMN connection TO connection_type; END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='created_at')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='drivers' AND column_name='added_at')
  THEN ALTER TABLE drivers RENAME COLUMN created_at TO added_at; END IF;
END $$;

CREATE TABLE IF NOT EXISTS proposals (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  portal_id TEXT,
  address TEXT,
  scope TEXT,
  devices TEXT,
  rooms INTEGER,
  labor NUMERIC(12,2),
  materials NUMERIC(12,2),
  total NUMERIC(12,2),
  status TEXT DEFAULT 'Draft',
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Backfill columns for databases whose proposals table predates these being
-- added to the CREATE TABLE above. `CREATE TABLE IF NOT EXISTS` does NOT add
-- new columns to an existing table, so any column introduced into the CREATE
-- block after a deploy must ALSO be declared as an idempotent ALTER here or
-- it silently never lands on the existing (production) DB. address +
-- assigned_to were edited into the CREATE block but never added as ALTERs,
-- which is why proposal edits 42703'd on prod (missing `address`).
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);
-- LEGACY: production's proposals table also has an older `assigned` column
-- (from before assigned_to existed). It is intentionally left in place — it
-- may hold real data and nothing reads/writes it, so dropping it is a
-- data-loss risk with no benefit. It is deliberately NOT declared above, so
-- verifySchema() won't flag it (the guard only checks declared→live, never
-- live→declared). Do not "tidy" it away without a data audit + migration.
UPDATE proposals SET location_id = COALESCE(
    (SELECT location_id FROM clients WHERE clients.id = proposals.client_id),
    1
  )
  WHERE location_id IS NULL;
-- Portal.io proposal id, populated by the webhook receiver. Indexed for upsert.
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS portal_proposal_id TEXT;
CREATE INDEX IF NOT EXISTS idx_proposals_portal_proposal_id ON proposals (portal_proposal_id);

-- Link jobs back to the proposal they came from. The accepted-proposal
-- webhook handler uses this to avoid creating duplicate jobs when the
-- same accepted-status event fires more than once.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS proposal_id INTEGER REFERENCES proposals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_proposal_id ON jobs (proposal_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);

CREATE TABLE IF NOT EXISTS ai_interactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE SET NULL,
  redacted_prompt TEXT,
  raw_response TEXT,
  model TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  status TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_user_id ON ai_interactions (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_client_id ON ai_interactions (client_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_task_type ON ai_interactions (task_type);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_created_at ON ai_interactions (created_at DESC);

CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'open',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_todos_assigned_to ON todos (assigned_to);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos (status);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos (due_date);

-- "Due by" time-of-day support: due_at is a full timestamp (date defaults to
-- the day the user set it). completed_at already exists above. Partial index
-- to filter open (not-yet-completed) todos efficiently.
ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_todos_open ON todos (completed_at) WHERE completed_at IS NULL;

CREATE TABLE IF NOT EXISTS composer_builds (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  build_date DATE,
  progress INTEGER DEFAULT 0,
  phases INTEGER DEFAULT 0,
  form_data JSONB,
  checklist JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobsite documentation photos. file_path is the public URL path
-- (/uploads/jobs/<uuid>.<ext>) served by the static mount in index.js,
-- mirroring the support-ticket attachment pattern.
CREATE TABLE IF NOT EXISTS job_photos (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  uploaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_photos_job_id ON job_photos (job_id);

-- AI-generated customer documents (Customer System Handover Guide / Quick
-- Reference Card). form_data + details_text are persisted so a doc can be
-- regenerated; generated_html is the Claude output rendered/downloaded as PDF
-- client-side. Per the schema-drift guard convention, every column is ALSO
-- declared as an idempotent ALTER below so additions reach existing DBs (a
-- column added only to the CREATE block never lands on an already-created
-- table).
CREATE TABLE IF NOT EXISTS homedocs (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  doc_type TEXT NOT NULL,
  form_data JSONB,
  details_text TEXT,
  generated_html TEXT,
  generated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE homedocs ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE homedocs ADD COLUMN IF NOT EXISTS job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE homedocs ADD COLUMN IF NOT EXISTS doc_type TEXT;
ALTER TABLE homedocs ADD COLUMN IF NOT EXISTS form_data JSONB;
ALTER TABLE homedocs ADD COLUMN IF NOT EXISTS details_text TEXT;
ALTER TABLE homedocs ADD COLUMN IF NOT EXISTS generated_html TEXT;
ALTER TABLE homedocs ADD COLUMN IF NOT EXISTS generated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE homedocs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_homedocs_client_created ON homedocs (client_id, created_at DESC);

-- Audit log of AI-generated check-in emails actually sent, so the team can
-- review past output for quality. Written by /api/checkins/due when it
-- generates an email (token usage is also captured in ai_interactions).
CREATE TABLE IF NOT EXISTS checkin_emails_sent (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  subject TEXT,
  html_body TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE checkin_emails_sent ADD COLUMN IF NOT EXISTS job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE checkin_emails_sent ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE checkin_emails_sent ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE checkin_emails_sent ADD COLUMN IF NOT EXISTS html_body TEXT;
ALTER TABLE checkin_emails_sent ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_checkin_emails_sent_job ON checkin_emails_sent (job_id, sent_at DESC);

-- ============================================================================
-- FEATURE: Employee clock-in / job-linked time tracking (time_entries)
-- ----------------------------------------------------------------------------
-- One row per punch. employee_id references team_members(id) — that's the team
-- roster. The authenticated user (users row) is mapped to their team_member at
-- clock-in time (by email, then initials, auto-provisioned if absent). The
-- calendar auto-suggest matches team_members.initials against jobs.assigned.
-- A punch is "open" while clock_out_at IS NULL. edited_by_user_id records the
-- Admin (users row) who corrected an entry — only Admins may edit past entries.
-- ============================================================================
CREATE TABLE IF NOT EXISTS time_entries (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  clock_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out_at TIMESTAMPTZ,
  note TEXT,
  edited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Idempotent ALTERs so every declared column also lands on an existing DB
-- (CREATE TABLE IF NOT EXISTS is a no-op there) and verifySchema() covers them.
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES team_members(id) ON DELETE CASCADE;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_out_at TIMESTAMPTZ;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS edited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON time_entries (employee_id, clock_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_job ON time_entries (job_id);
-- Partial index for the hot "is this employee currently clocked in?" lookup.
CREATE INDEX IF NOT EXISTS idx_time_entries_open ON time_entries (employee_id) WHERE clock_out_at IS NULL;

-- Optional per-job estimate so Reporting can show actual-vs-estimated on-site
-- time. NULL when unset (no estimate to compare against).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(8,2);

-- ============================================================================
-- FEATURE: Client SMS system (Twilio) — templates, quiet hours, opt-out, audit
-- ----------------------------------------------------------------------------
-- Settings gains the 4 editable templates + quiet-hours + review-delay config.
-- Merge fields supported by the sender: {client_name} {employee_name}
-- {company} {eta} {review_link}. Quiet hours are expressed as local-hour
-- integers in sms_timezone; completion/review texts falling in the quiet
-- window are deferred to sms_quiet_hours_end.
-- ============================================================================
ALTER TABLE settings ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS sms_template_scheduled TEXT
  DEFAULT 'Hi {client_name}, this is {company}. Your service visit is scheduled. We''ll see you then!';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS sms_template_on_the_way TEXT
  DEFAULT 'Hi {client_name}, {employee_name} from {company} is on the way{eta}. See you soon!';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS sms_template_completed TEXT
  DEFAULT 'Hi {client_name}, your service with {company} is complete. Thank you — reach out any time if you need anything.';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS sms_template_review TEXT
  DEFAULT 'Hi {client_name}, thanks again for choosing {company}! If you were happy with our work, a quick review means a lot: {review_link}';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS sms_quiet_hours_start INTEGER DEFAULT 21;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS sms_quiet_hours_end INTEGER DEFAULT 8;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS sms_review_delay_hours INTEGER DEFAULT 24;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS sms_timezone TEXT DEFAULT 'America/Los_Angeles';

-- Per-client SMS consent + import-provenance columns. sms_opt_out is the
-- guardrail the STOP webhook flips; source_id makes the CSV import idempotent.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sms_opt_out_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS source_system TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lead_source TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS customer_type TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lifetime_value NUMERIC(12,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_service_date DATE;
-- Full-fidelity snapshot of the source row (extra phones/emails/addresses,
-- flags) so nothing from the import is lost even though only a few fields are
-- promoted to first-class columns.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS source_meta JSONB DEFAULT '{}';
-- Idempotency guard for the importer: source_id is unique when present.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_source_id ON clients (source_id) WHERE source_id IS NOT NULL;

-- Outbox + audit trail for every SMS. Doubles as the deferred-send queue:
-- send_after gates the 24h review delay and quiet-hours deferral; an external
-- cron polls GET /api/sms/process-due to flush anything now due. status:
-- queued | sent | failed | skipped | canceled. template_key: scheduled |
-- on_the_way | completed | review.
CREATE TABLE IF NOT EXISTS sms_messages (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  template_key TEXT,
  to_number TEXT,
  body TEXT,
  status TEXT DEFAULT 'queued',
  error TEXT,
  twilio_sid TEXT,
  send_after TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS template_key TEXT;
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS to_number TEXT;
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'queued';
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS twilio_sid TEXT;
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS send_after TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE sms_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_sms_messages_client ON sms_messages (client_id, created_at DESC);
-- Partial index for the cron's "what's due to send now?" scan.
CREATE INDEX IF NOT EXISTS idx_sms_messages_due ON sms_messages (send_after) WHERE status = 'queued';

-- Twilio inbound-webhook secret (STOP handling), seeded like portal_io. The
-- secret is a URL path segment the webhook must include; shown only in the
-- admin Integrations UI.
INSERT INTO integrations (kind, connected, secret)
  SELECT 'twilio', FALSE, md5(random()::text || clock_timestamp()::text)
  WHERE NOT EXISTS (SELECT 1 FROM integrations WHERE kind = 'twilio');

-- Optional company-wide labor rate for Reporting's labor-cost-per-job metric.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS default_hourly_rate NUMERIC(10,2) DEFAULT 0;

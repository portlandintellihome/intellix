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
  google_review_link TEXT,
  email_notifications BOOLEAN DEFAULT TRUE,
  in_app_notifications BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT settings_singleton CHECK (id = 1)
);

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
  phase TEXT,
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

CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  connection TEXT,
  filename TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

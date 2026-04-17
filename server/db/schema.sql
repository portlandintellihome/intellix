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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill for DBs created before the plan columns existed.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'None';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS plan_start_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS plan_renewal_date DATE;

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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

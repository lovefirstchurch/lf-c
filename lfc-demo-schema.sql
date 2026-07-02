-- lf-c demo schema for the shared Supabase project.
-- Run once in the Supabase SQL editor before first deploy.
--
-- Every table is prefixed lfc_demo_ because this prototype shares its
-- Supabase project with the real lfc production app, and several of these
-- table names (users, areas, governorships, units, members, audit_logs)
-- are identical to real production tables with completely different,
-- incompatible columns. The prefix keeps demo data from ever colliding
-- with real church data.
--
-- This DDL matches initDb() in database.js exactly (the app also runs it
-- with IF NOT EXISTS on startup, so re-running is harmless). Seed data is
-- inserted automatically by the app on its first start when
-- lfc_demo_users is empty.

CREATE TABLE IF NOT EXISTS lfc_demo_users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  governorship_id INTEGER,
  unit_id INTEGER
);

CREATE TABLE IF NOT EXISTS lfc_demo_areas (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lfc_demo_governorships (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  area_id INTEGER NOT NULL REFERENCES lfc_demo_areas(id),
  governor_id INTEGER REFERENCES lfc_demo_users(id),
  admin_id INTEGER REFERENCES lfc_demo_users(id)
);

CREATE TABLE IF NOT EXISTS lfc_demo_units (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  governorship_id INTEGER NOT NULL REFERENCES lfc_demo_governorships(id),
  leader_id INTEGER REFERENCES lfc_demo_users(id)
);

CREATE TABLE IF NOT EXISTS lfc_demo_members (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  unit_id INTEGER NOT NULL REFERENCES lfc_demo_units(id),
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lfc_demo_midweek_services (
  id SERIAL PRIMARY KEY,
  unit_id INTEGER NOT NULL REFERENCES lfc_demo_units(id),
  service_date TEXT NOT NULL,
  attendance_count INTEGER NOT NULL,
  offering_amount REAL NOT NULL,
  offering_currency TEXT DEFAULT 'GHS',
  tithers_count INTEGER NOT NULL,
  picture_path TEXT NOT NULL,
  notes TEXT,
  submitted_by INTEGER NOT NULL REFERENCES lfc_demo_users(id),
  submitted_at TEXT NOT NULL,
  UNIQUE(unit_id, service_date)
);

CREATE TABLE IF NOT EXISTS lfc_demo_saturday_arrivals (
  id SERIAL PRIMARY KEY,
  unit_id INTEGER NOT NULL REFERENCES lfc_demo_units(id),
  arrival_date TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  premob_photo_path TEXT,
  premob_submitted_at TEXT,
  approved_headcount INTEGER,
  approved_by INTEGER REFERENCES lfc_demo_users(id),
  approved_at TEXT,
  UNIQUE(unit_id, arrival_date)
);

CREATE TABLE IF NOT EXISTS lfc_demo_saturday_vehicles (
  id SERIAL PRIMARY KEY,
  arrival_id INTEGER NOT NULL REFERENCES lfc_demo_saturday_arrivals(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL,
  photo_path TEXT NOT NULL,
  headcount INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lfc_demo_saturday_named_attendance (
  id SERIAL PRIMARY KEY,
  arrival_id INTEGER NOT NULL REFERENCES lfc_demo_saturday_arrivals(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES lfc_demo_members(id),
  present INTEGER DEFAULT 1,
  UNIQUE(arrival_id, member_id)
);

CREATE TABLE IF NOT EXISTS lfc_demo_arrivals_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cutoff_time TEXT DEFAULT '08:30',
  vehicle_types TEXT DEFAULT '["Bus", "Sprinter", "Taxi", "Private"]',
  headcount_approval_required INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lfc_demo_counter_invites (
  id TEXT PRIMARY KEY,
  created_by INTEGER NOT NULL REFERENCES lfc_demo_users(id),
  created_at TEXT NOT NULL,
  is_used INTEGER DEFAULT 0,
  used_by INTEGER REFERENCES lfc_demo_users(id)
);

CREATE TABLE IF NOT EXISTS lfc_demo_audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  before_state TEXT,
  after_state TEXT,
  timestamp TEXT NOT NULL
);

-- CE Final Projects Management System - Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_number INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'review', 'approved', 'rejected')),
  title_he TEXT NOT NULL,
  title_en TEXT NOT NULL,
  track TEXT NOT NULL CHECK (track IN ('cyber', 'networks', 'data', 'hardware')),
  recommended_track TEXT CHECK (recommended_track IN ('cyber', 'networks', 'data', 'hardware')),
  supervisors_name TEXT NOT NULL,
  supervisors_email TEXT NOT NULL,
  academic_supervisor_name TEXT NOT NULL,
  academic_supervisor_email TEXT NOT NULL,
  abstract TEXT NOT NULL,
  objective TEXT NOT NULL,
  scope TEXT NOT NULL,
  relevant_required_course_1 TEXT DEFAULT '',
  relevant_required_course_2 TEXT DEFAULT '',
  prereq_course_1 TEXT DEFAULT '',
  prereq_course_2 TEXT DEFAULT '',
  references_text TEXT NOT NULL,
  review_notes TEXT,
  edit_token UUID NOT NULL DEFAULT uuid_generate_v4(),
  is_taken BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Registrations table
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  student1_name TEXT NOT NULL,
  student1_id TEXT NOT NULL,
  student1_email TEXT NOT NULL,
  student2_name TEXT DEFAULT '',
  student2_id TEXT DEFAULT '',
  student2_email TEXT DEFAULT '',
  is_ce_student BOOLEAN NOT NULL DEFAULT TRUE,
  approval_token UUID NOT NULL DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Staff emails table
CREATE TABLE staff_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_track ON projects(track);
CREATE INDEX idx_projects_edit_token ON projects(edit_token);
CREATE INDEX idx_registrations_project_id ON registrations(project_id);
CREATE INDEX idx_registrations_approval_token ON registrations(approval_token);
CREATE INDEX idx_registrations_status ON registrations(status);

-- Updated_at trigger for projects
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_emails ENABLE ROW LEVEL SECURITY;

-- Projects: anyone can read approved projects, only authenticated staff can manage
CREATE POLICY "Anyone can read approved projects"
  ON projects FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Anyone can insert projects (form submission)"
  ON projects FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read projects by edit_token"
  ON projects FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update projects by edit_token (resubmit)"
  ON projects FOR UPDATE
  USING (true);

-- For admin: service role key bypasses RLS

-- Registrations: public insert, service role for management
CREATE POLICY "Anyone can insert registrations"
  ON registrations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read registrations by approval_token"
  ON registrations FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update registrations (supervisor decision)"
  ON registrations FOR UPDATE
  USING (true);

-- Staff emails: read-only for auth checks
CREATE POLICY "Anyone can read staff emails"
  ON staff_emails FOR SELECT
  USING (true);

-- Insert initial staff email (replace with actual staff member)
-- INSERT INTO staff_emails (email, name) VALUES ('admin@example.com', 'Admin User');

-- ─────────────────────────────────────────────────────────────────────────────
-- Academic Years  (multi-year archive support)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,         -- e.g. '2526', '2627'
  label_en TEXT NOT NULL,            -- e.g. '2025-2026'
  label_he TEXT NOT NULL,            -- e.g. 'תשפ"ו'
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce only one active year at the DB level
CREATE UNIQUE INDEX idx_academic_years_one_active
  ON academic_years(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_academic_years_slug ON academic_years(slug);

-- Link projects to an academic year
ALTER TABLE projects
  ADD COLUMN academic_year_id UUID REFERENCES academic_years(id);

CREATE INDEX idx_projects_academic_year ON projects(academic_year_id);

-- RLS for academic_years (public read, service role writes)
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read academic years"
  ON academic_years FOR SELECT
  USING (true);

-- ─── Migration / seed (run once after the table is created) ───────────────────

-- 1. Insert initial academic year
INSERT INTO academic_years (slug, label_en, label_he, is_active)
VALUES ('2526', '2025-2026', 'תשפ"ו', TRUE);

-- 2. Tag all existing projects with the initial year
UPDATE projects
SET academic_year_id = (SELECT id FROM academic_years WHERE slug = '2526')
WHERE academic_year_id IS NULL;

-- Add optional relevant required courses to project proposals.
-- Run once in the Supabase SQL editor before deploying code that writes these fields.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS relevant_required_course_1 TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS relevant_required_course_2 TEXT DEFAULT '';

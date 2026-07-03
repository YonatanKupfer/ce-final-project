-- Add ai_complexity_justification field to projects
-- This field is optional and visible to admins only (not published with the project).
-- Intended for software-heavy projects: explain why the system cannot be trivially
-- built with generative AI tools.

ALTER TABLE projects
  ADD COLUMN ai_complexity_justification TEXT;

-- Retire the separate "book/team/objectives" rubric form: its three
-- components (teamwork, project_book, objectives) are now filled directly
-- by the academic advisor inside the final_presentation form, alongside
-- the component's live weight_percent so the advisor understands how each
-- number affects the final grade. The old per-criterion rubric mechanism
-- (rubric_sections/rubric_criteria/grading_invites.answers) is now fully
-- unused — every remaining template (mid_presentation, final_presentation)
-- is a fixed set of plain 1-100 fields — so it's dropped rather than left
-- dead. No grading_invites exist yet referencing book_team_objectives
-- (feature is pre-launch), so this is safe.

ALTER TABLE grading_invites
  ADD COLUMN teamwork_score NUMERIC CHECK (teamwork_score IS NULL OR teamwork_score BETWEEN 1 AND 100),
  ADD COLUMN project_book_score NUMERIC CHECK (project_book_score IS NULL OR project_book_score BETWEEN 1 AND 100),
  ADD COLUMN objectives_score NUMERIC CHECK (objectives_score IS NULL OR objectives_score BETWEEN 1 AND 100);

DELETE FROM rubric_criteria;
DELETE FROM rubric_sections;
DELETE FROM rubric_templates WHERE key = 'book_team_objectives';

DROP TABLE rubric_criteria;
DROP TABLE rubric_sections;

ALTER TABLE grading_invites DROP COLUMN answers;

-- Narrow the allowed template keys now that book_team_objectives is gone.
-- IF EXISTS guards against the auto-generated constraint name differing;
-- the explicit replacement below is what actually enforces the new list.
ALTER TABLE rubric_templates DROP CONSTRAINT IF EXISTS rubric_templates_key_check;
ALTER TABLE rubric_templates ADD CONSTRAINT rubric_templates_key_check
  CHECK (key IN ('mid_presentation', 'final_presentation'));

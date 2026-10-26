-- When the academic advisor declares on the book_team_objectives form that
-- the project's deliverables were NOT all submitted on time, the actual
-- submission date (NULL = on time, or not submitted yet).
ALTER TABLE grading_invites
  ADD COLUMN deliverables_submitted_on DATE;

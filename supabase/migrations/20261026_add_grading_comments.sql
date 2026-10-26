-- Optional free-text comments a judge/academic advisor can add alongside
-- their score, on every grading form.
ALTER TABLE grading_invites
  ADD COLUMN comments TEXT;

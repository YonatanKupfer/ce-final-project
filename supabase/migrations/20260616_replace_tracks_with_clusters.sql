-- Replace the 7 old tracks with 4 project clusters.
-- Run once in the Supabase SQL editor before deploying code that submits new projects.

BEGIN;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_track_check;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_recommended_track_check;

UPDATE projects
SET
  track = CASE track
    WHEN 'crypto' THEN 'cyber'
    WHEN 'networks' THEN 'networks'
    WHEN 'algorithms' THEN 'networks'
    WHEN 'software' THEN 'networks'
    WHEN 'ai' THEN 'data'
    WHEN 'signal' THEN 'data'
    WHEN 'hardware' THEN 'hardware'
    ELSE 'cyber'
  END,
  recommended_track = CASE recommended_track
    WHEN 'crypto' THEN 'cyber'
    WHEN 'networks' THEN 'networks'
    WHEN 'algorithms' THEN 'networks'
    WHEN 'software' THEN 'networks'
    WHEN 'ai' THEN 'data'
    WHEN 'signal' THEN 'data'
    WHEN 'hardware' THEN 'hardware'
    ELSE NULL
  END;

WITH numbered AS (
  SELECT
    id,
    CASE track
      WHEN 'cyber' THEN 100
      WHEN 'networks' THEN 200
      WHEN 'data' THEN 300
      WHEN 'hardware' THEN 400
      ELSE 100
    END + ROW_NUMBER() OVER (
      PARTITION BY academic_year_id, track
      ORDER BY project_number NULLS LAST, created_at, id
    ) AS new_project_number
  FROM projects
  WHERE project_number IS NOT NULL
)
UPDATE projects AS p
SET project_number = numbered.new_project_number
FROM numbered
WHERE p.id = numbered.id;

ALTER TABLE projects
  ADD CONSTRAINT projects_track_check
    CHECK (track IN ('cyber', 'networks', 'data', 'hardware')),
  ADD CONSTRAINT projects_recommended_track_check
    CHECK (
      recommended_track IS NULL OR
      recommended_track IN ('cyber', 'networks', 'data', 'hardware')
    );

COMMIT;

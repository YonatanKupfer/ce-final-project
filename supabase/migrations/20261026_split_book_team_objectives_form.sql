-- Split the academic advisor's combined final_presentation form back in
-- two: final_presentation becomes a single 1-100 presentation score for
-- every role (same as mid_presentation), and teamwork/project_book/
-- objectives (+ the "deliverables submitted on time" declaration) move to
-- their own advisor-only book_team_objectives form, sent separately.
-- The score columns on grading_invites stay as they are — they're simply
-- only populated on book_team_objectives invites from now on.

ALTER TABLE rubric_templates DROP CONSTRAINT IF EXISTS rubric_templates_key_check;
ALTER TABLE rubric_templates ADD CONSTRAINT rubric_templates_key_check
  CHECK (key IN ('mid_presentation', 'final_presentation', 'book_team_objectives'));

INSERT INTO rubric_templates (key, label_he)
VALUES ('book_team_objectives', 'ספר פרויקט, עבודת צוות ועמידה ביעדים')
ON CONFLICT (key) DO NOTHING;

-- Carry over components already submitted through the combined form, as an
-- already-submitted book_team_objectives invite. invite_sent_at is set so
-- the global "send" action never emails a link for a form already filled.
INSERT INTO grading_invites (
  project_id, rubric_template_id, role, recipient_email, recipient_name,
  created_by_email, status, teamwork_score, project_book_score,
  objectives_score, deliverables_on_time, submitted_at, invite_sent_at
)
SELECT
  gi.project_id, bt.id, 'academic_advisor', gi.recipient_email, gi.recipient_name,
  gi.created_by_email, 'submitted', gi.teamwork_score, gi.project_book_score,
  gi.objectives_score, gi.deliverables_on_time, gi.submitted_at,
  COALESCE(gi.invite_sent_at, gi.submitted_at, NOW())
FROM grading_invites gi
JOIN rubric_templates ft ON ft.id = gi.rubric_template_id AND ft.key = 'final_presentation'
CROSS JOIN (SELECT id FROM rubric_templates WHERE key = 'book_team_objectives') bt
WHERE gi.role = 'academic_advisor'
  AND gi.teamwork_score IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE grading_invites gi
SET teamwork_score = NULL,
    project_book_score = NULL,
    objectives_score = NULL,
    deliverables_on_time = NULL
FROM rubric_templates ft
WHERE ft.id = gi.rubric_template_id
  AND ft.key = 'final_presentation';

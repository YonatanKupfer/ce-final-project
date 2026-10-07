-- Redesign mid/final presentation rounds: a single holistic 1-100 score
-- (no rubric/criteria breakdown) replacing the per-criterion rubric form,
-- plus decoupling "assigned" from "emailed" so judges can be assigned
-- ahead of presentations and emailed in one batch afterward, plus a new
-- per-advisor unauthenticated portal link (mirrors project_shares' token
-- pattern) so each academic advisor can manage judge assignments for all
-- of their own projects. book_team_objectives is unaffected except for a
-- new self-declared "deliverables submitted on time" checkbox that now
-- drives projects.prep_report_submitted directly.

-- 1. grading_invites: new columns -------------------------------------

ALTER TABLE grading_invites
  -- Holistic 1-100 score for mid_presentation/final_presentation invites.
  -- book_team_objectives invites keep using `answers` instead; the two
  -- are mutually exclusive by convention (enforced in application code,
  -- same as criteria validity already is), not by a DB constraint.
  ADD COLUMN score NUMERIC CHECK (score IS NULL OR (score BETWEEN 1 AND 100)),
  -- NULL = assigned/created but the token link has never been emailed yet
  -- (e.g. a judge an advisor assigned before the round's presentations).
  -- Non-NULL = the token link has been emailed at least once. Decouples
  -- "who's assigned" (advisor portal) from "who's been notified" (the
  -- admin's one-click global send), replacing the old assumption that
  -- creation == sending.
  ADD COLUMN invite_sent_at TIMESTAMPTZ,
  -- Snapshot of the academic advisor's own declaration, collected as part
  -- of submitting the book_team_objectives form. Mirrors prep_report
  -- moving from admin-toggled to advisor-declared.
  ADD COLUMN deliverables_on_time BOOLEAN;

-- Backfill: invites created under the old flow were emailed immediately
-- at creation time whenever an email was supplied, so treat that moment
-- as "sent" for any pre-existing rows.
UPDATE grading_invites
SET invite_sent_at = created_at
WHERE recipient_email IS NOT NULL AND invite_sent_at IS NULL;

-- 2. Idempotency guards -------------------------------------------------

-- Defensive de-dup in case ad-hoc testing of the (uncommitted) feature
-- already produced duplicates before these constraints existed.
DELETE FROM grading_invites a
USING grading_invites b
WHERE a.id > b.id
  AND a.role = 'academic_advisor'
  AND b.role = 'academic_advisor'
  AND a.project_id = b.project_id
  AND a.rubric_template_id = b.rubric_template_id;

DELETE FROM grading_invites a
USING grading_invites b
WHERE a.id > b.id
  AND a.role = 'judge'
  AND b.role = 'judge'
  AND a.recipient_email IS NOT NULL
  AND b.recipient_email IS NOT NULL
  AND a.project_id = b.project_id
  AND a.rubric_template_id = b.rubric_template_id
  AND lower(a.recipient_email) = lower(b.recipient_email);

-- At most one academic_advisor invite per project+round — lets the
-- global "send round" action safely get-or-create the advisor's own
-- invite on every click without ever duplicating it.
CREATE UNIQUE INDEX idx_grading_invites_one_advisor_per_round
  ON grading_invites (project_id, rubric_template_id)
  WHERE role = 'academic_advisor';

-- At most one judge invite per project+round per distinct email — stops
-- an advisor from assigning the same judge twice to the same round.
-- Manual admin entries with no email (recipient_email IS NULL) are
-- unaffected: Postgres treats NULLs as distinct in a unique index.
CREATE UNIQUE INDEX idx_grading_invites_judge_dedupe
  ON grading_invites (project_id, rubric_template_id, lower(recipient_email))
  WHERE role = 'judge' AND recipient_email IS NOT NULL;

-- 3. Advisor portal access ------------------------------------------------
-- One persistent, non-expiring token per advisor email (get-or-create),
-- mirroring project_shares' token-link convention: unauthenticated access
-- gated entirely behind the service-role client in API routes, never the
-- browser Supabase client. Scoped to an email identity (not to one
-- project or one form) because an advisor needs to manage judge
-- assignments across ALL of their own projects, for both rounds, on an
-- ongoing basis.
CREATE TABLE advisor_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_supervisor_email TEXT NOT NULL,
  academic_supervisor_name TEXT NOT NULL,
  token UUID NOT NULL DEFAULT uuid_generate_v4(),
  created_by_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_advisor_links_token ON advisor_links(token);
CREATE UNIQUE INDEX idx_advisor_links_email ON advisor_links(lower(academic_supervisor_email));

ALTER TABLE advisor_links ENABLE ROW LEVEL SECURITY;

-- 4. Clean up now-dead rubric data for mid/final presentation -----------
-- These sections/criteria are replaced by the single 1-100 score field
-- and are safe to delete outright (not just leave orphaned): nothing
-- references their ids after this redesign (mid/final invites no longer
-- snapshot criteria into `answers`), and leaving them in place would
-- make the admin rubric editor keep showing editable criteria for a form
-- that no longer exists. The rubric_templates rows themselves (mid_id,
-- final_id) are KEPT — grading_invites.rubric_template_id still points
-- at them, and their label_he is still how the UI names each round.
DELETE FROM rubric_criteria
WHERE section_id IN (
  SELECT rs.id FROM rubric_sections rs
  JOIN rubric_templates rt ON rt.id = rs.rubric_template_id
  WHERE rt.key IN ('mid_presentation', 'final_presentation')
);

DELETE FROM rubric_sections
WHERE rubric_template_id IN (
  SELECT id FROM rubric_templates WHERE key IN ('mid_presentation', 'final_presentation')
);

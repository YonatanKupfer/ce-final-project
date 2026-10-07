-- Grading system: weighted grade components (editable per academic year),
-- rubric-based score forms (editable criteria within a fixed structure),
-- and invites for judges/academic advisors to submit scores via an
-- unauthenticated token link (mirrors the project_shares pattern) or have
-- an admin fill them in directly.

-- 8 weighted line items making up a project's final grade, scoped per
-- academic year so past years keep their historical weights.
CREATE TABLE grade_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  key TEXT NOT NULL CHECK (key IN (
    'prep_report', 'objectives', 'teamwork', 'project_book',
    'mid_advisor', 'mid_judges', 'final_advisor', 'final_judges'
  )),
  label_he TEXT NOT NULL,
  weight_percent NUMERIC NOT NULL CHECK (weight_percent >= 0),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (academic_year_id, key)
);

-- The 3 score-entry forms. Not year-scoped: a single evolving live
-- definition. Historical submissions snapshot their own criteria in
-- grading_invites.answers, so editing the live rubric later is safe.
CREATE TABLE rubric_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE CHECK (key IN ('mid_presentation', 'final_presentation', 'book_team_objectives')),
  label_he TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each section maps 1:1 to a grade_components.key and declares which role
-- fills it. mid/final presentation templates get an advisor section and a
-- judges section; book_team_objectives gets 3 advisor-only sections.
CREATE TABLE rubric_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rubric_template_id UUID NOT NULL REFERENCES rubric_templates(id) ON DELETE CASCADE,
  component_key TEXT NOT NULL CHECK (component_key IN (
    'prep_report', 'objectives', 'teamwork', 'project_book',
    'mid_advisor', 'mid_judges', 'final_advisor', 'final_judges'
  )),
  role TEXT NOT NULL CHECK (role IN ('judge', 'academic_advisor')),
  label_he TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rubric_sections_template_id ON rubric_sections(rubric_template_id);

-- The actual editable rubric content: admins rename/re-point/add/remove
-- criteria here through the rubric editor.
CREATE TABLE rubric_criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID NOT NULL REFERENCES rubric_sections(id) ON DELETE CASCADE,
  label_he TEXT NOT NULL,
  max_points NUMERIC NOT NULL CHECK (max_points > 0),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rubric_criteria_section_id ON rubric_criteria(section_id);

-- One row per person scoring one form for one project. Judges each get
-- their own row so multiple judge scores can be averaged. Admin manual
-- entry uses the same row/shape, just filled in without ever emailing a
-- token link.
CREATE TABLE grading_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rubric_template_id UUID NOT NULL REFERENCES rubric_templates(id),
  role TEXT NOT NULL CHECK (role IN ('judge', 'academic_advisor')),
  token UUID NOT NULL DEFAULT uuid_generate_v4(),
  recipient_email TEXT,
  recipient_name TEXT,
  admin_note TEXT,
  created_by_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted')),
  -- Snapshot of {criterion_id, label_snapshot, max_points_snapshot, points_awarded}[]
  -- so later rubric edits never corrupt a past submission.
  answers JSONB,
  submitted_at TIMESTAMPTZ,
  reminder_count INTEGER NOT NULL DEFAULT 0,
  last_reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_grading_invites_token ON grading_invites(token);
CREATE INDEX idx_grading_invites_project_id ON grading_invites(project_id);
CREATE INDEX idx_grading_invites_rubric_template_id ON grading_invites(rubric_template_id);

-- Prep report: no rubric, just a submitted/not-submitted mark worth its
-- own component weight.
ALTER TABLE projects
  ADD COLUMN prep_report_submitted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN prep_report_marked_at TIMESTAMPTZ;

-- RLS enabled, no permissive policies: both the admin flow and the
-- external token flow go exclusively through API routes using the
-- service-role client, never the browser Supabase client (same
-- convention as project_shares).
ALTER TABLE grade_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_invites ENABLE ROW LEVEL SECURITY;

-- Seed the 3 live rubric templates + their sections + a reasonable
-- starting set of criteria (100 points per section). Admins can rename,
-- re-point, add, or remove criteria afterward via the rubric editor.
DO $$
DECLARE
  mid_id UUID;
  final_id UUID;
  book_id UUID;
  sec_id UUID;
BEGIN
  INSERT INTO rubric_templates (key, label_he) VALUES ('mid_presentation', 'מצגת אמצע') RETURNING id INTO mid_id;
  INSERT INTO rubric_templates (key, label_he) VALUES ('final_presentation', 'מצגת סיום') RETURNING id INTO final_id;
  INSERT INTO rubric_templates (key, label_he) VALUES ('book_team_objectives', 'ספר פרויקט, עבודת צוות ועמידה ביעדים') RETURNING id INTO book_id;

  -- mid_presentation: advisor + judges
  INSERT INTO rubric_sections (rubric_template_id, component_key, role, label_he, sort_order)
    VALUES (mid_id, 'mid_advisor', 'academic_advisor', 'ניקוד א. אקדמי על מצגת אמצע', 0) RETURNING id INTO sec_id;
  INSERT INTO rubric_criteria (section_id, label_he, max_points, sort_order) VALUES
    (sec_id, 'התקדמות הפרויקט ביחס ליעדים', 40, 0),
    (sec_id, 'איכות העבודה וההבנה המקצועית', 30, 1),
    (sec_id, 'תקשורת ומענה לשאלות', 30, 2);

  INSERT INTO rubric_sections (rubric_template_id, component_key, role, label_he, sort_order)
    VALUES (mid_id, 'mid_judges', 'judge', 'ניקוד שופטים על מצגת אמצע', 1) RETURNING id INTO sec_id;
  INSERT INTO rubric_criteria (section_id, label_he, max_points, sort_order) VALUES
    (sec_id, 'תוכן ואיכות המצגת', 40, 0),
    (sec_id, 'בהירות ההצגה', 30, 1),
    (sec_id, 'מענה לשאלות', 30, 2);

  -- final_presentation: advisor + judges
  INSERT INTO rubric_sections (rubric_template_id, component_key, role, label_he, sort_order)
    VALUES (final_id, 'final_advisor', 'academic_advisor', 'ניקוד א. אקדמי על מצגת סיום', 0) RETURNING id INTO sec_id;
  INSERT INTO rubric_criteria (section_id, label_he, max_points, sort_order) VALUES
    (sec_id, 'עמידה ביעדי הפרויקט', 40, 0),
    (sec_id, 'איכות התוצר הסופי', 30, 1),
    (sec_id, 'תקשורת ומענה לשאלות', 30, 2);

  INSERT INTO rubric_sections (rubric_template_id, component_key, role, label_he, sort_order)
    VALUES (final_id, 'final_judges', 'judge', 'ניקוד שופטים על מצגת סיום', 1) RETURNING id INTO sec_id;
  INSERT INTO rubric_criteria (section_id, label_he, max_points, sort_order) VALUES
    (sec_id, 'תוכן ואיכות המצגת', 40, 0),
    (sec_id, 'בהירות ההצגה', 30, 1),
    (sec_id, 'מענה לשאלות', 30, 2);

  -- book_team_objectives: 3 advisor-only sections
  INSERT INTO rubric_sections (rubric_template_id, component_key, role, label_he, sort_order)
    VALUES (book_id, 'objectives', 'academic_advisor', 'עמידה ביעדים', 0) RETURNING id INTO sec_id;
  INSERT INTO rubric_criteria (section_id, label_he, max_points, sort_order) VALUES
    (sec_id, 'עמידה בלוחות זמנים', 50, 0),
    (sec_id, 'השגת יעדי הפרויקט', 50, 1);

  INSERT INTO rubric_sections (rubric_template_id, component_key, role, label_he, sort_order)
    VALUES (book_id, 'teamwork', 'academic_advisor', 'עבודת צוות', 1) RETURNING id INTO sec_id;
  INSERT INTO rubric_criteria (section_id, label_he, max_points, sort_order) VALUES
    (sec_id, 'שיתוף פעולה בין חברי הצוות', 50, 0),
    (sec_id, 'חלוקת עבודה והתנהלות', 50, 1);

  INSERT INTO rubric_sections (rubric_template_id, component_key, role, label_he, sort_order)
    VALUES (book_id, 'project_book', 'academic_advisor', 'ספר פרויקט', 2) RETURNING id INTO sec_id;
  INSERT INTO rubric_criteria (section_id, label_he, max_points, sort_order) VALUES
    (sec_id, 'תוכן מקצועי', 40, 0),
    (sec_id, 'מבנה וכתיבה', 30, 1),
    (sec_id, 'עמידה בדרישות הפורמט', 30, 2);
END $$;

-- Seed default grade_components (5/19/19/19/9/5/9/15) for every existing
-- academic year, so the feature works immediately without requiring a new
-- year to be created first.
INSERT INTO grade_components (academic_year_id, key, label_he, weight_percent, sort_order)
SELECT y.id, c.key, c.label_he, c.weight_percent, c.sort_order
FROM academic_years y
CROSS JOIN (VALUES
  ('prep_report', 'דו"ח מכין', 5, 0),
  ('objectives', 'עמידה ביעדים', 19, 1),
  ('teamwork', 'עבודת צוות', 19, 2),
  ('project_book', 'ספר פרויקט', 19, 3),
  ('mid_advisor', 'ניקוד א. אקדמי על מצגת אמצע', 9, 4),
  ('mid_judges', 'ניקוד שופטים על מצגת אמצע', 5, 5),
  ('final_advisor', 'ניקוד א. אקדמי על מצגת סיום', 9, 6),
  ('final_judges', 'ניקוד שופטים על מצגת סיום', 15, 7)
) AS c(key, label_he, weight_percent, sort_order)
ON CONFLICT (academic_year_id, key) DO NOTHING;

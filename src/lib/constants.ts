export const TRACKS = {
    cyber: { id: "cyber", label: "Cyber Security", numberStart: 101 },
    networks: { id: "networks", label: "Networks and Computation", numberStart: 201 },
    data: { id: "data", label: "Data Analysis and Processing", numberStart: 301 },
    hardware: { id: "hardware", label: "Hardware Design", numberStart: 401 },
} as const;

export const TRACK_IDS = ["cyber", "networks", "data", "hardware"] as const;

export type TrackId = keyof typeof TRACKS;

export const TRACK_LIST = Object.values(TRACKS);

export const REQUIRED_COURSES = [
    { id: "83102", name: "פיזיקה 1" },
    { id: "83110", name: "אלגברה לינארית" },
    { id: "83112", name: "חשבון דיפרנציאלי ואינטגרלי 1" },
    { id: "83108", name: "קומבינטוריקה" },
    { id: "83120", name: "מבוא להנדסת תוכנה ומחשבים" },
    { id: "83103", name: "פיזיקה 2" },
    { id: "83114", name: "חשבון דיפרנציאלי ואינטגרלי 2" },
    { id: "83115", name: "משוואות דיפרנציאליות רגילות" },
    { id: "83109", name: "תורת הקבוצות ולוגיקה" },
    { id: "83119", name: "מבני נתונים ואלגוריתמים 1" },
    { id: "83140", name: "מערכות לוגיות ספרתיות" },
    { id: "83011", name: "תכנות פייתון" },
    { id: "83206", name: "מערכות לינאריות" },
    { id: "83210", name: "אנליזה הרמונית" },
    { id: "83211", name: "פונקציות מרוכבות" },
    { id: "83223", name: "תכנות מונחה עצמים" },
    { id: "83237", name: "מבוא להנדסת חשמל" },
    { id: "83253", name: "תכן לוגי" },
    { id: "83501", name: "מבוא להסתברות" },
    { id: "83218", name: "מבנים אלגבריים" },
    { id: "83224", name: "מבני נתונים ואלגוריתמים 2" },
    { id: "83238", name: "מעבדה במבוא להנדסת חשמל" },
    { id: "83245", name: "אותות ומערכות" },
    { id: "83255", name: "מיקרו מעבדים ושפת אסמבלר" },
    { id: "83250", name: "אוטומטים וחישוביות" },
    { id: "83203", name: "מבוא למעגלים" },
    { id: "83302", name: "אותות אקראיים ורעש" },
    { id: "83317", name: "מעבדה במערכות משובצות" },
    { id: "83381", name: "מערכות הפעלה" },
    { id: "83455", name: "רשתות מחשבים ואינטרנט" },
    { id: "83458", name: "מבוא לקריפטוגרפיה" },
    { id: "83323", name: "תכן מעגלים ספרתיים" },
    { id: "83622", name: "מבוא ללמידת מכונה" },
    { id: "83301", name: "מבנה מחשבים ספרתיים" },
] as const;

export function requiredCourseLabel(course: (typeof REQUIRED_COURSES)[number]): string {
    return `${course.id} - ${course.name}`;
}

const LEGACY_TRACK_MAP: Record<string, TrackId> = {
    crypto: "cyber",
    networks: "networks",
    algorithms: "networks",
    software: "networks",
    ai: "data",
    signal: "data",
    hardware: "hardware",
};

export function normalizeTrack(track: string | null | undefined): TrackId {
    if (!track) return "cyber";
    if (track in TRACKS) return track as TrackId;
    return LEGACY_TRACK_MAP[track] ?? "cyber";
}

export type ProjectStatus = "pending" | "review" | "approved" | "rejected";
export type RegistrationStatus = "pending" | "approved" | "rejected";

export interface AcademicYear {
    id: string;
    slug: string;
    label_en: string;
    label_he: string;
    is_active: boolean;
    created_at: string;
}

export function academicYearLabel(year: AcademicYear, locale: string): string {
    return locale === "he" ? year.label_he : year.label_en;
}

export interface Project {
    id: string;
    project_number: number | null;
    status: ProjectStatus;
    title_he: string;
    title_en: string;
    track: TrackId;
    recommended_track: TrackId | null;
    supervisors_name: string;
    supervisors_email: string;
    academic_supervisor_name: string;
    academic_supervisor_email: string;
    abstract: string;
    objective: string;
    scope: string;
    relevant_required_course_1: string | null;
    relevant_required_course_2: string | null;
    prereq_course_1: string | null;
    prereq_course_2: string | null;
    references_text: string;
    ai_complexity_justification: string | null;
    review_notes: string | null;
    edit_token: string;
    is_taken: boolean;
    academic_year_id: string | null;
    prep_report_submitted: boolean;
    prep_report_marked_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface ProjectShare {
    id: string;
    project_id: string;
    token: string;
    admin_note: string | null;
    created_by_email: string;
    created_at: string;
    recipients?: ProjectShareRecipient[];
    comments?: ProjectShareComment[];
}

export interface ProjectShareRecipient {
    id: string;
    share_id: string;
    email: string;
    name: string | null;
    created_at: string;
}

export interface ProjectShareComment {
    id: string;
    share_id: string;
    comment_text: string;
    author_label: string;
    created_at: string;
}

// Public-safe subset of Project fields — the only ones an external reviewer
// (non-admin, accessing via a shared-project token link) may see.
// Keep in sync with the SELECT list in /api/shared-project/[token]/route.ts.
export type PublicSafeProject = Pick<
    Project,
    | "id" | "project_number" | "title_he" | "title_en" | "track" | "recommended_track"
    | "supervisors_name" | "academic_supervisor_name" | "abstract" | "objective" | "scope"
    | "relevant_required_course_1" | "relevant_required_course_2"
    | "prereq_course_1" | "prereq_course_2" | "references_text"
>;

export const GRADE_COMPONENT_KEYS = [
    "prep_report", "objectives", "teamwork", "project_book",
    "mid_advisor", "mid_judges", "final_advisor", "final_judges",
] as const;

export type GradeComponentKey = (typeof GRADE_COMPONENT_KEYS)[number];

// Every grading form is now a fixed set of plain 1-100 fields — there is
// no rubric/criteria mechanism anymore. mid_presentation and
// final_presentation are the only two forms; the former third form
// (book/team/objectives) was retired and folded into the academic
// advisor's final_presentation form (see isAdvisorFinalCombinedForm).
export const RUBRIC_TEMPLATE_KEYS = ["mid_presentation", "final_presentation"] as const;
export type RubricTemplateKey = (typeof RUBRIC_TEMPLATE_KEYS)[number];

export type GradingRole = "judge" | "academic_advisor";
export type GradingInviteStatus = "pending" | "submitted";

// The academic advisor's final_presentation invite is the one combined
// form: the presentation score itself plus teamwork/project_book/
// objectives, each shown with its live weight_percent. Every other
// (template, role) pair is a single plain score field with no weight
// shown.
export function isAdvisorFinalCombinedForm(templateKey: RubricTemplateKey, role: GradingRole): boolean {
    return templateKey === "final_presentation" && role === "academic_advisor";
}

// The (template, role) pair alone determines which presentation-round
// grade component a single-score invite's score counts toward.
export function roundComponentKey(templateKey: RubricTemplateKey, role: GradingRole): GradeComponentKey {
    if (templateKey === "mid_presentation") return role === "academic_advisor" ? "mid_advisor" : "mid_judges";
    return role === "academic_advisor" ? "final_advisor" : "final_judges";
}

// One persistent, non-expiring portal token per academic advisor email —
// lets them manage judge assignments across all of their own projects.
export interface AdvisorLink {
    id: string;
    academic_supervisor_email: string;
    academic_supervisor_name: string;
    token: string;
    created_by_email: string;
    created_at: string;
}

// Which roles are allowed to fill each form — drives the "role" choice
// when an admin sends/creates a grading invite.
export const RUBRIC_TEMPLATE_ROLES: Record<RubricTemplateKey, GradingRole[]> = {
    mid_presentation: ["academic_advisor", "judge"],
    final_presentation: ["academic_advisor", "judge"],
};

export const GRADING_ROLE_LABELS: Record<GradingRole, string> = {
    judge: "שופט/ת",
    academic_advisor: "אחראי.ת אקדמי.ת",
};

// Default weights (must sum to 100), used to seed a new academic year when
// no prior year's weights are available to copy.
export const GRADE_COMPONENT_DEFAULTS: {
    key: GradeComponentKey;
    label_he: string;
    weight_percent: number;
    sort_order: number;
}[] = [
    { key: "prep_report", label_he: 'דו"ח מכין', weight_percent: 5, sort_order: 0 },
    { key: "objectives", label_he: "עמידה ביעדים", weight_percent: 19, sort_order: 1 },
    { key: "teamwork", label_he: "עבודת צוות", weight_percent: 19, sort_order: 2 },
    { key: "project_book", label_he: "ספר פרויקט", weight_percent: 19, sort_order: 3 },
    { key: "mid_advisor", label_he: "ניקוד א. אקדמי על מצגת אמצע", weight_percent: 9, sort_order: 4 },
    { key: "mid_judges", label_he: "ניקוד שופטים על מצגת אמצע", weight_percent: 5, sort_order: 5 },
    { key: "final_advisor", label_he: "ניקוד א. אקדמי על מצגת סיום", weight_percent: 9, sort_order: 6 },
    { key: "final_judges", label_he: "ניקוד שופטים על מצגת סיום", weight_percent: 15, sort_order: 7 },
];

export interface GradeComponent {
    id: string;
    academic_year_id: string;
    key: GradeComponentKey;
    label_he: string;
    weight_percent: number;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface RubricTemplate {
    id: string;
    key: RubricTemplateKey;
    label_he: string;
}

export interface GradingInvite {
    id: string;
    project_id: string;
    rubric_template_id: string;
    role: GradingRole;
    token: string;
    recipient_email: string | null;
    recipient_name: string | null;
    admin_note: string | null;
    created_by_email: string;
    status: GradingInviteStatus;
    // The presentation score itself (mid_advisor/mid_judges/final_advisor/
    // final_judges depending on template+role).
    score: number | null;
    // Only populated on the academic advisor's final_presentation invite —
    // see isAdvisorFinalCombinedForm.
    teamwork_score: number | null;
    project_book_score: number | null;
    objectives_score: number | null;
    invite_sent_at: string | null;
    deliverables_on_time: boolean | null;
    submitted_at: string | null;
    reminder_count: number;
    last_reminder_sent_at: string | null;
    created_at: string;
}

export interface Registration {
    id: string;
    project_id: string;
    status: RegistrationStatus;
    student1_name: string;
    student1_id: string;
    student1_email: string;
    student2_name: string | null;
    student2_id: string | null;
    student2_email: string | null;
    is_ce_student: boolean;
    approval_token: string;
    reminder_count: number;
    last_reminder_sent_at: string | null;
    created_at: string;
    project?: Project;
}

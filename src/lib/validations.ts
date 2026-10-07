import { z } from "zod/v4";
import { TRACK_IDS, GRADE_COMPONENT_KEYS, RUBRIC_TEMPLATE_KEYS } from "@/lib/constants";

export const projectFormSchema = z.object({
    title_he: z.string().min(1, "שדה חובה"),
    title_en: z.string().min(1, "Required field"),
    track: z.enum(TRACK_IDS),
    recommended_track: z.enum([...TRACK_IDS, ""]),
    supervisors_name: z.string().min(1, "שדה חובה"),
    supervisors_email: z.string().email("כתובת אימייל לא תקינה"),
    academic_supervisor_name: z.string().min(1, "שדה חובה"),
    academic_supervisor_email: z.string().email("כתובת אימייל לא תקינה"),
    abstract: z.string().min(10, "נא להזין תקציר מפורט"),
    objective: z.string().min(10, "נא להזין מטרה מפורטת"),
    scope: z.string().min(10, "נא להזין תכולה מפורטת"),
    relevant_required_course_1: z.string(),
    relevant_required_course_2: z.string(),
    prereq_course_1: z.string(),
    prereq_course_2: z.string(),
    references_text: z.string().min(1, "שדה חובה"),
    ai_complexity_justification: z.string(),
});

export type ProjectFormData = z.infer<typeof projectFormSchema>;

export const registrationFormSchema = z.object({
    project_id: z.string().min(1, "נא לבחור פרויקט"),
    student1_name: z.string().min(1, "שדה חובה"),
    student1_id: z.string().min(1, "שדה חובה"),
    student1_email: z.string().email("כתובת אימייל לא תקינה"),
    student2_name: z.string(),
    student2_id: z.string(),
    student2_email: z.string(),
    is_ce_student: z.boolean().refine((val) => val === true, "נדרש אישור"),
});

export type RegistrationFormData = z.infer<typeof registrationFormSchema>;

export const shareProjectSchema = z.object({
    recipients: z.array(z.object({
        email: z.string().email("כתובת אימייל לא תקינה"),
        name: z.string(),
    })).min(1, "יש להוסיף לפחות נמען אחד"),
    admin_note: z.string(),
    created_by_email: z.string().min(1),
});

export const shareCommentSchema = z.object({
    author_name: z.string().min(1, "נא להזין שם"),
    comment_text: z.string().min(1, "נא להזין תגובה"),
});

// recipient_email is optional: an empty value means the admin will enter
// the score directly (manual entry) instead of emailing a token link.
export const gradingInviteCreateSchema = z.object({
    rubric_template_key: z.enum(RUBRIC_TEMPLATE_KEYS),
    role: z.enum(["judge", "academic_advisor"]),
    recipient_email: z.union([z.string().email("כתובת אימייל לא תקינה"), z.literal("")]),
    recipient_name: z.string(),
    admin_note: z.string(),
    created_by_email: z.string().min(1),
});

const score1to100 = z.number().min(1, "הציון חייב להיות בין 1 ל-100").max(100, "הציון חייב להיות בין 1 ל-100");

// Holistic 1-100 score — used by every single-field form (judges on
// either round, and the academic advisor's mid_presentation form).
export const judgeScoreSubmitSchema = z.object({
    score: score1to100,
});

// The academic advisor's combined final_presentation form: the
// presentation score plus the three components folded in from the
// retired book/team/objectives form, plus the advisor's own
// "deliverables submitted on time" declaration (cascades to
// projects.prep_report_submitted).
export const advisorFinalScoreSubmitSchema = z.object({
    final_advisor: score1to100,
    teamwork: score1to100,
    project_book: score1to100,
    objectives: score1to100,
    deliverables_on_time: z.boolean(),
});

// Advisor-portal judge assignment. role is always 'judge' and
// created_by_email is derived server-side from the advisor_links token,
// so this is intentionally narrower than gradingInviteCreateSchema.
export const advisorJudgeAssignSchema = z.object({
    rubric_template_key: z.enum(RUBRIC_TEMPLATE_KEYS),
    recipient_name: z.string().min(1, "שדה חובה"),
    recipient_email: z.string().email("כתובת אימייל לא תקינה"),
});

export const advisorLinkCreateSchema = z.object({
    academic_supervisor_email: z.string().email("כתובת אימייל לא תקינה"),
    academic_supervisor_name: z.string().min(1, "שדה חובה"),
    created_by_email: z.string().min(1),
});

export const gradeWeightsUpdateSchema = z.object({
    weights: z.array(z.object({
        key: z.enum(GRADE_COMPONENT_KEYS),
        weight_percent: z.number().min(0).max(100),
    })).length(GRADE_COMPONENT_KEYS.length, "יש להזין משקל לכל המרכיבים"),
}).refine(
    (data) => Math.abs(data.weights.reduce((sum, w) => sum + w.weight_percent, 0) - 100) < 0.01,
    { message: "סכום המשקלים חייב להיות 100%", path: ["weights"] }
);


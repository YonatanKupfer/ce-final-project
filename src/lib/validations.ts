import { z } from "zod/v4";
import { TRACK_IDS } from "@/lib/constants";

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
    recipient_email: z.string().email("כתובת אימייל לא תקינה"),
    recipient_name: z.string(),
    admin_note: z.string(),
    created_by_email: z.string().min(1),
});

export const shareCommentSchema = z.object({
    comment_text: z.string().min(1, "נא להזין תגובה"),
});

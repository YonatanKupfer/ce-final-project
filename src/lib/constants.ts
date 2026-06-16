export const TRACKS = {
    cyber: { id: "cyber", label: "Cyber Security", numberStart: 101 },
    networks: { id: "networks", label: "Networks and Computation", numberStart: 201 },
    data: { id: "data", label: "Data Analysis and Processing", numberStart: 301 },
    hardware: { id: "hardware", label: "Hardware Design", numberStart: 401 },
} as const;

export const TRACK_IDS = ["cyber", "networks", "data", "hardware"] as const;

export type TrackId = keyof typeof TRACKS;

export const TRACK_LIST = Object.values(TRACKS);

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
    prereq_course_1: string | null;
    prereq_course_2: string | null;
    references_text: string;
    review_notes: string | null;
    edit_token: string;
    is_taken: boolean;
    academic_year_id: string | null;
    created_at: string;
    updated_at: string;
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
    created_at: string;
    project?: Project;
}

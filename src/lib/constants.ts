export const TRACKS = {
    crypto: { id: "crypto", label: "Cryptography and Cybersecurity", numberStart: 101 },
    hardware: { id: "hardware", label: "Hardware and Chip Design", numberStart: 201 },
    networks: { id: "networks", label: "Networks, Information and Quantum Computing", numberStart: 301 },
    algorithms: { id: "algorithms", label: "Algorithms and Optimization", numberStart: 401 },
    software: { id: "software", label: "Software Development", numberStart: 501 },
    ai: { id: "ai", label: "AI and Data Analysis", numberStart: 601 },
    signal: { id: "signal", label: "Signal Processing, Images and Graphics", numberStart: 701 },
} as const;

export type TrackId = keyof typeof TRACKS;

export const TRACK_LIST = Object.values(TRACKS);

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

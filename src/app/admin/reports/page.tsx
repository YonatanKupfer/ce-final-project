"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminYear } from "@/app/admin/year-context";
import { downloadCsv } from "@/lib/csv";
import type { Project, Registration, TrackId } from "@/lib/constants";
import { TRACK_LIST, TRACKS, normalizeTrack } from "@/lib/constants";

type ProjectWithYear = Project & {
    academic_year?: {
        label_he: string;
        label_en: string;
        slug: string;
    } | null;
};

type RegistrationWithProject = Registration & {
    project?: ProjectWithYear | null;
};

type StatusSummary = {
    track: TrackId;
    total: number;
    pending: number;
    review: number;
    approved: number;
    rejected: number;
    occupied: number;
    availableApproved: number;
};

const PROJECT_HEADERS = [
    "מספר פרויקט",
    "סטטוס",
    "מאויש",
    "אשכול",
    "אשכול מומלץ נוסף",
    "שם עברית",
    "שם אנגלית",
    "מנחה",
    "מייל מנחה",
    "אחראי אקדמי",
    "מייל אחראי אקדמי",
    "תקציר",
    "מטרה",
    "היקף",
    "קורס חובה רלוונטי 1",
    "קורס חובה רלוונטי 2",
    "קורס קדם 1",
    "קורס קדם 2",
    "מקורות",
    "הערות בדיקה",
    "שנה אקדמית",
    "נוצר בתאריך",
    "עודכן בתאריך",
];

const ASSIGNED_HEADERS = [
    "מספר פרויקט",
    "אשכול",
    "שם פרויקט עברית",
    "שם פרויקט אנגלית",
    "מנחה",
    "מייל מנחה",
    "אחראי אקדמי",
    "מייל אחראי אקדמי",
    "תקציר",
    "מטרה",
    "היקף",
    "קורס חובה רלוונטי 1",
    "קורס חובה רלוונטי 2",
    "קורס קדם 1",
    "קורס קדם 2",
    "מקורות",
    "סטודנט 1",
    "תז סטודנט 1",
    "מייל סטודנט 1",
    "סטודנט 2",
    "תז סטודנט 2",
    "מייל סטודנט 2",
    "סטודנטים בהנדסת מחשבים",
    "תאריך הרשמה",
    "שנה אקדמית",
];

const SUMMARY_HEADERS = [
    "אשכול",
    "סהכ פרויקטים",
    "ממתינים",
    "בבדיקה",
    "מאושרים",
    "נדחו",
    "מאוישים",
    "מאושרים פנויים",
];

function formatDate(value: string | null | undefined) {
    if (!value) return "";
    return new Date(value).toLocaleString("he-IL");
}

function yearLabel(project?: ProjectWithYear | null) {
    if (!project?.academic_year) return "";
    return `${project.academic_year.label_he} / ${project.academic_year.label_en}`;
}

function projectRow(project: ProjectWithYear) {
    const track = normalizeTrack(project.track);
    const recommendedTrack = project.recommended_track
        ? normalizeTrack(project.recommended_track)
        : null;

    return [
        project.project_number,
        project.status,
        project.is_taken ? "כן" : "לא",
        TRACKS[track].label,
        recommendedTrack ? TRACKS[recommendedTrack].label : "",
        project.title_he,
        project.title_en,
        project.supervisors_name,
        project.supervisors_email,
        project.academic_supervisor_name,
        project.academic_supervisor_email,
        project.abstract,
        project.objective,
        project.scope,
        project.relevant_required_course_1,
        project.relevant_required_course_2,
        project.prereq_course_1,
        project.prereq_course_2,
        project.references_text,
        project.review_notes,
        yearLabel(project),
        formatDate(project.created_at),
        formatDate(project.updated_at),
    ];
}

function assignedRow(registration: RegistrationWithProject) {
    const project = registration.project;
    const track = normalizeTrack(project?.track);

    return [
        project?.project_number,
        TRACKS[track].label,
        project?.title_he,
        project?.title_en,
        project?.supervisors_name,
        project?.supervisors_email,
        project?.academic_supervisor_name,
        project?.academic_supervisor_email,
        project?.abstract,
        project?.objective,
        project?.scope,
        project?.relevant_required_course_1,
        project?.relevant_required_course_2,
        project?.prereq_course_1,
        project?.prereq_course_2,
        project?.references_text,
        registration.student1_name,
        registration.student1_id,
        registration.student1_email,
        registration.student2_name,
        registration.student2_id,
        registration.student2_email,
        registration.is_ce_student ? "כן" : "לא",
        formatDate(registration.created_at),
        yearLabel(project),
    ];
}

function buildSummary(projects: ProjectWithYear[]): StatusSummary[] {
    const initial = new Map<TrackId, StatusSummary>();

    for (const track of TRACK_LIST) {
        initial.set(track.id, {
            track: track.id,
            total: 0,
            pending: 0,
            review: 0,
            approved: 0,
            rejected: 0,
            occupied: 0,
            availableApproved: 0,
        });
    }

    for (const project of projects) {
        const track = normalizeTrack(project.track);
        const summary = initial.get(track);
        if (!summary) continue;

        summary.total += 1;
        summary[project.status] += 1;
        if (project.is_taken) summary.occupied += 1;
        if (project.status === "approved" && !project.is_taken) {
            summary.availableApproved += 1;
        }
    }

    return Array.from(initial.values());
}

function filename(prefix: string, selectedYearSlug: string | undefined) {
    const date = new Date().toISOString().slice(0, 10);
    return `${prefix}-${selectedYearSlug || "all-years"}-${date}.csv`;
}

export default function AdminReportsPage() {
    const [projects, setProjects] = useState<ProjectWithYear[]>([]);
    const [registrations, setRegistrations] = useState<RegistrationWithProject[]>([]);
    const [loading, setLoading] = useState(true);
    const { selectedYear } = useAdminYear();
    const supabase = createSupabaseBrowserClient();

    const loadReportsData = useCallback(async () => {
        setLoading(true);

        let projectQuery = supabase
            .from("projects")
            .select("*, academic_year:academic_years(label_he, label_en, slug)")
            .order("project_number", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: false });

        if (selectedYear) {
            projectQuery = projectQuery.eq("academic_year_id", selectedYear.id);
        }

        const { data: projectData } = await projectQuery;

        const { data: registrationData } = await supabase
            .from("registrations")
            .select("*, project:projects(*, academic_year:academic_years(label_he, label_en, slug))")
            .order("created_at", { ascending: false });

        const allRegistrations = (registrationData as RegistrationWithProject[]) || [];
        const filteredRegistrations = selectedYear
            ? allRegistrations.filter((registration) => (
                registration.project?.academic_year_id === selectedYear.id
            ))
            : allRegistrations;

        setProjects((projectData as ProjectWithYear[]) || []);
        setRegistrations(filteredRegistrations);
        setLoading(false);
    }, [selectedYear, supabase]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            void loadReportsData();
        }, 0);
        return () => clearTimeout(timeout);
    }, [loadReportsData]);

    const assignedRegistrations = useMemo(
        () => registrations.filter((registration) => (
            registration.status === "approved" && !!registration.project
        )),
        [registrations]
    );
    const summary = useMemo(() => buildSummary(projects), [projects]);
    const selectedYearSlug = selectedYear?.slug;

    const exportAllProjects = () => {
        downloadCsv(
            filename("all-projects", selectedYearSlug),
            PROJECT_HEADERS,
            projects.map(projectRow)
        );
    };

    const exportAssignedProjects = () => {
        downloadCsv(
            filename("assigned-projects", selectedYearSlug),
            ASSIGNED_HEADERS,
            assignedRegistrations.map(assignedRow)
        );
    };

    const exportStatusSummary = () => {
        downloadCsv(
            filename("status-summary", selectedYearSlug),
            SUMMARY_HEADERS,
            summary.map((row) => [
                TRACKS[row.track].label,
                row.total,
                row.pending,
                row.review,
                row.approved,
                row.rejected,
                row.occupied,
                row.availableApproved,
            ])
        );
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <h1 className="text-xl sm:text-2xl font-bold">דוחות</h1>
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">דוחות אקסל</h1>
                    <p className="text-sm text-muted-foreground">
                        הייצוא הוא CSV שנפתח באקסל. הדוחות מסוננים לפי השנה שנבחרה בתפריט הניהול.
                    </p>
                </div>
                {selectedYear && (
                    <Badge variant="secondary" className="px-3 py-2">
                        {selectedYear.label_he} / {selectedYear.label_en}
                    </Badge>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>כל הפרויקטים</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            כולל פרויקטים מאושרים, נדחים, ממתינים ובבדיקה, עם כל שדות הפרויקט.
                        </p>
                        <Badge variant="outline">{projects.length} פרויקטים</Badge>
                        <Button className="w-full" onClick={exportAllProjects} disabled={projects.length === 0}>
                            ייצוא כל הפרויקטים
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>פרויקטים מאוישים</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            כולל את פרטי הפרויקט המלאים ואת פרטי הסטודנטים שאושרו לפרויקט.
                        </p>
                        <Badge variant="outline">{assignedRegistrations.length} פרויקטים מאוישים</Badge>
                        <Button
                            className="w-full"
                            onClick={exportAssignedProjects}
                            disabled={assignedRegistrations.length === 0}
                        >
                            ייצוא פרויקטים מאוישים
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>סיכום לפי אשכול וסטטוס</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            דוח בקרה קצר שמראה כמה פרויקטים יש בכל אשכול לפי סטטוס, כולל פנויים ומאוישים.
                        </p>
                        <Badge variant="outline">{summary.length} אשכולות</Badge>
                        <Button className="w-full" variant="outline" onClick={exportStatusSummary}>
                            ייצוא סיכום סטטוסים
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

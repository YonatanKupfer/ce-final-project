import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

// POST /api/admin/projects/[id]/carry-over
// Copies a single project into the currently-active academic year.
export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = getAdminClient();

    // Fetch the source project
    const { data: project, error: fetchError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

    if (fetchError || !project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Fetch the active year
    const { data: activeYear, error: activeYearError } = await supabase
        .from("academic_years")
        .select("id")
        .eq("is_active", true)
        .single();

    if (activeYearError || !activeYear) {
        return NextResponse.json({ error: "No active academic year found" }, { status: 400 });
    }

    if (project.academic_year_id === activeYear.id) {
        return NextResponse.json({ error: "Project already belongs to the active year" }, { status: 400 });
    }

    // Insert the copy into the active year
    const { data: copy, error: insertError } = await supabase
        .from("projects")
        .insert({
            academic_year_id: activeYear.id,
            title_he: project.title_he,
            title_en: project.title_en,
            track: project.track,
            recommended_track: project.recommended_track,
            supervisors_name: project.supervisors_name,
            supervisors_email: project.supervisors_email,
            academic_supervisor_name: project.academic_supervisor_name,
            academic_supervisor_email: project.academic_supervisor_email,
            abstract: project.abstract,
            objective: project.objective,
            scope: project.scope,
            prereq_course_1: project.prereq_course_1,
            prereq_course_2: project.prereq_course_2,
            references_text: project.references_text,
            status: "approved",
            is_taken: false,
        })
        .select()
        .single();

    if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, project: copy });
}

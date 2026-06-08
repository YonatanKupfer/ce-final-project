import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

// POST /api/admin/academic-years/[id]/carry-over
// Copies all approved + not-taken projects from year [id] into the currently-active year.
export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: sourceYearId } = await params;
    const supabase = getAdminClient();

    // Get the active year
    const { data: activeYear, error: activeYearError } = await supabase
        .from("academic_years")
        .select("id")
        .eq("is_active", true)
        .single();

    if (activeYearError || !activeYear) {
        return NextResponse.json({ error: "No active academic year found" }, { status: 400 });
    }

    if (activeYear.id === sourceYearId) {
        return NextResponse.json({ error: "Cannot carry over projects from the active year into itself" }, { status: 400 });
    }

    // Fetch eligible projects from the source year
    const { data: projects, error: fetchError } = await supabase
        .from("projects")
        .select("*")
        .eq("academic_year_id", sourceYearId)
        .eq("status", "approved")
        .eq("is_taken", false);

    if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!projects || projects.length === 0) {
        return NextResponse.json({ success: true, count: 0 });
    }

    // Build copies — reset fields that should be fresh for the new year
    const copies = projects.map((p) => ({
        academic_year_id: activeYear.id,
        title_he: p.title_he,
        title_en: p.title_en,
        track: p.track,
        recommended_track: p.recommended_track,
        supervisors_name: p.supervisors_name,
        supervisors_email: p.supervisors_email,
        academic_supervisor_name: p.academic_supervisor_name,
        academic_supervisor_email: p.academic_supervisor_email,
        abstract: p.abstract,
        objective: p.objective,
        scope: p.scope,
        prereq_course_1: p.prereq_course_1,
        prereq_course_2: p.prereq_course_2,
        references_text: p.references_text,
        status: "approved",
        is_taken: false,
        // project_number and edit_token are auto-assigned by DB defaults
    }));

    const { data: inserted, error: insertError } = await supabase
        .from("projects")
        .insert(copies)
        .select();

    if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: inserted.length });
}

import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { TRACKS, normalizeTrack } from "@/lib/constants";

function nextFreeNumber(track: string, used: Set<number>): number {
    const start = TRACKS[normalizeTrack(track)].numberStart;
    let n = start;
    while (used.has(n)) n++;
    used.add(n);
    return n;
}

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

    // Gather all project_numbers already used in the active year
    const { data: existingInActive } = await supabase
        .from("projects")
        .select("project_number")
        .eq("academic_year_id", activeYear.id)
        .not("project_number", "is", null);

    const usedNumbers = new Set<number>(
        (existingInActive ?? []).map((p) => p.project_number as number)
    );

    // Build copies with auto-assigned project numbers per track
    const copies = projects.map((p) => {
        const track = normalizeTrack(p.track);
        const recommendedTrack = p.recommended_track
            ? normalizeTrack(p.recommended_track)
            : null;

        return {
            academic_year_id: activeYear.id,
            title_he: p.title_he,
            title_en: p.title_en,
            track,
            recommended_track: recommendedTrack,
            supervisors_name: p.supervisors_name,
            supervisors_email: p.supervisors_email,
            academic_supervisor_name: p.academic_supervisor_name,
            academic_supervisor_email: p.academic_supervisor_email,
            abstract: p.abstract,
            objective: p.objective,
            scope: p.scope,
            relevant_required_course_1: p.relevant_required_course_1,
            relevant_required_course_2: p.relevant_required_course_2,
            prereq_course_1: p.prereq_course_1,
            prereq_course_2: p.prereq_course_2,
            references_text: p.references_text,
            status: "approved",
            is_taken: false,
            project_number: nextFreeNumber(track, usedNumbers),
        };
    });

    const { data: inserted, error: insertError } = await supabase
        .from("projects")
        .insert(copies)
        .select();

    if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: inserted.length });
}

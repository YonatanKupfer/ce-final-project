import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { normalizeTrack } from "@/lib/constants";

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const supabase = getAdminClient();

        // Only allow updating specific fields
        const allowedFields = [
            "title_he", "title_en", "track", "recommended_track",
            "supervisors_name", "supervisors_email",
            "academic_supervisor_name", "academic_supervisor_email",
            "abstract", "objective", "scope",
            "prereq_course_1", "prereq_course_2", "references_text",
            "status", "project_number", "is_taken", "review_notes",
        ];

        const updateData: Record<string, unknown> = {};
        for (const key of allowedFields) {
            if (key in body) {
                updateData[key] = body[key];
            }
        }
        if (typeof updateData.track === "string") {
            updateData.track = normalizeTrack(updateData.track);
        }
        if (typeof updateData.recommended_track === "string") {
            updateData.recommended_track = updateData.recommended_track
                ? normalizeTrack(updateData.recommended_track)
                : null;
        }

        const { error } = await supabase
            .from("projects")
            .update(updateData)
            .eq("id", id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getAdminClient();

        const { error } = await supabase
            .from("projects")
            .delete()
            .eq("id", id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

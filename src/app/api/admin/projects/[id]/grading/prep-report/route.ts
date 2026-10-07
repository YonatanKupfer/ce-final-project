import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();
    const submitted = !!body?.submitted;

    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from("projects")
        .update({
            prep_report_submitted: submitted,
            prep_report_marked_at: submitted ? new Date().toISOString() : null,
        })
        .eq("id", id)
        .select("id, prep_report_submitted, prep_report_marked_at")
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, project: data });
}

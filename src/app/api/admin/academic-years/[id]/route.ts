import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

// PUT /api/admin/academic-years/[id]  — set this year as the active year
export async function PUT(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = getAdminClient();

    // Step 1: deactivate the currently-active year (if any)
    const { error: clearError } = await supabase
        .from("academic_years")
        .update({ is_active: false })
        .eq("is_active", true);

    if (clearError) {
        return NextResponse.json({ error: clearError.message }, { status: 500 });
    }

    // Step 2: activate the target year
    const { data, error } = await supabase
        .from("academic_years")
        .update({ is_active: true })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, year: data });
}

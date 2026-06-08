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

// DELETE /api/admin/academic-years/[id]  — delete a non-active year with no projects
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = getAdminClient();

    // Verify the year exists and is not active
    const { data: year, error: fetchError } = await supabase
        .from("academic_years")
        .select("id, is_active, label_he")
        .eq("id", id)
        .single();

    if (fetchError || !year) {
        return NextResponse.json({ error: "Year not found" }, { status: 404 });
    }
    if (year.is_active) {
        return NextResponse.json({ error: "Cannot delete the active year" }, { status: 400 });
    }

    // Check there are no projects linked to this year
    const { count, error: countError } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("academic_year_id", id);

    if (countError) {
        return NextResponse.json({ error: countError.message }, { status: 500 });
    }
    if ((count ?? 0) > 0) {
        return NextResponse.json(
            { error: `לא ניתן למחוק שנה עם ${count} פרויקטים משויכים` },
            { status: 400 }
        );
    }

    const { error: deleteError } = await supabase
        .from("academic_years")
        .delete()
        .eq("id", id);

    if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

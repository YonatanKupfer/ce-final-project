import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; shareId: string }> }
) {
    try {
        const { id, shareId } = await params;
        const supabase = getAdminClient();

        // recipients + comments cascade-delete via their FK to project_shares
        const { error } = await supabase
            .from("project_shares")
            .delete()
            .eq("id", shareId)
            .eq("project_id", id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("DELETE /api/admin/projects/[id]/shares/[shareId] error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

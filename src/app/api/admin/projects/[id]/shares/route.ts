import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getAdminClient();

        const { data: shares, error } = await supabase
            .from("project_shares")
            .select("*, recipients:project_share_recipients(*), comments:project_share_comments(*)")
            .eq("project_id", id)
            .order("created_at", { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ shares: shares || [] });
    } catch (err) {
        console.error("GET /api/admin/projects/[id]/shares error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

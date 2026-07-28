import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

// Public-safe project columns only — never `select("*")` here. This is the
// single point that gates what an external, non-admin viewer can see.
const PUBLIC_SAFE_PROJECT_COLUMNS = "id, project_number, title_he, title_en, track, recommended_track, supervisors_name, academic_supervisor_name, abstract, objective, scope, relevant_required_course_1, relevant_required_course_2, prereq_course_1, prereq_course_2, references_text" as const;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const supabase = getAdminClient();

        const { data: share } = await supabase
            .from("project_shares")
            .select(`id, recipient_name, project:projects(${PUBLIC_SAFE_PROJECT_COLUMNS})`)
            .eq("token", token)
            .single();

        if (!share) {
            return NextResponse.json({ error: "Invalid token" }, { status: 404 });
        }

        const { data: comments } = await supabase
            .from("project_share_comments")
            .select("id, share_id, comment_text, author_label, created_at")
            .eq("share_id", share.id)
            .order("created_at", { ascending: true });

        return NextResponse.json({
            project: share.project,
            recipientName: share.recipient_name,
            comments: comments || [],
        });
    } catch (err) {
        console.error("GET /api/shared-project/[token] error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

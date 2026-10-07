import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

// Advisors can only remove a judge they assigned while it's still unsent —
// once the admin's global "send round" action has emailed it, only the
// regular admin delete route (/api/admin/grading/invites/[id]) may touch it.
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ token: string; projectId: string; inviteId: string }> }
) {
    try {
        const { token, projectId, inviteId } = await params;
        const supabase = getAdminClient();

        const { data: link } = await supabase
            .from("advisor_links")
            .select("academic_supervisor_email")
            .eq("token", token)
            .maybeSingle();
        if (!link) {
            return NextResponse.json({ error: "Invalid token" }, { status: 404 });
        }

        const { data: project } = await supabase
            .from("projects")
            .select("id, academic_supervisor_email")
            .eq("id", projectId)
            .maybeSingle();
        if (!project || project.academic_supervisor_email.toLowerCase() !== link.academic_supervisor_email.toLowerCase()) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const { data: invite } = await supabase
            .from("grading_invites")
            .select("id, project_id, role, invite_sent_at")
            .eq("id", inviteId)
            .maybeSingle();
        if (!invite || invite.project_id !== projectId || invite.role !== "judge") {
            return NextResponse.json({ error: "Invite not found" }, { status: 404 });
        }
        if (invite.invite_sent_at) {
            return NextResponse.json({ error: "לא ניתן להסיר הזמנה שנשלחה כבר — יש לפנות למנהל" }, { status: 400 });
        }

        const { error } = await supabase.from("grading_invites").delete().eq("id", inviteId);
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("DELETE /api/advisor/[token]/projects/[projectId]/judges/[inviteId] error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

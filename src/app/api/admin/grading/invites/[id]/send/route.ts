import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendEmail, gradeRequestEmail } from "@/lib/email";
import { RUBRIC_TEMPLATE_LABELS, GRADING_ROLE_LABELS, type GradingRole, type RubricTemplateKey } from "@/lib/constants";

// Emails one not-yet-sent invite its link right away — for a single late
// addition, without going through the per-form bulk send.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getAdminClient();

        const { data: invite } = await supabase
            .from("grading_invites")
            .select("*, rubric_template:rubric_templates(key), project:projects(project_number, title_he, title_en)")
            .eq("id", id)
            .single();
        if (!invite) {
            return NextResponse.json({ error: "Invite not found" }, { status: 404 });
        }
        if (!invite.recipient_email) {
            return NextResponse.json({ error: "אין כתובת מייל להזמנה זו (הזנה ידנית)" }, { status: 400 });
        }
        if (invite.invite_sent_at) {
            return NextResponse.json({ error: "הקישור כבר נשלח — ניתן לשלוח תזכורת" }, { status: 400 });
        }

        const template = invite.rubric_template as { key: RubricTemplateKey };
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        await sendEmail({
            to: invite.recipient_email,
            ...gradeRequestEmail({
                recipientName: invite.recipient_name,
                roleLabel: GRADING_ROLE_LABELS[invite.role as GradingRole],
                formLabel: RUBRIC_TEMPLATE_LABELS[template.key],
                project: invite.project,
                link: `${appUrl}/grade/${invite.token}`,
                adminNote: invite.admin_note,
            }),
        });

        const { data: updated } = await supabase
            .from("grading_invites")
            .update({ invite_sent_at: new Date().toISOString() })
            .eq("id", id)
            .select("invite_sent_at")
            .single();

        return NextResponse.json({ success: true, invite_sent_at: updated?.invite_sent_at });
    } catch (err) {
        console.error("POST /api/admin/grading/invites/[id]/send error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

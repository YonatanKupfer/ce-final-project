import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendEmail, wrapEmailHtml } from "@/lib/email";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getAdminClient();

        const { data: invite } = await supabase
            .from("grading_invites")
            .select("*, project:projects(project_number, title_he, title_en)")
            .eq("id", id)
            .single();

        if (!invite) {
            return NextResponse.json({ error: "Invite not found" }, { status: 404 });
        }
        if (invite.status === "submitted") {
            return NextResponse.json({ error: "הציון כבר הוגש" }, { status: 400 });
        }
        if (!invite.recipient_email) {
            return NextResponse.json({ error: "אין כתובת מייל להזמנה זו (הוזנה ידנית)" }, { status: 400 });
        }

        const project = invite.project;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const link = `${appUrl}/grade/${invite.token}`;
        const roleLabel = invite.role === "judge" ? "שופט/ת" : "אחראי.ת אקדמי.ת";
        const pendingSince = new Date(invite.created_at).toLocaleDateString("he-IL");

        await sendEmail({
            to: invite.recipient_email,
            subject: `תזכורת: בקשה למתן ציון — ${project.title_he}`,
            html: wrapEmailHtml(`
        <h2 style="margin-bottom: 4px;">תזכורת: בקשה למתן ציון</h2>
        <p style="color: #555; margin-top: 0;">בקשה זו למתן ציון (בתפקיד ${roleLabel}) נשלחה בתאריך ${pendingSince} וטרם הוגש עבורה ציון.</p>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">מספר פרויקט:</td><td style="padding: 8px;">${project.project_number ?? "—"}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">שם הפרויקט:</td><td style="padding: 8px;">${project.title_he}</td></tr>
        </table>
        <p>
          <a href="${link}" style="background: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            מעבר לטופס הציון
          </a>
        </p>
      `),
        });

        const { data: updated } = await supabase
            .from("grading_invites")
            .update({
                reminder_count: invite.reminder_count + 1,
                last_reminder_sent_at: new Date().toISOString(),
            })
            .eq("id", id)
            .select("reminder_count, last_reminder_sent_at")
            .single();

        return NextResponse.json({
            success: true,
            reminder_count: updated?.reminder_count,
            last_reminder_sent_at: updated?.last_reminder_sent_at,
        });
    } catch (err) {
        console.error("POST /api/admin/grading/invites/[id]/remind error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

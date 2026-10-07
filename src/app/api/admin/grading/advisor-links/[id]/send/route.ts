import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendEmail, wrapEmailHtml } from "@/lib/email";

// Convenience resend button — emails the advisor their own portal link.
// No DB state to track here (unlike grading_invites.invite_sent_at); it's
// fine to send this as many times as the admin likes.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getAdminClient();

        const { data: link } = await supabase
            .from("advisor_links")
            .select("*")
            .eq("id", id)
            .single();
        if (!link) {
            return NextResponse.json({ error: "Link not found" }, { status: 404 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const portalLink = `${appUrl}/advisor/${link.token}`;

        await sendEmail({
            to: link.academic_supervisor_email,
            subject: "שיבוץ שופטים לפרויקטים שלך",
            html: wrapEmailHtml(`
        <h2>שיבוץ שופטים לפרויקטים שלך</h2>
        <p>שלום ${link.academic_supervisor_name},</p>
        <p>באמצעות הקישור הבא ניתן לשבץ שופט/ת לכל אחד מהפרויקטים שבאחריותך, למצגת האמצע ולמצגת הסיום:</p>
        <p>
          <a href="${portalLink}" style="background: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            מעבר לשיבוץ שופטים
          </a>
        </p>
      `),
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("POST /api/admin/grading/advisor-links/[id]/send error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendEmail, wrapEmailHtml } from "@/lib/email";
import { TRACKS, normalizeTrack } from "@/lib/constants";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getAdminClient();

        const { data: project } = await supabase
            .from("projects")
            .select("*")
            .eq("id", id)
            .single();

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        if (project.status !== "review") {
            return NextResponse.json({ error: "ההצעה אינה ממתינה לתיקון" }, { status: 400 });
        }

        const recipient = (project.academic_supervisor_email || "").trim();
        if (!EMAIL_RE.test(recipient)) {
            return NextResponse.json(
                { error: "אין כתובת מייל תקינה של האחראי.ת האקדמי.ת" },
                { status: 400 }
            );
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const editUrl = `${appUrl}/he/propose?token=${project.edit_token}`;
        const trackLabel = TRACKS[normalizeTrack(project.track)].label;

        await sendEmail({
            to: recipient,
            subject: `תזכורת: הצעת פרויקט ממתינה לתיקון — ${project.title_he}`,
            html: wrapEmailHtml(`
        <h2 style="margin-bottom: 4px;">תזכורת: הצעת פרויקט ממתינה לתיקון</h2>
        <p style="color: #555; margin-top: 0;">נשלחו הערות לתיקון עבור הצעת הפרויקט, וטרם התקבלה הצעה מתוקנת.</p>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0; background: #f8fafc; border-radius: 8px;">
          <tr><td style="padding: 8px; font-weight: bold;">שם הפרויקט:</td><td style="padding: 8px;">${project.title_he}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Project Title:</td><td style="padding: 8px;" dir="ltr">${project.title_en}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">אשכול:</td><td style="padding: 8px;">${trackLabel}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">מנחה:</td><td style="padding: 8px;">${project.supervisors_name}</td></tr>
        </table>
        ${project.review_notes ? `
        <h3>הערות מצוות הניהול:</h3>
        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; border-right: 4px solid #f59e0b; margin: 16px 0; white-space: pre-wrap;">
          ${project.review_notes}
        </div>` : ""}
        <p>נא לתקן את ההצעה ולשלוח מחדש באמצעות הקישור הבא:</p>
        <p style="margin-top: 20px;">
          <a href="${editUrl}" style="background: #2563eb; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; display: inline-block; font-size: 16px;">
            עריכה ושליחה מחדש
          </a>
        </p>
      `),
        });

        const { data: updated } = await supabase
            .from("projects")
            .update({
                review_reminder_count: (project.review_reminder_count ?? 0) + 1,
                last_review_reminder_sent_at: new Date().toISOString(),
            })
            .eq("id", id)
            .select("review_reminder_count, last_review_reminder_sent_at")
            .single();

        return NextResponse.json({
            success: true,
            review_reminder_count: updated?.review_reminder_count,
            last_review_reminder_sent_at: updated?.last_review_reminder_sent_at,
        });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

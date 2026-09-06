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

        const { data: registration } = await supabase
            .from("registrations")
            .select("*, project:projects(*)")
            .eq("id", id)
            .single();

        if (!registration) {
            return NextResponse.json({ error: "Registration not found" }, { status: 404 });
        }

        if (registration.status !== "pending") {
            return NextResponse.json({ error: "Registration already decided" }, { status: 400 });
        }

        const project = registration.project;
        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const recipients = [project.academic_supervisor_email, project.supervisors_email]
            .map((email: string) => (email || "").trim())
            .filter((email: string) => {
                const valid = EMAIL_RE.test(email);
                if (!valid) {
                    console.warn(
                        `[remind] Project #${project.project_number} has a missing/invalid recipient email ("${email}") — skipped.`
                    );
                }
                return valid;
            });

        if (recipients.length === 0) {
            return NextResponse.json(
                { error: "אין כתובות מייל תקינות לשליחת תזכורת (מנחה/אחראי אקדמי)" },
                { status: 400 }
            );
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const decisionUrl = `${appUrl}/approve-registration/${registration.approval_token}`;
        const approveUrl = `${decisionUrl}?action=approve`;
        const rejectUrl = `${decisionUrl}?action=reject`;
        const trackLabel = TRACKS[normalizeTrack(project.track)].label;

        let studentInfo = `
      <tr><td style="padding: 8px; font-weight: bold;">שם סטודנט 1:</td><td style="padding: 8px;">${registration.student1_name}</td></tr>
      <tr><td style="padding: 8px; font-weight: bold;">ת"ז סטודנט 1:</td><td style="padding: 8px;">${registration.student1_id}</td></tr>
      <tr><td style="padding: 8px; font-weight: bold;">מייל סטודנט 1:</td><td style="padding: 8px;">${registration.student1_email}</td></tr>
    `;

        if (registration.student2_name) {
            studentInfo += `
        <tr><td style="padding: 8px; font-weight: bold;">שם סטודנט 2:</td><td style="padding: 8px;">${registration.student2_name}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">ת"ז סטודנט 2:</td><td style="padding: 8px;">${registration.student2_id}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">מייל סטודנט 2:</td><td style="padding: 8px;">${registration.student2_email}</td></tr>
      `;
        }

        const pendingSince = new Date(registration.created_at).toLocaleDateString("he-IL");

        await sendEmail({
            to: recipients,
            subject: `תזכורת: בקשת הרשמה ממתינה לאישור — ${project.title_he}`,
            html: wrapEmailHtml(`
        <h2 style="margin-bottom: 4px;">תזכורת: בקשת הרשמה ממתינה לאישור</h2>
        <p style="color: #555; margin-top: 0;">בקשת הרשמה זו ממתינה לאישור המנחה או האחראי.ת האקדמי.ת מתאריך ${pendingSince} וטרם התקבלה החלטה.</p>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0; background: #f8fafc; border-radius: 8px;">
          <tr><td style="padding: 8px; font-weight: bold;">מספר פרויקט:</td><td style="padding: 8px; font-size: 18px; font-weight: bold; color: #2563eb;">#${project.project_number}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">שם הפרויקט:</td><td style="padding: 8px;">${project.title_he}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Project Title:</td><td style="padding: 8px;" dir="ltr">${project.title_en}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">אשכול:</td><td style="padding: 8px;">${trackLabel}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">מנחה:</td><td style="padding: 8px;">${project.supervisors_name}</td></tr>
        </table>
        <h3 style="margin-bottom: 4px;">פרטי הסטודנטים:</h3>
        <table style="width:100%; border-collapse: collapse; margin: 8px 0 24px;">
          ${studentInfo}
        </table>
        <p style="font-weight: bold; margin-bottom: 16px;">נא לאשר או לדחות את הבקשה:</p>
        <table style="border-collapse: collapse; margin: 0 auto;"><tr>
          <td style="padding: 0 8px;">
            <a href="${approveUrl}" style="background: #16a34a; color: #ffffff; padding: 14px 32px; border-radius: 6px; text-decoration: none; display: inline-block; font-size: 16px; font-weight: bold;">
              ✓ אישור
            </a>
          </td>
          <td style="padding: 0 8px;">
            <a href="${rejectUrl}" style="background: #dc2626; color: #ffffff; padding: 14px 32px; border-radius: 6px; text-decoration: none; display: inline-block; font-size: 16px; font-weight: bold;">
              ✕ דחייה
            </a>
          </td>
        </tr></table>
        <p style="color: #888; font-size: 13px; margin-top: 24px;">לחיצה על אחד הכפתורים תעביר אותך לעמוד אישור לפני קבלת ההחלטה הסופית. מייל זה נשלח הן למנחה והן לאחראי.ת האקדמי.ת — מי מכם שיחליט/תחליט ראשון/ה, ההחלטה תיקבע בהתאם.</p>
      `),
        });

        const { data: updated } = await supabase
            .from("registrations")
            .update({
                reminder_count: registration.reminder_count + 1,
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
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

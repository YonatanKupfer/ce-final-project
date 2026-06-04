import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { registrationFormSchema } from "@/lib/validations";
import { sendEmail, wrapEmailHtml } from "@/lib/email";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = registrationFormSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid form data", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const supabase = getAdminClient();
        const data = parsed.data;

        // Check project exists and is available
        const { data: project } = await supabase
            .from("projects")
            .select("*")
            .eq("id", data.project_id)
            .eq("status", "approved")
            .eq("is_taken", false)
            .single();

        if (!project) {
            return NextResponse.json(
                { error: "הפרויקט לא זמין להרשמה" },
                { status: 400 }
            );
        }

        // Insert registration
        const { data: registration, error } = await supabase
            .from("registrations")
            .insert({
                project_id: data.project_id,
                student1_name: data.student1_name,
                student1_id: data.student1_id,
                student1_email: data.student1_email,
                student2_name: data.student2_name || "",
                student2_id: data.student2_id || "",
                student2_email: data.student2_email || "",
                is_ce_student: data.is_ce_student,
                status: "pending",
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Send email to academic supervisor with approve/reject buttons
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const decisionUrl = `${appUrl}/approve-registration/${registration.approval_token}`;
        const approveUrl = `${decisionUrl}?action=approve`;
        const rejectUrl = `${decisionUrl}?action=reject`;

        let studentInfo = `
      <tr><td style="padding: 8px; font-weight: bold;">שם סטודנט 1:</td><td style="padding: 8px;">${data.student1_name}</td></tr>
      <tr><td style="padding: 8px; font-weight: bold;">ת"ז סטודנט 1:</td><td style="padding: 8px;">${data.student1_id}</td></tr>
      <tr><td style="padding: 8px; font-weight: bold;">מייל סטודנט 1:</td><td style="padding: 8px;">${data.student1_email}</td></tr>
    `;

        if (data.student2_name) {
            studentInfo += `
        <tr><td style="padding: 8px; font-weight: bold;">שם סטודנט 2:</td><td style="padding: 8px;">${data.student2_name}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">ת"ז סטודנט 2:</td><td style="padding: 8px;">${data.student2_id}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">מייל סטודנט 2:</td><td style="padding: 8px;">${data.student2_email}</td></tr>
      `;
        }

        // Guard: only send if the academic supervisor has a valid email on the project
        const academicEmail = (project.academic_supervisor_email || "").trim();
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(academicEmail);

        if (!isValidEmail) {
            console.warn(
                `[registrations] Project #${project.project_number} has a missing/invalid academic_supervisor_email ("${academicEmail}") — approval email not sent.`
            );
        } else {
            await sendEmail({
                to: academicEmail,
                subject: `בקשת הרשמה לפרויקט: ${project.title_he}`,
                html: wrapEmailHtml(`
        <h2 style="margin-bottom: 4px;">בקשת הרשמה לפרויקט</h2>
        <p style="color: #555; margin-top: 0;">התקבלה בקשת הרשמה הממתינה לאישורך כאחראי.ת אקדמי.ת.</p>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0; background: #f8fafc; border-radius: 8px;">
          <tr><td style="padding: 8px; font-weight: bold;">מספר פרויקט:</td><td style="padding: 8px; font-size: 18px; font-weight: bold; color: #2563eb;">#${project.project_number}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">שם הפרויקט:</td><td style="padding: 8px;">${project.title_he}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Project Title:</td><td style="padding: 8px;" dir="ltr">${project.title_en}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">מסלול:</td><td style="padding: 8px;">${project.track}</td></tr>
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
        <p style="color: #888; font-size: 13px; margin-top: 24px;">לחיצה על אחד הכפתורים תעביר אותך לעמוד אישור לפני קבלת ההחלטה הסופית.</p>
      `),
            }).catch((err) =>
                console.error(
                    `[registrations] Failed to send approval email to ${academicEmail}:`,
                    err
                )
            );
        }

        // Notify staff
        const { data: staffEmails } = await supabase
            .from("staff_emails")
            .select("email");

        if (staffEmails && staffEmails.length > 0) {
            await sendEmail({
                to: staffEmails.map((s) => s.email),
                subject: `הרשמה חדשה לפרויקט #${project.project_number}: ${project.title_he}`,
                html: wrapEmailHtml(`
          <h2>הרשמה חדשה לפרויקט</h2>
          <p><strong>פרויקט:</strong> #${project.project_number} — ${project.title_he}</p>
          <p><strong>סטודנט 1:</strong> ${data.student1_name} (${data.student1_id})</p>
          ${data.student2_name ? `<p><strong>סטודנט 2:</strong> ${data.student2_name} (${data.student2_id})</p>` : ""}
          <p>הבקשה נשלחה לאחראי.ת האקדמי.ת לאישור.</p>
        `),
            }).catch(console.error);
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

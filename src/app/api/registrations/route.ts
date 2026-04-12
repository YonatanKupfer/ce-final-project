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

        // Send email to academic supervisor with approve/reject link
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const decisionUrl = `${appUrl}/approve-registration/${registration.approval_token}`;

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

        await sendEmail({
            to: project.academic_supervisor_email,
            subject: `בקשת הרשמה לפרויקט: ${project.title_he}`,
            html: wrapEmailHtml(`
        <h2>בקשת הרשמה לפרויקט</h2>
        <p><strong>פרויקט:</strong> #${project.project_number} — ${project.title_he}</p>
        <h3>פרטי הסטודנטים:</h3>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
          ${studentInfo}
        </table>
        <p>נא לאשר או לדחות את הבקשה:</p>
        <p style="margin-top: 20px;">
          <a href="${decisionUrl}" style="background: #2563eb; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; display: inline-block; font-size: 16px;">
            אישור / דחייה
          </a>
        </p>
      `),
        }).catch(console.error);

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

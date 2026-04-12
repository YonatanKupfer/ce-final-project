import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendEmail, wrapEmailHtml } from "@/lib/email";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const { decision } = await request.json();

        if (!["approved", "rejected"].includes(decision)) {
            return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
        }

        const supabase = getAdminClient();

        // Find registration by token
        const { data: registration } = await supabase
            .from("registrations")
            .select("*, project:projects(*)")
            .eq("approval_token", token)
            .single();

        if (!registration) {
            return NextResponse.json({ error: "Invalid token" }, { status: 404 });
        }

        if (registration.status !== "pending") {
            return NextResponse.json({ error: "Already decided" }, { status: 400 });
        }

        const project = registration.project;

        // Update registration status
        await supabase
            .from("registrations")
            .update({ status: decision })
            .eq("id", registration.id);

        if (decision === "approved") {
            // Mark project as taken
            await supabase
                .from("projects")
                .update({ is_taken: true })
                .eq("id", registration.project_id);

            // Email students - approved
            const studentEmails = [registration.student1_email];
            if (registration.student2_email) {
                studentEmails.push(registration.student2_email);
            }

            await sendEmail({
                to: studentEmails,
                subject: `הרשמתכם לפרויקט #${project.project_number} אושרה!`,
                html: wrapEmailHtml(`
          <h2>הרשמתכם אושרה! 🎉</h2>
          <p>הרשמתכם לפרויקט הבא אושרה על ידי האחראי.ת האקדמי.ת:</p>
          <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; font-weight: bold;">מספר פרויקט:</td><td style="padding: 8px; font-size: 20px; font-weight: bold; color: #2563eb;">${project.project_number}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">שם הפרויקט:</td><td style="padding: 8px;">${project.title_he}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Project Title:</td><td style="padding: 8px;">${project.title_en}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">מנחה:</td><td style="padding: 8px;">${project.supervisors_name}</td></tr>
          </table>
          <p>בהצלחה!</p>
        `),
            }).catch(console.error);
        } else {
            // Email students - rejected
            const studentEmails = [registration.student1_email];
            if (registration.student2_email) {
                studentEmails.push(registration.student2_email);
            }

            await sendEmail({
                to: studentEmails,
                subject: `הרשמתכם לפרויקט #${project.project_number} נדחתה`,
                html: wrapEmailHtml(`
          <h2>הרשמתכם נדחתה</h2>
          <p>לצערנו, הרשמתכם לפרויקט הבא נדחתה על ידי האחראי.ת האקדמי.ת:</p>
          <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; font-weight: bold;">מספר פרויקט:</td><td style="padding: 8px;">${project.project_number}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">שם הפרויקט:</td><td style="padding: 8px;">${project.title_he}</td></tr>
          </table>
          <p>ניתן לנסות להירשם לפרויקט אחר.</p>
        `),
            }).catch(console.error);
        }

        return NextResponse.json({ success: true, decision });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

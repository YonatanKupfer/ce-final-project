import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { projectFormSchema } from "@/lib/validations";
import { sendEmail, wrapEmailHtml } from "@/lib/email";

function collectRecipients(staffEmails: Array<{ email: string }> | null, extras: string[]) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipients = new Set<string>();

    for (const staff of staffEmails ?? []) {
        const normalized = (staff.email || "").trim().toLowerCase();
        if (normalized && emailRegex.test(normalized)) {
            recipients.add(normalized);
        }
    }

    for (const extra of extras) {
        const normalized = (extra || "").trim().toLowerCase();
        if (normalized && emailRegex.test(normalized)) {
            recipients.add(normalized);
        }
    }

    return Array.from(recipients);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = projectFormSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid form data", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const supabase = getAdminClient();
        const data = parsed.data;

        // Resolve the active academic year so new proposals are tagged correctly
        const { data: activeYear } = await supabase
            .from("academic_years")
            .select("id")
            .eq("is_active", true)
            .single();

        const { data: project, error } = await supabase
            .from("projects")
            .insert({
                academic_year_id: activeYear?.id ?? null,
                title_he: data.title_he,
                title_en: data.title_en,
                track: data.track,
                recommended_track: data.recommended_track || null,
                supervisors_name: data.supervisors_name,
                supervisors_email: data.supervisors_email,
                academic_supervisor_name: data.academic_supervisor_name,
                academic_supervisor_email: data.academic_supervisor_email,
                abstract: data.abstract,
                objective: data.objective,
                scope: data.scope,
                prereq_course_1: data.prereq_course_1 || "",
                prereq_course_2: data.prereq_course_2 || "",
                references_text: data.references_text,
                status: "pending",
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Send notification to staff
        const { data: staffEmails } = await supabase
            .from("staff_emails")
            .select("email");

        {
            const emails = collectRecipients(staffEmails, [
                data.supervisors_email,
                data.academic_supervisor_email,
            ]);
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

            if (emails.length > 0) {
                await sendEmail({
                    to: emails,
                    subject: `הצעת פרויקט חדשה: ${data.title_he}`,
                    html: wrapEmailHtml(`
          <h2>הוגשה הצעת פרויקט חדשה</h2>
          <table style="width:100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold;">שם הפרויקט (עברית):</td><td style="padding: 8px;">${data.title_he}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Project Title:</td><td style="padding: 8px;">${data.title_en}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">שרשרת:</td><td style="padding: 8px;">${data.track}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">מנחה:</td><td style="padding: 8px;">${data.supervisors_name}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">אחראי.ת אקדמי.ת:</td><td style="padding: 8px;">${data.academic_supervisor_name}</td></tr>
          </table>
          <p style="margin-top: 20px;">
            <a href="${appUrl}/admin/pending" style="background: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              צפייה בלוח הניהול
            </a>
          </p>
        `),
                }).catch(console.error);
            }
        }

        return NextResponse.json({ success: true, project });
    } catch (err) {
        console.error("POST /api/projects error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

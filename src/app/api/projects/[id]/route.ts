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

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { edit_token, ...formData } = body;

        const parsed = projectFormSchema.safeParse(formData);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid form data", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const supabase = getAdminClient();
        const data = parsed.data;

        // Verify edit token
        const { data: existing } = await supabase
            .from("projects")
            .select("id, edit_token, status")
            .eq("id", id)
            .eq("edit_token", edit_token)
            .single();

        if (!existing) {
            return NextResponse.json({ error: "Invalid token" }, { status: 403 });
        }
        if (existing.status === "approved") {
            return NextResponse.json(
                { error: "Cannot edit a project after final approval" },
                { status: 403 }
            );
        }

        const { data: project, error } = await supabase
            .from("projects")
            .update({
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
                relevant_required_course_1: data.relevant_required_course_1 || "",
                relevant_required_course_2: data.relevant_required_course_2 || "",
                prereq_course_1: data.prereq_course_1 || "",
                prereq_course_2: data.prereq_course_2 || "",
                references_text: data.references_text,
                ai_complexity_justification: data.ai_complexity_justification || null,
                status: "pending",
                review_notes: null,
            })
            .eq("id", id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Notify staff of resubmission
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
                    subject: `הצעת פרויקט עודכנה ונשלחה מחדש: ${data.title_he}`,
                    html: wrapEmailHtml(`
          <h2>הצעת פרויקט עודכנה ונשלחה מחדש</h2>
          <p><strong>שם הפרויקט:</strong> ${data.title_he} / ${data.title_en}</p>
          <p><strong>מנחה:</strong> ${data.supervisors_name}</p>
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
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

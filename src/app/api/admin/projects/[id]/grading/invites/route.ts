import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendEmail, wrapEmailHtml } from "@/lib/email";
import { gradingInviteCreateSchema } from "@/lib/validations";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = getAdminClient();
    const { data: invites, error } = await supabase
        .from("grading_invites")
        .select("*, rubric_template:rubric_templates(id, key, label_he)")
        .eq("project_id", id)
        .order("created_at", { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ invites: invites || [] });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const parsed = gradingInviteCreateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || "נתונים לא תקינים" }, { status: 400 });
        }
        const { rubric_template_key, role, recipient_email, recipient_name, admin_note, created_by_email } = parsed.data;

        const supabase = getAdminClient();

        const { data: project } = await supabase
            .from("projects")
            .select("id, project_number, title_he, title_en")
            .eq("id", id)
            .single();
        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const { data: template } = await supabase
            .from("rubric_templates")
            .select("id, key, label_he")
            .eq("key", rubric_template_key)
            .single();
        if (!template) {
            return NextResponse.json({ error: "Unknown rubric template" }, { status: 400 });
        }

        const { data: invite, error } = await supabase
            .from("grading_invites")
            .insert({
                project_id: id,
                rubric_template_id: template.id,
                role,
                recipient_email: recipient_email || null,
                recipient_name: recipient_name || null,
                admin_note: admin_note || null,
                created_by_email,
                // Emailed immediately below when there's a recipient, so mark
                // it sent now — otherwise the global per-round send button
                // would try to (re)send this one too.
                invite_sent_at: recipient_email ? new Date().toISOString() : null,
            })
            .select("*")
            .single();

        if (error || !invite) {
            return NextResponse.json({ error: error?.message || "שגיאה ביצירת הזמנה" }, { status: 500 });
        }

        if (recipient_email) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const link = `${appUrl}/grade/${invite.token}`;
            const roleLabel = role === "judge" ? "שופט/ת" : "אחראי.ת אקדמי.ת";

            await sendEmail({
                to: recipient_email,
                subject: `בקשה למתן ציון: ${project.title_he}`,
                html: wrapEmailHtml(`
          <h2>בקשה למתן ציון</h2>
          <p>שלום${recipient_name ? ` ${recipient_name}` : ""},</p>
          <p>מתבקש/ת למלא ציון (בתפקיד ${roleLabel}) עבור פרויקט הגמר הבא:</p>
          <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; font-weight: bold;">מספר פרויקט:</td><td style="padding: 8px;">${project.project_number ?? "—"}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">שם הפרויקט:</td><td style="padding: 8px;">${project.title_he}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Project Title:</td><td style="padding: 8px;">${project.title_en}</td></tr>
          </table>
          ${admin_note ? `<p><strong>הערה:</strong><br/>${admin_note}</p>` : ""}
          <p>
            <a href="${link}" style="background: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              מעבר לטופס הציון
            </a>
          </p>
        `),
            }).catch(console.error);
        }

        return NextResponse.json({ invite });
    } catch (err) {
        console.error("POST /api/admin/projects/[id]/grading/invites error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

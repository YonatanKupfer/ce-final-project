import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendEmail, wrapEmailHtml } from "@/lib/email";
import { RUBRIC_TEMPLATE_KEYS, GRADING_ROLE_LABELS, type RubricTemplateKey } from "@/lib/constants";

async function resolveYearId(supabase: ReturnType<typeof getAdminClient>, yearSlug: string | null) {
    if (yearSlug) {
        const { data } = await supabase.from("academic_years").select("id").eq("slug", yearSlug).maybeSingle();
        return data?.id ?? null;
    }
    const { data } = await supabase.from("academic_years").select("id").eq("is_active", true).maybeSingle();
    return data?.id ?? null;
}

function isValidTemplateKey(key: string): key is RubricTemplateKey {
    return (RUBRIC_TEMPLATE_KEYS as readonly string[]).includes(key);
}

async function resolveTemplateId(supabase: ReturnType<typeof getAdminClient>, templateKey: RubricTemplateKey) {
    const { data } = await supabase.from("rubric_templates").select("id").eq("key", templateKey).maybeSingle();
    return data?.id ?? null;
}

// Dry-run preview for the admin confirm dialog before actually emailing
// anyone — counts what a POST to this same route would do.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ templateKey: string }> }
) {
    const { templateKey } = await params;
    if (!isValidTemplateKey(templateKey)) {
        return NextResponse.json({ error: "Unknown round" }, { status: 400 });
    }

    const yearSlug = request.nextUrl.searchParams.get("year");
    const supabase = getAdminClient();

    const yearId = await resolveYearId(supabase, yearSlug);
    if (!yearId) {
        return NextResponse.json({ error: "שנה אקדמית לא נמצאה" }, { status: 404 });
    }
    const templateId = await resolveTemplateId(supabase, templateKey);
    if (!templateId) {
        return NextResponse.json({ error: "טופס לא נמצא" }, { status: 404 });
    }

    const { data: projects } = await supabase
        .from("projects")
        .select("id")
        .eq("academic_year_id", yearId)
        .eq("status", "approved")
        .eq("is_taken", true);
    const projectIds = (projects || []).map((p) => p.id);

    const { data: existingAdvisorInvites } = projectIds.length
        ? await supabase
            .from("grading_invites")
            .select("project_id")
            .eq("rubric_template_id", templateId)
            .eq("role", "academic_advisor")
            .in("project_id", projectIds)
        : { data: [] as { project_id: string }[] };
    const projectsWithAdvisorInvite = new Set((existingAdvisorInvites || []).map((i) => i.project_id));
    const advisorsToSend = projectIds.filter((id) => !projectsWithAdvisorInvite.has(id)).length;

    const { data: unsentJudgeInvites } = projectIds.length
        ? await supabase
            .from("grading_invites")
            .select("id")
            .eq("rubric_template_id", templateId)
            .eq("role", "judge")
            .in("project_id", projectIds)
            .is("invite_sent_at", null)
        : { data: [] as { id: string }[] };

    return NextResponse.json({
        projects_count: projectIds.length,
        advisors_to_send: advisorsToSend,
        judges_to_send: (unsentJudgeInvites || []).length,
    });
}

// The one global per-round button: for every approved project in the
// year, ensures the advisor's own invite exists (auto-created from
// projects.academic_supervisor_name/email — advisors never need to assign
// themselves), then emails every invite for this round that hasn't been
// emailed yet (advisor invite just ensured + any judges an advisor
// assigned via the portal). invite_sent_at IS NULL is what makes clicking
// this twice, or clicking it again after new judges were assigned, safe —
// already-sent invites are simply skipped.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ templateKey: string }> }
) {
    try {
        const { templateKey } = await params;
        if (!isValidTemplateKey(templateKey)) {
            return NextResponse.json({ error: "Unknown round" }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        const yearSlug: string | undefined = body?.year;
        const createdByEmail: string | undefined = body?.created_by_email;
        if (!createdByEmail) {
            return NextResponse.json({ error: "created_by_email is required" }, { status: 400 });
        }

        const supabase = getAdminClient();
        const yearId = await resolveYearId(supabase, yearSlug ?? null);
        if (!yearId) {
            return NextResponse.json({ error: "שנה אקדמית לא נמצאה" }, { status: 404 });
        }
        const templateId = await resolveTemplateId(supabase, templateKey);
        if (!templateId) {
            return NextResponse.json({ error: "טופס לא נמצא" }, { status: 404 });
        }

        const { data: projects } = await supabase
            .from("projects")
            .select("id, project_number, title_he, title_en, academic_supervisor_name, academic_supervisor_email")
            .eq("academic_year_id", yearId)
            .eq("status", "approved")
            .eq("is_taken", true);
        const projectList = projects || [];
        const projectIds = projectList.map((p) => p.id);
        if (projectIds.length === 0) {
            return NextResponse.json({ sent: 0, already_sent_skipped: 0, failed: [] });
        }

        const { data: existingAdvisorInvites } = await supabase
            .from("grading_invites")
            .select("project_id")
            .eq("rubric_template_id", templateId)
            .eq("role", "academic_advisor")
            .in("project_id", projectIds);
        const projectsWithAdvisorInvite = new Set((existingAdvisorInvites || []).map((i) => i.project_id));

        for (const project of projectList) {
            if (projectsWithAdvisorInvite.has(project.id)) continue;
            const { error } = await supabase.from("grading_invites").insert({
                project_id: project.id,
                rubric_template_id: templateId,
                role: "academic_advisor",
                recipient_name: project.academic_supervisor_name,
                recipient_email: project.academic_supervisor_email,
                created_by_email: createdByEmail,
                invite_sent_at: null,
            });
            // Unique-violation race (another click already created it) is fine to ignore.
            if (error && error.code !== "23505") {
                console.error("send-round: failed to create advisor invite for project", project.id, error);
            }
        }

        const { data: toSend } = await supabase
            .from("grading_invites")
            .select("id, token, recipient_email, recipient_name, role, project_id")
            .eq("rubric_template_id", templateId)
            .in("project_id", projectIds)
            .is("invite_sent_at", null);

        const projectById = new Map(projectList.map((p) => [p.id, p]));
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const roundLabel = templateKey === "mid_presentation" ? "מצגת אמצע" : "מצגת סיום";

        let sent = 0;
        const failed: { project_id: string; recipient_email: string | null; error: string }[] = [];
        const { count } = await supabase
            .from("grading_invites")
            .select("id", { count: "exact", head: true })
            .eq("rubric_template_id", templateId)
            .in("project_id", projectIds)
            .not("invite_sent_at", "is", null);
        const alreadySentSkipped = count ?? 0;

        for (const invite of toSend || []) {
            const project = projectById.get(invite.project_id);
            if (!invite.recipient_email || !project) continue;
            const roleLabel = GRADING_ROLE_LABELS[invite.role as "judge" | "academic_advisor"];
            const tokenLink = `${appUrl}/grade/${invite.token}`;
            try {
                await sendEmail({
                    to: invite.recipient_email,
                    subject: `בקשה למתן ציון: ${project.title_he}`,
                    html: wrapEmailHtml(`
            <h2>בקשה למתן ציון</h2>
            <p>שלום${invite.recipient_name ? ` ${invite.recipient_name}` : ""},</p>
            <p>מתבקש/ת למלא ציון (בתפקיד ${roleLabel}) עבור ${roundLabel} של פרויקט הגמר הבא:</p>
            <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; font-weight: bold;">מספר פרויקט:</td><td style="padding: 8px;">${project.project_number ?? "—"}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">שם הפרויקט:</td><td style="padding: 8px;">${project.title_he}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Project Title:</td><td style="padding: 8px;">${project.title_en}</td></tr>
            </table>
            <p>
              <a href="${tokenLink}" style="background: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
                מעבר לטופס הציון
              </a>
            </p>
          `),
                });
                await supabase
                    .from("grading_invites")
                    .update({ invite_sent_at: new Date().toISOString() })
                    .eq("id", invite.id);
                sent += 1;
            } catch (err) {
                failed.push({
                    project_id: invite.project_id,
                    recipient_email: invite.recipient_email,
                    error: err instanceof Error ? err.message : "שגיאה בשליחת המייל",
                });
            }
        }

        return NextResponse.json({ sent, already_sent_skipped: alreadySentSkipped, failed });
    } catch (err) {
        console.error("POST /api/admin/grading/send-round/[templateKey] error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendEmail, wrapEmailHtml } from "@/lib/email";
import { RUBRIC_TEMPLATE_LABELS, GRADING_ROLE_LABELS, type GradingRole, type RubricTemplateKey } from "@/lib/constants";
import { resolveYearId, resolveTemplateId, isValidTemplateKey } from "@/lib/grading-server";

// A recipient reminded within this window is skipped, so a double click
// (or two admins clicking at once) never floods anyone's inbox.
const REMINDER_COOLDOWN_HOURS = 48;

interface PendingInvite {
    id: string;
    token: string;
    role: GradingRole;
    project_number: number | null;
    title_he: string;
    reminder_count: number;
    last_reminder_sent_at: string | null;
}

interface RecipientGroup {
    email: string;
    name: string | null;
    invites: PendingInvite[];
    last_reminder_sent_at: string | null;
    // false = reminded within REMINDER_COOLDOWN_HOURS, will be skipped.
    eligible: boolean;
}

// Every not-yet-submitted invite for this form whose link was already
// emailed, grouped by recipient email — one person (e.g. an advisor with
// several projects, or a judge on several projects) is one group and gets
// one combined reminder listing all their pending forms.
async function loadRoundStatus(supabase: ReturnType<typeof getAdminClient>, yearId: string, templateId: string) {
    const { data: projects } = await supabase
        .from("projects")
        .select("id, project_number, title_he")
        .eq("academic_year_id", yearId)
        .eq("status", "approved")
        .eq("is_taken", true);
    const projectById = new Map((projects || []).map((p) => [p.id, p]));
    const projectIds = [...projectById.keys()];

    const { data: invites } = projectIds.length
        ? await supabase
            .from("grading_invites")
            .select("id, token, project_id, role, recipient_name, recipient_email, status, invite_sent_at, submitted_at, reminder_count, last_reminder_sent_at")
            .eq("rubric_template_id", templateId)
            .in("project_id", projectIds)
        : { data: [] };

    const all = invites || [];
    const submittedList = all
        .filter((i) => i.status === "submitted")
        .map((i) => ({
            id: i.id,
            role: i.role as GradingRole,
            recipient_name: i.recipient_name,
            recipient_email: i.recipient_email,
            project_number: projectById.get(i.project_id)?.project_number ?? null,
            title_he: projectById.get(i.project_id)?.title_he ?? "",
            submitted_at: i.submitted_at as string | null,
        }))
        .sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));
    const pending = all.filter((i) => i.status === "pending");
    const pendingUnsent = pending.filter((i) => !i.invite_sent_at || !i.recipient_email).length;

    const cooldownStart = Date.now() - REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000;
    const groups = new Map<string, RecipientGroup>();
    for (const inv of pending) {
        if (!inv.invite_sent_at || !inv.recipient_email) continue;
        const project = projectById.get(inv.project_id);
        if (!project) continue;
        const key = inv.recipient_email.trim().toLowerCase();
        const group: RecipientGroup = groups.get(key) ?? {
            email: inv.recipient_email.trim(),
            name: null,
            invites: [],
            last_reminder_sent_at: null,
            eligible: true,
        };
        group.name = group.name || inv.recipient_name;
        group.invites.push({
            id: inv.id,
            token: inv.token,
            role: inv.role,
            project_number: project.project_number,
            title_he: project.title_he,
            reminder_count: inv.reminder_count,
            last_reminder_sent_at: inv.last_reminder_sent_at,
        });
        if (inv.last_reminder_sent_at && (!group.last_reminder_sent_at || inv.last_reminder_sent_at > group.last_reminder_sent_at)) {
            group.last_reminder_sent_at = inv.last_reminder_sent_at;
        }
        groups.set(key, group);
    }
    for (const group of groups.values()) {
        group.eligible = !group.last_reminder_sent_at || new Date(group.last_reminder_sent_at).getTime() < cooldownStart;
        group.invites.sort((a, b) => (a.project_number ?? 0) - (b.project_number ?? 0));
    }

    const recipients = [...groups.values()].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "he"));
    return {
        total: all.length,
        submitted: submittedList.length,
        submitted_list: submittedList,
        pending: pending.length,
        pending_unsent: pendingUnsent,
        recipients,
    };
}

function stripTokens(recipients: RecipientGroup[]) {
    return recipients.map((r) => ({
        ...r,
        invites: r.invites.map((inv) => ({
            id: inv.id,
            role: inv.role,
            project_number: inv.project_number,
            title_he: inv.title_he,
            reminder_count: inv.reminder_count,
            last_reminder_sent_at: inv.last_reminder_sent_at,
        })),
    }));
}

// Status + dry-run preview for the step's progress badge and the reminder
// confirm dialog — what a POST to this same route would do.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ templateKey: string }> }
) {
    const { templateKey } = await params;
    if (!isValidTemplateKey(templateKey)) {
        return NextResponse.json({ error: "Unknown round" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const yearId = await resolveYearId(supabase, request.nextUrl.searchParams.get("year"));
    if (!yearId) {
        return NextResponse.json({ error: "שנה אקדמית לא נמצאה" }, { status: 404 });
    }
    const templateId = await resolveTemplateId(supabase, templateKey);
    if (!templateId) {
        return NextResponse.json({ error: "טופס לא נמצא" }, { status: 404 });
    }

    const status = await loadRoundStatus(supabase, yearId, templateId);
    return NextResponse.json({
        ...status,
        recipients: stripTokens(status.recipients),
        cooldown_hours: REMINDER_COOLDOWN_HOURS,
    });
}

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
        const supabase = getAdminClient();
        const yearId = await resolveYearId(supabase, body?.year ?? null);
        if (!yearId) {
            return NextResponse.json({ error: "שנה אקדמית לא נמצאה" }, { status: 404 });
        }
        const templateId = await resolveTemplateId(supabase, templateKey);
        if (!templateId) {
            return NextResponse.json({ error: "טופס לא נמצא" }, { status: 404 });
        }

        const { recipients } = await loadRoundStatus(supabase, yearId, templateId);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        let reminded = 0;
        let skippedRecent = 0;
        const failed: { email: string; error: string }[] = [];

        for (const recipient of recipients) {
            if (!recipient.eligible) {
                skippedRecent += 1;
                continue;
            }
            try {
                await sendEmail({
                    to: recipient.email,
                    ...roundReminderEmail(templateKey, recipient, appUrl),
                });
                const now = new Date().toISOString();
                await Promise.all(
                    recipient.invites.map((inv) =>
                        supabase
                            .from("grading_invites")
                            .update({ reminder_count: inv.reminder_count + 1, last_reminder_sent_at: now })
                            .eq("id", inv.id)
                    )
                );
                reminded += 1;
            } catch (err) {
                failed.push({ email: recipient.email, error: err instanceof Error ? err.message : "שגיאה בשליחת המייל" });
            }
        }

        return NextResponse.json({ reminded, skipped_recent: skippedRecent, failed });
    } catch (err) {
        console.error("POST /api/admin/grading/remind-round/[templateKey] error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

function roundReminderEmail(templateKey: RubricTemplateKey, recipient: RecipientGroup, appUrl: string) {
    const roundLabel = RUBRIC_TEMPLATE_LABELS[templateKey];
    const single = recipient.invites.length === 1;
    const rows = recipient.invites
        .map((inv) => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${inv.project_number ? `#${inv.project_number} ` : ""}${inv.title_he}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #555;">${GRADING_ROLE_LABELS[inv.role]}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
              <a href="${appUrl}/grade/${inv.token}" style="background: #2563eb; color: white; padding: 6px 16px; border-radius: 6px; text-decoration: none; display: inline-block; white-space: nowrap;">
                מילוי הטופס
              </a>
            </td>
          </tr>`)
        .join("");

    return {
        subject: single
            ? `תזכורת: בקשה למתן ציון — ${recipient.invites[0].title_he}`
            : `תזכורת: ${recipient.invites.length} טפסי ציון ממתינים — ${roundLabel}`,
        html: wrapEmailHtml(`
        <h2 style="margin-bottom: 4px;">תזכורת: בקשה למתן ציון</h2>
        <p>שלום${recipient.name ? ` ${recipient.name}` : ""},</p>
        <p>טרם הוגש ציון עבור ${single ? "הטופס הבא" : `${recipient.invites.length} הטפסים הבאים`} (${roundLabel}):</p>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
          ${rows}
        </table>
        <p style="color: #888; font-size: 13px; margin-top: 24px;">לכל פרויקט קישור נפרד. אם הציון כבר הוגש, ניתן להתעלם ממייל זה.</p>
      `),
    };
}

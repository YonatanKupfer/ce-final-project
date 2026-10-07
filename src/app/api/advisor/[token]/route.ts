import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

// Public, unauthenticated advisor portal — mirrors /api/shared-project/[token]:
// a persistent token (from advisor_links) scoped to one advisor's email,
// never the browser Supabase client, always the service-role admin client.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const supabase = getAdminClient();

        const { data: link } = await supabase
            .from("advisor_links")
            .select("academic_supervisor_email, academic_supervisor_name")
            .eq("token", token)
            .maybeSingle();
        if (!link) {
            return NextResponse.json({ error: "Invalid token" }, { status: 404 });
        }

        const { data: templates } = await supabase
            .from("rubric_templates")
            .select("id, key")
            .in("key", ["mid_presentation", "final_presentation"]);
        const midTemplateId = templates?.find((t) => t.key === "mid_presentation")?.id ?? null;
        const finalTemplateId = templates?.find((t) => t.key === "final_presentation")?.id ?? null;

        const { data: myProjects } = await supabase
            .from("projects")
            .select("id, project_number, title_he, title_en")
            .ilike("academic_supervisor_email", link.academic_supervisor_email)
            .eq("status", "approved")
            .eq("is_taken", true)
            .order("project_number", { ascending: true });
        const projectList = myProjects || [];
        const projectIds = projectList.map((p) => p.id);

        const { data: judgeInvites } = projectIds.length
            ? await supabase
                .from("grading_invites")
                .select("id, project_id, rubric_template_id, recipient_name, recipient_email, invite_sent_at, status")
                .eq("role", "judge")
                .in("project_id", projectIds)
                .in("rubric_template_id", [midTemplateId, finalTemplateId].filter(Boolean))
            : { data: [] as { id: string; project_id: string; rubric_template_id: string; recipient_name: string | null; recipient_email: string | null; invite_sent_at: string | null; status: string }[] };

        type JudgeEntry = { id: string; recipient_name: string; recipient_email: string; invite_sent_at: string | null; status: "pending" | "submitted" };
        const judgesByProjectAndTemplate = new Map<string, JudgeEntry[]>();
        for (const inv of judgeInvites || []) {
            const key = `${inv.project_id}:${inv.rubric_template_id}`;
            const entry: JudgeEntry = {
                id: inv.id,
                recipient_name: inv.recipient_name || "",
                recipient_email: inv.recipient_email || "",
                invite_sent_at: inv.invite_sent_at,
                status: inv.status as "pending" | "submitted",
            };
            judgesByProjectAndTemplate.set(key, [...(judgesByProjectAndTemplate.get(key) || []), entry]);
        }

        const projects = projectList.map((p) => ({
            id: p.id,
            project_number: p.project_number,
            title_he: p.title_he,
            title_en: p.title_en,
            rounds: {
                mid_presentation: { judges: judgesByProjectAndTemplate.get(`${p.id}:${midTemplateId}`) || [] },
                final_presentation: { judges: judgesByProjectAndTemplate.get(`${p.id}:${finalTemplateId}`) || [] },
            },
        }));

        // Every distinct advisor identity in the system — feeds the "pick an
        // existing advisor as judge" picker, regardless of which project
        // they themselves advise.
        const { data: allProjects } = await supabase
            .from("projects")
            .select("academic_supervisor_name, academic_supervisor_email");
        const seen = new Set<string>();
        const knownAdvisors: { name: string; email: string }[] = [];
        for (const p of allProjects || []) {
            const emailKey = p.academic_supervisor_email.toLowerCase();
            if (seen.has(emailKey)) continue;
            seen.add(emailKey);
            knownAdvisors.push({ name: p.academic_supervisor_name, email: p.academic_supervisor_email });
        }

        return NextResponse.json({
            advisor: { name: link.academic_supervisor_name, email: link.academic_supervisor_email },
            mid_template_id: midTemplateId,
            final_template_id: finalTemplateId,
            projects,
            knownAdvisors,
        });
    } catch (err) {
        console.error("GET /api/advisor/[token] error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

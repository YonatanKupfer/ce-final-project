import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { judgeScoreSubmitSchema, advisorFinalScoreSubmitSchema } from "@/lib/validations";
import { isAdvisorFinalCombinedForm, type RubricTemplateKey, type GradeComponentKey } from "@/lib/constants";

// Public-safe project columns only — never `select("*")` here (same rule
// as /api/shared-project/[token]).
const PUBLIC_SAFE_PROJECT_COLUMNS = "id, project_number, title_he, title_en, track, recommended_track, supervisors_name, academic_supervisor_name, abstract, objective, scope" as const;

const FINAL_ADVISOR_WEIGHT_KEYS: GradeComponentKey[] = ["final_advisor", "teamwork", "project_book", "objectives"];

async function loadFinalAdvisorWeights(supabase: ReturnType<typeof getAdminClient>, projectId: string) {
    const { data: project } = await supabase.from("projects").select("academic_year_id").eq("id", projectId).single();
    if (!project?.academic_year_id) return {};
    const { data: weights } = await supabase
        .from("grade_components")
        .select("key, weight_percent")
        .eq("academic_year_id", project.academic_year_id)
        .in("key", FINAL_ADVISOR_WEIGHT_KEYS);
    return Object.fromEntries((weights || []).map((w) => [w.key, w.weight_percent])) as Partial<Record<GradeComponentKey, number>>;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const supabase = getAdminClient();

        const { data: invite } = await supabase
            .from("grading_invites")
            .select(
                `id, project_id, role, status, recipient_name, score, teamwork_score, project_book_score, objectives_score, deliverables_on_time, rubric_template:rubric_templates(key, label_he), project:projects(${PUBLIC_SAFE_PROJECT_COLUMNS})`
            )
            .eq("token", token)
            .single();

        if (!invite) {
            return NextResponse.json({ error: "Invalid token" }, { status: 404 });
        }

        const template = invite.rubric_template as unknown as { key: RubricTemplateKey; label_he: string };
        const combined = isAdvisorFinalCombinedForm(template.key, invite.role);
        const weights = combined ? await loadFinalAdvisorWeights(supabase, invite.project_id) : undefined;

        return NextResponse.json({
            invite: {
                id: invite.id,
                role: invite.role,
                status: invite.status,
                recipient_name: invite.recipient_name,
                score: invite.score,
                teamwork_score: invite.teamwork_score,
                project_book_score: invite.project_book_score,
                objectives_score: invite.objectives_score,
                deliverables_on_time: invite.deliverables_on_time,
            },
            template,
            project: invite.project,
            formKind: combined ? "advisor_final_combined" : "single_score",
            weights,
        });
    } catch (err) {
        console.error("GET /api/grade/[token] error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const body = await request.json();

        const supabase = getAdminClient();
        const { data: invite } = await supabase
            .from("grading_invites")
            .select("id, project_id, role, rubric_template:rubric_templates(key)")
            .eq("token", token)
            .single();

        if (!invite) {
            return NextResponse.json({ error: "Invalid token" }, { status: 404 });
        }

        const template = invite.rubric_template as unknown as { key: RubricTemplateKey };

        if (isAdvisorFinalCombinedForm(template.key, invite.role)) {
            const parsed = advisorFinalScoreSubmitSchema.safeParse(body);
            if (!parsed.success) {
                return NextResponse.json({ error: parsed.error.issues[0]?.message || "נתונים לא תקינים" }, { status: 400 });
            }
            const { error } = await supabase
                .from("grading_invites")
                .update({
                    score: parsed.data.final_advisor,
                    teamwork_score: parsed.data.teamwork,
                    project_book_score: parsed.data.project_book,
                    objectives_score: parsed.data.objectives,
                    deliverables_on_time: parsed.data.deliverables_on_time,
                    status: "submitted",
                    submitted_at: new Date().toISOString(),
                })
                .eq("id", invite.id);
            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
            await supabase
                .from("projects")
                .update({
                    prep_report_submitted: parsed.data.deliverables_on_time,
                    prep_report_marked_at: parsed.data.deliverables_on_time ? new Date().toISOString() : null,
                })
                .eq("id", invite.project_id);
            return NextResponse.json({ success: true });
        }

        const parsed = judgeScoreSubmitSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || "נתונים לא תקינים" }, { status: 400 });
        }
        const { error } = await supabase
            .from("grading_invites")
            .update({ score: parsed.data.score, status: "submitted", submitted_at: new Date().toISOString() })
            .eq("id", invite.id);
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("POST /api/grade/[token] error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

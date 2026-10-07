import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { judgeScoreSubmitSchema, advisorFinalScoreSubmitSchema } from "@/lib/validations";
import { isAdvisorFinalCombinedForm, type RubricTemplateKey } from "@/lib/constants";

// Admin manual score entry/edit — same validation as the public submit
// path in /api/grade/[token], just reachable from the admin panel without
// ever emailing a token link.
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = getAdminClient();
    const { data: invite } = await supabase
        .from("grading_invites")
        .select("*, rubric_template:rubric_templates(key, label_he)")
        .eq("id", id)
        .single();
    if (!invite) {
        return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    return NextResponse.json({ invite });
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const supabase = getAdminClient();
        const { data: invite } = await supabase
            .from("grading_invites")
            .select("id, project_id, role, rubric_template:rubric_templates(key)")
            .eq("id", id)
            .single();
        if (!invite) {
            return NextResponse.json({ error: "Invite not found" }, { status: 404 });
        }

        const template = invite.rubric_template as unknown as { key: RubricTemplateKey };

        if (isAdvisorFinalCombinedForm(template.key, invite.role)) {
            const parsed = advisorFinalScoreSubmitSchema.safeParse(body);
            if (!parsed.success) {
                return NextResponse.json({ error: parsed.error.issues[0]?.message || "נתונים לא תקינים" }, { status: 400 });
            }
            const { data: updated, error } = await supabase
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
                .eq("id", id)
                .select("*")
                .single();
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
            return NextResponse.json({ invite: updated });
        }

        const parsed = judgeScoreSubmitSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || "נתונים לא תקינים" }, { status: 400 });
        }
        const { data: updated, error } = await supabase
            .from("grading_invites")
            .update({ score: parsed.data.score, status: "submitted", submitted_at: new Date().toISOString() })
            .eq("id", id)
            .select("*")
            .single();
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ invite: updated });
    } catch (err) {
        console.error("PATCH /api/admin/grading/invites/[id] error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = getAdminClient();
    const { error } = await supabase.from("grading_invites").delete().eq("id", id);
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
}

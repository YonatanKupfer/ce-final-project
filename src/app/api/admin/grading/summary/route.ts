import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import {
    GRADE_COMPONENT_KEYS,
    isAdvisorFinalCombinedForm,
    roundComponentKey,
    type GradeComponentKey,
    type GradingRole,
    type RubricTemplateKey,
} from "@/lib/constants";

// Computes each project's grade breakdown for a year: every submitted
// invite's answers are grouped by component_key (a judges component
// naturally averages across multiple judge invites; an advisor component
// normally has exactly one contributing invite).
export async function GET(request: NextRequest) {
    const yearSlug = request.nextUrl.searchParams.get("year");
    const supabase = getAdminClient();

    const { data: year } = yearSlug
        ? await supabase.from("academic_years").select("id").eq("slug", yearSlug).maybeSingle()
        : await supabase.from("academic_years").select("id").eq("is_active", true).maybeSingle();

    if (!year) {
        return NextResponse.json({ error: "שנה אקדמית לא נמצאה" }, { status: 404 });
    }

    const { data: weights } = await supabase
        .from("grade_components")
        .select("key, weight_percent")
        .eq("academic_year_id", year.id);
    const weightByKey = new Map<GradeComponentKey, number>(
        (weights || []).map((w) => [w.key as GradeComponentKey, w.weight_percent as number])
    );

    const { data: projects } = await supabase
        .from("projects")
        .select("id, project_number, title_he, title_en, prep_report_submitted")
        .eq("academic_year_id", year.id)
        .eq("status", "approved")
        .eq("is_taken", true)
        .order("project_number", { ascending: true });

    const projectIds = (projects || []).map((p) => p.id);

    const { data: registrations } = projectIds.length
        ? await supabase
            .from("registrations")
            .select("project_id, student1_name, student2_name")
            .in("project_id", projectIds)
            .eq("status", "approved")
        : { data: [] as { project_id: string; student1_name: string; student2_name: string | null }[] };

    const { data: invites } = projectIds.length
        ? await supabase
            .from("grading_invites")
            .select("project_id, role, score, teamwork_score, project_book_score, objectives_score, rubric_template:rubric_templates(key)")
            .in("project_id", projectIds)
            .eq("status", "submitted")
        : {
            data: [] as {
                project_id: string;
                role: GradingRole;
                score: number | null;
                teamwork_score: number | null;
                project_book_score: number | null;
                objectives_score: number | null;
                rubric_template: { key: RubricTemplateKey } | { key: RubricTemplateKey }[] | null;
            }[],
        };

    const studentsByProject = new Map<string, string[]>();
    for (const r of registrations || []) {
        const names = [r.student1_name, r.student2_name].filter((n): n is string => !!n);
        studentsByProject.set(r.project_id, [...(studentsByProject.get(r.project_id) || []), ...names]);
    }

    // Per project, per component: every submitted invite's contributed raw
    // 0-100 value (a judges component naturally averages across multiple
    // judge invites; an advisor component normally has exactly one).
    const scoresByProject = new Map<string, Partial<Record<GradeComponentKey, number[]>>>();
    const addScore = (projectId: string, key: GradeComponentKey, value: number) => {
        const perProject = scoresByProject.get(projectId) ?? {};
        perProject[key] = [...(perProject[key] ?? []), value];
        scoresByProject.set(projectId, perProject);
    };

    for (const inv of invites || []) {
        const template = Array.isArray(inv.rubric_template) ? inv.rubric_template[0] : inv.rubric_template;
        if (!template) continue;
        if (inv.score !== null) addScore(inv.project_id, roundComponentKey(template.key, inv.role), inv.score);
        if (isAdvisorFinalCombinedForm(template.key, inv.role)) {
            if (inv.teamwork_score !== null) addScore(inv.project_id, "teamwork", inv.teamwork_score);
            if (inv.project_book_score !== null) addScore(inv.project_id, "project_book", inv.project_book_score);
            if (inv.objectives_score !== null) addScore(inv.project_id, "objectives", inv.objectives_score);
        }
    }

    const rows = (projects || []).map((p) => {
        const projectScores = scoresByProject.get(p.id) ?? {};
        const componentScores: Partial<Record<GradeComponentKey, number>> = {
            prep_report: p.prep_report_submitted ? 100 : 0,
        };

        for (const key of GRADE_COMPONENT_KEYS) {
            if (key === "prep_report") continue;
            const scores = projectScores[key] ?? [];
            if (scores.length > 0) {
                componentScores[key] = scores.reduce((a, b) => a + b, 0) / scores.length;
            }
        }

        const complete = GRADE_COMPONENT_KEYS.every((key) => componentScores[key] !== undefined);
        const finalGrade = complete
            ? GRADE_COMPONENT_KEYS.reduce((sum, key) => sum + (componentScores[key]! * (weightByKey.get(key) ?? 0)) / 100, 0)
            : null;

        return {
            project_id: p.id,
            project_number: p.project_number,
            title_he: p.title_he,
            title_en: p.title_en,
            prep_report_submitted: p.prep_report_submitted,
            students: studentsByProject.get(p.id) || [],
            component_scores: componentScores,
            complete,
            final_grade: finalGrade,
        };
    });

    return NextResponse.json({ weights: Object.fromEntries(weightByKey), rows });
}

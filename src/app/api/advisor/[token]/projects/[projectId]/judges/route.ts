import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { advisorJudgeAssignSchema } from "@/lib/validations";

// Advisor-portal judge assignment. role is always 'judge', invite_sent_at
// stays NULL (the global per-round admin "send" action is what actually
// emails it later) and created_by_email is the advisor's own identity,
// resolved server-side from the token — never client-supplied.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string; projectId: string }> }
) {
    try {
        const { token, projectId } = await params;
        const body = await request.json();
        const parsed = advisorJudgeAssignSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || "נתונים לא תקינים" }, { status: 400 });
        }

        const supabase = getAdminClient();

        const { data: link } = await supabase
            .from("advisor_links")
            .select("academic_supervisor_email")
            .eq("token", token)
            .maybeSingle();
        if (!link) {
            return NextResponse.json({ error: "Invalid token" }, { status: 404 });
        }

        // Defense in depth: a token can't be used to assign judges on a
        // project that isn't that advisor's own, even if projectId is guessed.
        const { data: project } = await supabase
            .from("projects")
            .select("id, academic_supervisor_email")
            .eq("id", projectId)
            .maybeSingle();
        if (!project || project.academic_supervisor_email.toLowerCase() !== link.academic_supervisor_email.toLowerCase()) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const { data: template } = await supabase
            .from("rubric_templates")
            .select("id")
            .eq("key", parsed.data.rubric_template_key)
            .single();
        if (!template) {
            return NextResponse.json({ error: "Unknown round" }, { status: 400 });
        }

        const { data: invite, error } = await supabase
            .from("grading_invites")
            .insert({
                project_id: projectId,
                rubric_template_id: template.id,
                role: "judge",
                recipient_name: parsed.data.recipient_name,
                recipient_email: parsed.data.recipient_email,
                created_by_email: link.academic_supervisor_email,
                invite_sent_at: null,
            })
            .select("id, recipient_name, recipient_email")
            .single();

        if (error) {
            if (error.code === "23505") {
                return NextResponse.json({ error: "השופט/ת הזה/זו כבר משובץ/ת לפרויקט זה בסבב זה" }, { status: 409 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ invite });
    } catch (err) {
        console.error("POST /api/advisor/[token]/projects/[projectId]/judges error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

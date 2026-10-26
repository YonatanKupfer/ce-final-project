import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { gradingInviteCreateSchema } from "@/lib/validations";
import { RUBRIC_TEMPLATE_ROLES } from "@/lib/constants";

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
        if (!RUBRIC_TEMPLATE_ROLES[rubric_template_key].includes(role)) {
            return NextResponse.json({ error: "תפקיד זה אינו ממלא את הטופס הזה" }, { status: 400 });
        }

        const supabase = getAdminClient();

        const { data: project } = await supabase
            .from("projects")
            .select("id")
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
                // Never emailed on creation — same as an advisor's portal
                // assignment. The per-form "send" action (or the single
                // invite send button) emails it when the admin decides to.
                invite_sent_at: null,
            })
            .select("*")
            .single();

        if (error || !invite) {
            if (error?.code === "23505") {
                return NextResponse.json(
                    { error: role === "judge" ? "השופט/ת הזה/זו כבר משובץ/ת לפרויקט זה בטופס זה" : "כבר קיימת הזמנה לאחראי.ת האקדמי.ת בטופס זה" },
                    { status: 409 }
                );
            }
            return NextResponse.json({ error: error?.message || "שגיאה ביצירת הזמנה" }, { status: 500 });
        }

        return NextResponse.json({ invite });
    } catch (err) {
        console.error("POST /api/admin/projects/[id]/grading/invites error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

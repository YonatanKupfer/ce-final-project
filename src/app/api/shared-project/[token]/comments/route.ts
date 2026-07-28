import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendEmail, wrapEmailHtml } from "@/lib/email";
import { shareCommentSchema } from "@/lib/validations";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const body = await request.json();
        const parsed = shareCommentSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || "נתונים לא תקינים" }, { status: 400 });
        }

        const supabase = getAdminClient();

        const { data: share } = await supabase
            .from("project_shares")
            .select("id, project:projects(title_he)")
            .eq("token", token)
            .single();

        if (!share) {
            return NextResponse.json({ error: "Invalid token" }, { status: 404 });
        }

        const authorLabel = parsed.data.author_name.trim();

        const { data: comment, error } = await supabase
            .from("project_share_comments")
            .insert({
                share_id: share.id,
                comment_text: parsed.data.comment_text,
                author_label: authorLabel,
            })
            .select("*")
            .single();

        if (error || !comment) {
            return NextResponse.json({ error: error?.message || "שגיאה בשליחת התגובה" }, { status: 500 });
        }

        const project = Array.isArray(share.project) ? share.project[0] : share.project;
        const { data: staff } = await supabase.from("staff_emails").select("email");
        const staffEmails = (staff || []).map((s) => s.email);

        if (staffEmails.length > 0) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            await sendEmail({
                to: staffEmails,
                subject: `הערה חדשה מגורם חיצוני: ${project?.title_he ?? ""}`,
                html: wrapEmailHtml(`
          <h2>התקבלה הערה חדשה מגורם חיצוני</h2>
          <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; font-weight: bold;">שם הפרויקט:</td><td style="padding: 8px;">${project?.title_he ?? ""}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">מאת:</td><td style="padding: 8px;">${authorLabel}</td></tr>
          </table>
          <p><strong>ההערה:</strong><br/>${parsed.data.comment_text}</p>
          <p>
            <a href="${appUrl}/admin/projects" style="background: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
              צפייה בלוח הניהול
            </a>
          </p>
        `),
            }).catch(console.error);
        }

        return NextResponse.json({ comment });
    } catch (err) {
        console.error("POST /api/shared-project/[token]/comments error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

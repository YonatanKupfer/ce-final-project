import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendEmail, wrapEmailHtml } from "@/lib/email";
import { shareProjectSchema } from "@/lib/validations";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const parsed = shareProjectSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || "נתונים לא תקינים" }, { status: 400 });
        }
        const { recipients, admin_note, created_by_email } = parsed.data;

        const supabase = getAdminClient();

        const { data: project } = await supabase
            .from("projects")
            .select("*")
            .eq("id", id)
            .single();

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const { data: share, error } = await supabase
            .from("project_shares")
            .insert({
                project_id: id,
                admin_note: admin_note || null,
                created_by_email,
            })
            .select("*")
            .single();

        if (error || !share) {
            return NextResponse.json({ error: error?.message || "שגיאה בשיתוף" }, { status: 500 });
        }

        const { data: insertedRecipients, error: recipientsError } = await supabase
            .from("project_share_recipients")
            .insert(recipients.map((r) => ({ share_id: share.id, email: r.email, name: r.name || null })))
            .select("*");

        if (recipientsError) {
            return NextResponse.json({ error: recipientsError.message }, { status: 500 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const shareLink = `${appUrl}/shared-project/${share.token}`;

        await Promise.all(
            recipients.map((r) =>
                sendEmail({
                    to: r.email,
                    subject: `שותף איתך פרויקט לצפייה: ${project.title_he}`,
                    html: wrapEmailHtml(`
            <h2>שיתוף פרויקט לצפייה</h2>
            <p>שלום${r.name ? ` ${r.name}` : ""},</p>
            <p>שותף/ה איתך פרויקט הגמר הבא לצפייה ומתן משוב:</p>
            <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; font-weight: bold;">מספר פרויקט:</td><td style="padding: 8px;">${project.project_number ?? "—"}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">שם הפרויקט (עברית):</td><td style="padding: 8px;">${project.title_he}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Project Title:</td><td style="padding: 8px;">${project.title_en}</td></tr>
            </table>
            ${admin_note ? `<p><strong>הערה:</strong><br/>${admin_note}</p>` : ""}
            <p>
              <a href="${shareLink}" style="background: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
                צפייה בפרויקט והוספת הערות
              </a>
            </p>
          `),
                }).catch(console.error)
            )
        );

        return NextResponse.json({ share: { ...share, recipients: insertedRecipients || [] } });
    } catch (err) {
        console.error("POST /api/admin/projects/[id]/share error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

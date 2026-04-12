import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendEmail, wrapEmailHtml } from "@/lib/email";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getAdminClient();

        // Get project before updating
        const { data: project } = await supabase
            .from("projects")
            .select("*")
            .eq("id", id)
            .single();

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const { error } = await supabase
            .from("projects")
            .update({ status: "rejected" })
            .eq("id", id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Send rejection email to supervisor
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const editLink = `${appUrl}/he/propose?token=${project.edit_token}`;

        await sendEmail({
            to: project.academic_supervisor_email,
            subject: `הצעת פרויקט נדחתה: ${project.title_he}`,
            html: wrapEmailHtml(`
        <h2>הצעת הפרויקט נדחתה</h2>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">שם הפרויקט (עברית):</td><td style="padding: 8px;">${project.title_he}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Project Title:</td><td style="padding: 8px;">${project.title_en}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">מנחה:</td><td style="padding: 8px;">${project.supervisors_name}</td></tr>
        </table>
        ${project.review_notes ? `<p><strong>הערות הסגל:</strong><br/>${project.review_notes}</p>` : ""}
        <p>ניתן לערוך ולהגיש מחדש את הצעת הפרויקט:</p>
        <p>
          <a href="${editLink}" style="background: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            עריכה והגשה מחדש
          </a>
        </p>
      `),
        }).catch(console.error);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("POST /api/projects/[id]/reject error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

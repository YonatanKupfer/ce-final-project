import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendEmail, wrapEmailHtml } from "@/lib/email";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { notes } = await request.json();

        if (!notes || typeof notes !== "string") {
            return NextResponse.json({ error: "Notes are required" }, { status: 400 });
        }

        const supabase = getAdminClient();

        const { data: project, error } = await supabase
            .from("projects")
            .update({ review_notes: notes, status: "review" })
            .eq("id", id)
            .select()
            .single();

        if (error || !project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Send email to supervisor with edit link
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const editUrl = `${appUrl}/he/propose?token=${project.edit_token}`;

        await sendEmail({
            to: project.academic_supervisor_email,
            subject: `הערות לתיקון - הצעת פרויקט: ${project.title_he}`,
            html: wrapEmailHtml(`
        <h2>הערות לתיקון - הצעת פרויקט</h2>
        <p><strong>שם הפרויקט:</strong> ${project.title_he} / ${project.title_en}</p>
        <h3>הערות מצוות הניהול:</h3>
        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; border-right: 4px solid #f59e0b; margin: 16px 0; white-space: pre-wrap;">
          ${notes}
        </div>
        <p>נא לתקן את ההצעה ולשלוח מחדש באמצעות הקישור הבא:</p>
        <p style="margin-top: 20px;">
          <a href="${editUrl}" style="background: #2563eb; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; display: inline-block; font-size: 16px;">
            עריכה ושליחה מחדש
          </a>
        </p>
      `),
        });

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

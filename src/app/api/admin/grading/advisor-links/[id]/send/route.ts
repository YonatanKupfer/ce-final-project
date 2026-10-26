import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendEmail, advisorPortalEmail } from "@/lib/email";

// Convenience resend button — emails the advisor their own portal link.
// No DB state to track here (unlike grading_invites.invite_sent_at); it's
// fine to send this as many times as the admin likes.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getAdminClient();

        const { data: link } = await supabase
            .from("advisor_links")
            .select("*")
            .eq("id", id)
            .single();
        if (!link) {
            return NextResponse.json({ error: "Link not found" }, { status: 404 });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const portalLink = `${appUrl}/advisor/${link.token}`;

        await sendEmail({
            to: link.academic_supervisor_email,
            ...advisorPortalEmail(link.academic_supervisor_name, portalLink),
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("POST /api/admin/grading/advisor-links/[id]/send error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

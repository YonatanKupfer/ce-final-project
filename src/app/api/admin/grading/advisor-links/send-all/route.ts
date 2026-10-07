import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendEmail, wrapEmailHtml } from "@/lib/email";

// The one global "distribute links to every academic advisor" action:
// for every distinct advisor with at least one approved+staffed project in
// the given year, get-or-create their persistent portal link and email it.
// Resending to an advisor who already has a link is intentional (mirrors
// the single-advisor "שליחה במייל" resend button) — there's no sent-state
// to dedupe against here, unlike grading_invites.invite_sent_at.
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const yearSlug: string | undefined = body?.year;
        const createdByEmail: string | undefined = body?.created_by_email;
        if (!createdByEmail) {
            return NextResponse.json({ error: "created_by_email is required" }, { status: 400 });
        }

        const supabase = getAdminClient();
        const { data: year } = yearSlug
            ? await supabase.from("academic_years").select("id").eq("slug", yearSlug).maybeSingle()
            : await supabase.from("academic_years").select("id").eq("is_active", true).maybeSingle();
        if (!year) {
            return NextResponse.json({ error: "שנה אקדמית לא נמצאה" }, { status: 404 });
        }

        const { data: projects } = await supabase
            .from("projects")
            .select("academic_supervisor_name, academic_supervisor_email")
            .eq("academic_year_id", year.id)
            .eq("status", "approved")
            .eq("is_taken", true);

        const seen = new Set<string>();
        const advisors: { name: string; email: string }[] = [];
        for (const p of projects || []) {
            const key = p.academic_supervisor_email.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            advisors.push({ name: p.academic_supervisor_name, email: p.academic_supervisor_email });
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        let sent = 0;
        const failed: { email: string; error: string }[] = [];

        for (const advisor of advisors) {
            try {
                const { data: existing } = await supabase
                    .from("advisor_links")
                    .select("token")
                    .ilike("academic_supervisor_email", advisor.email)
                    .maybeSingle();

                const token = existing?.token ?? (
                    await supabase
                        .from("advisor_links")
                        .insert({
                            academic_supervisor_email: advisor.email,
                            academic_supervisor_name: advisor.name,
                            created_by_email: createdByEmail,
                        })
                        .select("token")
                        .single()
                ).data?.token;

                if (!token) throw new Error("לא ניתן היה ליצור קישור");

                const portalLink = `${appUrl}/advisor/${token}`;
                await sendEmail({
                    to: advisor.email,
                    subject: "שיבוץ שופטים לפרויקטים שלך",
                    html: wrapEmailHtml(`
            <h2>שיבוץ שופטים לפרויקטים שלך</h2>
            <p>שלום ${advisor.name},</p>
            <p>באמצעות הקישור הבא ניתן לשבץ שופט/ת לכל אחד מהפרויקטים שבאחריותך, למצגת האמצע ולמצגת הסיום:</p>
            <p>
              <a href="${portalLink}" style="background: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
                מעבר לשיבוץ שופטים
              </a>
            </p>
          `),
                });
                sent += 1;
            } catch (err) {
                failed.push({ email: advisor.email, error: err instanceof Error ? err.message : "שגיאה בשליחת המייל" });
            }
        }

        return NextResponse.json({ total: advisors.length, sent, failed });
    } catch (err) {
        console.error("POST /api/admin/grading/advisor-links/send-all error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

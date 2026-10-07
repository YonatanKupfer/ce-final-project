import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { advisorLinkCreateSchema } from "@/lib/validations";

// Every distinct academic-advisor identity that appears on at least one
// project in the given year, left-joined with their advisor_links row
// (if a portal link has already been generated for them).
export async function GET(request: NextRequest) {
    const yearSlug = request.nextUrl.searchParams.get("year");
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

    const { data: links } = await supabase
        .from("advisor_links")
        .select("id, academic_supervisor_email, token");
    const linkByEmail = new Map((links || []).map((l) => [l.academic_supervisor_email.toLowerCase(), l]));

    return NextResponse.json({
        advisors: advisors.map((a) => ({
            ...a,
            link: linkByEmail.get(a.email.toLowerCase()) ?? null,
        })),
    });
}

// Get-or-create a persistent portal token for an advisor's email.
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = advisorLinkCreateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || "נתונים לא תקינים" }, { status: 400 });
        }

        const supabase = getAdminClient();
        const { data: existing } = await supabase
            .from("advisor_links")
            .select("*")
            .ilike("academic_supervisor_email", parsed.data.academic_supervisor_email)
            .maybeSingle();
        if (existing) {
            return NextResponse.json({ link: existing });
        }

        const { data: link, error } = await supabase
            .from("advisor_links")
            .insert({
                academic_supervisor_email: parsed.data.academic_supervisor_email,
                academic_supervisor_name: parsed.data.academic_supervisor_name,
                created_by_email: parsed.data.created_by_email,
            })
            .select("*")
            .single();

        if (error || !link) {
            return NextResponse.json({ error: error?.message || "שגיאה ביצירת קישור" }, { status: 500 });
        }

        return NextResponse.json({ link });
    } catch (err) {
        console.error("POST /api/admin/grading/advisor-links error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

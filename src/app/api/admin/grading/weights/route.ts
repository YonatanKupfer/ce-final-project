import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { gradeWeightsUpdateSchema } from "@/lib/validations";

async function resolveYearId(supabase: ReturnType<typeof getAdminClient>, yearSlug: string | null) {
    if (yearSlug) {
        const { data } = await supabase.from("academic_years").select("id").eq("slug", yearSlug).maybeSingle();
        return data?.id ?? null;
    }
    const { data } = await supabase.from("academic_years").select("id").eq("is_active", true).maybeSingle();
    return data?.id ?? null;
}

export async function GET(request: NextRequest) {
    const yearSlug = request.nextUrl.searchParams.get("year");
    const supabase = getAdminClient();

    const yearId = await resolveYearId(supabase, yearSlug);
    if (!yearId) {
        return NextResponse.json({ error: "שנה אקדמית לא נמצאה" }, { status: 404 });
    }

    const { data: weights, error } = await supabase
        .from("grade_components")
        .select("*")
        .eq("academic_year_id", yearId)
        .order("sort_order", { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ weights: weights || [] });
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const yearSlug: string | undefined = body?.year;
        const parsed = gradeWeightsUpdateSchema.safeParse({ weights: body?.weights });
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || "נתונים לא תקינים" }, { status: 400 });
        }

        const supabase = getAdminClient();
        const yearId = await resolveYearId(supabase, yearSlug ?? null);
        if (!yearId) {
            return NextResponse.json({ error: "שנה אקדמית לא נמצאה" }, { status: 404 });
        }

        await Promise.all(
            parsed.data.weights.map((w) =>
                supabase
                    .from("grade_components")
                    .update({ weight_percent: w.weight_percent, updated_at: new Date().toISOString() })
                    .eq("academic_year_id", yearId)
                    .eq("key", w.key)
            )
        );

        const { data: weights, error } = await supabase
            .from("grade_components")
            .select("*")
            .eq("academic_year_id", yearId)
            .order("sort_order", { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ weights: weights || [] });
    } catch (err) {
        console.error("PUT /api/admin/grading/weights error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

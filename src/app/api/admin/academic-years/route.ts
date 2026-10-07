import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { GRADE_COMPONENT_DEFAULTS } from "@/lib/constants";

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { slug, label_en, label_he } = body ?? {};

    if (!slug?.trim() || !label_en?.trim() || !label_he?.trim()) {
        return NextResponse.json({ error: "slug, label_en and label_he are required" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
        .from("academic_years")
        .insert({ slug: slug.trim(), label_en: label_en.trim(), label_he: label_he.trim(), is_active: false })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Seed grade component weights for the new year — copy from the
    // currently-active year if one exists, else fall back to the defaults.
    const { data: activeYear } = await supabase
        .from("academic_years")
        .select("id")
        .eq("is_active", true)
        .neq("id", data.id)
        .maybeSingle();

    let sourceWeights: { key: string; label_he: string; weight_percent: number; sort_order: number }[] | null = null;
    if (activeYear) {
        const { data: activeComponents } = await supabase
            .from("grade_components")
            .select("key, label_he, weight_percent, sort_order")
            .eq("academic_year_id", activeYear.id);
        if (activeComponents && activeComponents.length > 0) sourceWeights = activeComponents;
    }

    const componentsToInsert = (sourceWeights ?? GRADE_COMPONENT_DEFAULTS).map((c) => ({
        academic_year_id: data.id,
        key: c.key,
        label_he: c.label_he,
        weight_percent: c.weight_percent,
        sort_order: c.sort_order,
    }));

    const { error: componentsError } = await supabase.from("grade_components").insert(componentsToInsert);
    if (componentsError) {
        console.error("[academic-years] failed to seed grade_components:", componentsError);
    }

    return NextResponse.json({ success: true, year: data });
}

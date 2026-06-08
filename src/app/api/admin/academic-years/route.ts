import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

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

    return NextResponse.json({ success: true, year: data });
}

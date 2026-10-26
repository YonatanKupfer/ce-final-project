import { getAdminClient } from "@/lib/supabase";
import { RUBRIC_TEMPLATE_KEYS, type RubricTemplateKey } from "@/lib/constants";

type AdminClient = ReturnType<typeof getAdminClient>;

// Shared by the per-form admin grading routes (send-round, remind-round).

export async function resolveYearId(supabase: AdminClient, yearSlug: string | null) {
    if (yearSlug) {
        const { data } = await supabase.from("academic_years").select("id").eq("slug", yearSlug).maybeSingle();
        return data?.id ?? null;
    }
    const { data } = await supabase.from("academic_years").select("id").eq("is_active", true).maybeSingle();
    return data?.id ?? null;
}

export function isValidTemplateKey(key: string): key is RubricTemplateKey {
    return (RUBRIC_TEMPLATE_KEYS as readonly string[]).includes(key);
}

export async function resolveTemplateId(supabase: AdminClient, templateKey: RubricTemplateKey) {
    const { data } = await supabase.from("rubric_templates").select("id").eq("key", templateKey).maybeSingle();
    return data?.id ?? null;
}

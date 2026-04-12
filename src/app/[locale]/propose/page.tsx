import { getTranslations } from "next-intl/server";
import { ProposalForm } from "@/components/proposal-form";
import { supabase } from "@/lib/supabase";

interface PageProps {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ token?: string }>;
}

export default async function ProposePage({ params, searchParams }: PageProps) {
    const t = await getTranslations("propose");
    const { token } = await searchParams;

    let initialData = undefined;

    if (token) {
        const { data } = await supabase
            .from("projects")
            .select("*")
            .eq("edit_token", token)
            .single();

        if (data) {
            initialData = {
                id: data.id,
                title_he: data.title_he,
                title_en: data.title_en,
                track: data.track,
                recommended_track: data.recommended_track,
                supervisors_name: data.supervisors_name,
                supervisors_email: data.supervisors_email,
                academic_supervisor_name: data.academic_supervisor_name,
                academic_supervisor_email: data.academic_supervisor_email,
                abstract: data.abstract,
                objective: data.objective,
                scope: data.scope,
                prereq_course_1: data.prereq_course_1 || "",
                prereq_course_2: data.prereq_course_2 || "",
                references_text: data.references_text,
            };
        }
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight">
                    {token ? t("editTitle") : t("title")}
                </h1>
            </div>
            <ProposalForm editToken={token} initialData={initialData} />
        </div>
    );
}

import type { SupabaseClient } from "@supabase/supabase-js";

export const PROJECT_ALREADY_TAKEN = "לפרויקט זה כבר קיימת הרשמה מאושרת";

// Postgres unique_violation, raised by the registrations_one_approved_per_project
// index when two approvals for the same project race each other.
export const UNIQUE_VIOLATION = "23505";

export async function hasOtherApprovedRegistration(
    supabase: SupabaseClient,
    projectId: string,
    excludeRegistrationId: string
) {
    const { count } = await supabase
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "approved")
        .neq("id", excludeRegistrationId);
    return (count ?? 0) > 0;
}

// Recompute is_taken from the project's approved registrations rather than
// flipping it per transition, so freeing or deleting one registration can't
// un-staff a project that another approved registration still holds.
export async function syncProjectTaken(supabase: SupabaseClient, projectId: string) {
    const { count } = await supabase
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "approved");
    await supabase
        .from("projects")
        .update({ is_taken: (count ?? 0) > 0 })
        .eq("id", projectId);
}

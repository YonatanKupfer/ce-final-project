import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const supabase = getAdminClient();

        const allowedFields = [
            "status", "student1_name", "student1_id", "student1_email",
            "student2_name", "student2_id", "student2_email", "is_ce_student",
        ];

        const updateData: Record<string, unknown> = {};
        for (const key of allowedFields) {
            if (key in body) {
                updateData[key] = body[key];
            }
        }

        // If status changed to approved, also update the project
        if (updateData.status === "approved") {
            const { data: reg } = await supabase
                .from("registrations")
                .select("project_id")
                .eq("id", id)
                .single();

            if (reg) {
                await supabase
                    .from("projects")
                    .update({ is_taken: true })
                    .eq("id", reg.project_id);
            }
        }

        const { error } = await supabase
            .from("registrations")
            .update(updateData)
            .eq("id", id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

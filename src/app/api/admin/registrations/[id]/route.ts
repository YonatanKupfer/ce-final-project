import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import {
    PROJECT_ALREADY_TAKEN, UNIQUE_VIOLATION, hasOtherApprovedRegistration, syncProjectTaken,
} from "@/lib/registrations";

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

        const { data: existing } = await supabase
            .from("registrations")
            .select("project_id, status")
            .eq("id", id)
            .single();

        const newStatus = updateData.status as string | undefined;
        const approving = !!existing && existing.status !== "approved" && newStatus === "approved";
        const statusTouchesApproval = !!existing && newStatus !== undefined
            && (existing.status === "approved" || newStatus === "approved");

        if (approving && await hasOtherApprovedRegistration(supabase, existing.project_id, id)) {
            return NextResponse.json({ error: PROJECT_ALREADY_TAKEN }, { status: 409 });
        }

        const { error } = await supabase
            .from("registrations")
            .update(updateData)
            .eq("id", id);

        if (error) {
            if (error.code === UNIQUE_VIOLATION) {
                return NextResponse.json({ error: PROJECT_ALREADY_TAKEN }, { status: 409 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (statusTouchesApproval) {
            await syncProjectTaken(supabase, existing.project_id);
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getAdminClient();

        const { data: reg } = await supabase
            .from("registrations")
            .select("project_id, status")
            .eq("id", id)
            .single();

        const { error } = await supabase
            .from("registrations")
            .delete()
            .eq("id", id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // If this was an approved registration, free the project
        if (reg?.status === "approved") {
            await syncProjectTaken(supabase, reg.project_id);
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

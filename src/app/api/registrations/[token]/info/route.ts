import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const supabase = getAdminClient();

        const { data: registration } = await supabase
            .from("registrations")
            .select("*, project:projects(project_number, title_he, title_en, track, supervisors_name)")
            .eq("approval_token", token)
            .single();

        if (!registration) {
            return NextResponse.json({ error: "Invalid token" }, { status: 404 });
        }

        if (registration.status !== "pending") {
            return NextResponse.json({ error: "Already decided" }, { status: 400 });
        }

        return NextResponse.json({ registration });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

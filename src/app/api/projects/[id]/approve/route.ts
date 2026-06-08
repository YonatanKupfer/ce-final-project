import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendEmail, wrapEmailHtml } from "@/lib/email";
import { TRACKS, type TrackId } from "@/lib/constants";

const TRACK_NUMBER_START: Record<string, number> = {
    crypto: 101,
    hardware: 201,
    networks: 301,
    algorithms: 401,
    software: 501,
    ai: 601,
    signal: 701,
};

function nextFreeNumber(track: string, used: Set<number>): number {
    const start = TRACK_NUMBER_START[track] ?? 101;
    let n = start;
    while (used.has(n)) n++;
    return n;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getAdminClient();

        // Get project
        const { data: project } = await supabase
            .from("projects")
            .select("*")
            .eq("id", id)
            .single();

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        if (project.status === "approved") {
            return NextResponse.json({ error: "Already approved" }, { status: 400 });
        }

        // Determine next free project number for this track within the same academic year
        const track = project.track as TrackId;
        const trackInfo = TRACKS[track];
        const { data: existingInYear } = await supabase
            .from("projects")
            .select("project_number")
            .eq("academic_year_id", project.academic_year_id)
            .eq("track", track)
            .not("project_number", "is", null);

        const usedNumbers = new Set<number>(
            (existingInYear ?? []).map((p) => p.project_number as number)
        );
        const nextNumber = nextFreeNumber(track, usedNumbers);

        // Update project
        const { data: updated, error } = await supabase
            .from("projects")
            .update({
                status: "approved",
                project_number: nextNumber,
                review_notes: null,
            })
            .eq("id", id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Send approval email to supervisor
        await sendEmail({
            to: project.academic_supervisor_email,
            subject: `פרויקט מספר ${nextNumber} אושר: ${project.title_he}`,
            html: wrapEmailHtml(`
        <h2>הפרויקט אושר! 🎉</h2>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">מספר פרויקט:</td><td style="padding: 8px; font-size: 20px; font-weight: bold; color: #2563eb;">${nextNumber}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">שם הפרויקט (עברית):</td><td style="padding: 8px;">${project.title_he}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Project Title:</td><td style="padding: 8px;">${project.title_en}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">שרשרת:</td><td style="padding: 8px;">${trackInfo.label}</td></tr>
        </table>
        <p>הפרויקט פורסם ברשימת הפרויקטים המאושרים.</p>
      `),
        }).catch(console.error);

        return NextResponse.json({ success: true, project: updated });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

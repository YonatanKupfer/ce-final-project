"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdvisorPicker } from "@/components/advisor-picker";
import { toast } from "sonner";
import { PRESENTATION_ROUND_KEYS, RUBRIC_TEMPLATE_LABELS, type PresentationRoundKey } from "@/lib/constants";

export interface JudgeEntry {
    id: string;
    recipient_name: string;
    recipient_email: string;
    invite_sent_at: string | null;
    status: "pending" | "submitted";
}

export interface AdvisorPortalProject {
    id: string;
    project_number: number | null;
    title_he: string;
    title_en: string;
    rounds: Record<PresentationRoundKey, { judges: JudgeEntry[] }>;
}

export interface AdvisorPortalData {
    advisor: { name: string; email: string };
    projects: AdvisorPortalProject[];
    knownAdvisors: { name: string; email: string }[];
}

// Add/remove are injected so the same view backs both the real portal
// (API calls) and the admin preview (local state only, nothing saved).
// Both throw an Error with a user-facing message on failure.
export interface AdvisorPortalActions {
    addJudge: (projectId: string, round: PresentationRoundKey, name: string, email: string) => Promise<void>;
    removeJudge: (projectId: string, judge: JudgeEntry) => Promise<void>;
}

export function AdvisorPortalView({ data, actions }: { data: AdvisorPortalData; actions: AdvisorPortalActions }) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold">שיבוץ שופטים</h1>
                <p className="text-sm text-muted-foreground">שלום {data.advisor.name},</p>
                <Card className="bg-muted/40">
                    <CardContent className="py-4 text-sm space-y-1">
                        <p className="font-medium">מה צריך לעשות?</p>
                        <ol className="list-decimal pr-5 space-y-1 text-muted-foreground">
                            <li>לכל פרויקט שבאחריותך מופיע אזור נפרד למצגת האמצע ולמצגת הסיום.</li>
                            <li>בכל אזור, לבחור שופט/ת מהרשימה (או &quot;אחר&quot; להזנת שם ואימייל) וללחוץ &quot;הוספת שופט/ת&quot;.</li>
                            <li>השיבוץ נשמר מיד — אין צורך בשליחה נוספת. ניתן לחזור לעמוד זה בכל עת כדי לעדכן.</li>
                        </ol>
                        <p className="text-muted-foreground pt-1">
                            השופטים לא מקבלים מייל בשלב זה — לאחר כל מצגת, צוות הקורס ישלח להם קישור למתן ציון.
                        </p>
                    </CardContent>
                </Card>
            </div>

            {data.projects.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">אין פרויקטים בטיפולך.</CardContent>
                </Card>
            ) : (
                data.projects.map((project) => (
                    <ProjectCard key={project.id} project={project} knownAdvisors={data.knownAdvisors} actions={actions} />
                ))
            )}
        </div>
    );
}

function ProjectCard({
    project,
    knownAdvisors,
    actions,
}: {
    project: AdvisorPortalProject;
    knownAdvisors: { name: string; email: string }[];
    actions: AdvisorPortalActions;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                    {project.project_number && <Badge variant="outline" className="font-mono">#{project.project_number}</Badge>}
                    {project.title_he}
                </CardTitle>
                <p className="text-sm text-muted-foreground" dir="ltr">{project.title_en}</p>
            </CardHeader>
            <CardContent className="space-y-4">
                {PRESENTATION_ROUND_KEYS.map((round) => (
                    <RoundSection
                        key={round}
                        round={round}
                        projectId={project.id}
                        judges={project.rounds[round].judges}
                        knownAdvisors={knownAdvisors}
                        actions={actions}
                    />
                ))}
            </CardContent>
        </Card>
    );
}

function RoundSection({
    round,
    projectId,
    judges,
    knownAdvisors,
    actions,
}: {
    round: PresentationRoundKey;
    projectId: string;
    judges: JudgeEntry[];
    knownAdvisors: { name: string; email: string }[];
    actions: AdvisorPortalActions;
}) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [adding, setAdding] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);

    const handleAdd = async () => {
        if (!name.trim() || !email.trim()) return;
        setAdding(true);
        try {
            await actions.addJudge(projectId, round, name.trim(), email.trim());
            toast.success("השופט/ת שובץ/ה");
            setName("");
            setEmail("");
        } catch (err) {
            toast.error(err instanceof Error && err.message ? err.message : "שגיאה בשיבוץ השופט/ת");
        } finally {
            setAdding(false);
        }
    };

    const handleRemove = async (judge: JudgeEntry) => {
        setRemovingId(judge.id);
        try {
            await actions.removeJudge(projectId, judge);
        } catch (err) {
            toast.error(err instanceof Error && err.message ? err.message : "שגיאה בהסרת השופט/ת");
        } finally {
            setRemovingId(null);
        }
    };

    return (
        <div className="border rounded-lg p-3 space-y-2">
            <h3 className="text-sm font-semibold">{RUBRIC_TEMPLATE_LABELS[round]}</h3>
            {judges.length === 0 ? (
                <p className="text-sm text-muted-foreground">טרם שובצו שופטים.</p>
            ) : (
                <div className="space-y-1.5">
                    {judges.map((judge) => (
                        <div key={judge.id} className="flex items-center justify-between gap-2 text-sm">
                            <div>
                                <span>{judge.recipient_name}</span>
                                <span className="text-muted-foreground" dir="ltr"> · {judge.recipient_email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant={judge.status === "submitted" ? "default" : judge.invite_sent_at ? "secondary" : "outline"}>
                                    {judge.status === "submitted" ? "הוגש" : judge.invite_sent_at ? "נשלח" : "משובץ"}
                                </Badge>
                                {!judge.invite_sent_at && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={removingId === judge.id}
                                        onClick={() => handleRemove(judge)}
                                    >
                                        הסרה
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div className="space-y-2 pt-2 border-t">
                <AdvisorPicker knownAdvisors={knownAdvisors} nameValue={name} emailValue={email} onChange={(n, e) => { setName(n); setEmail(e); }} />
                <Button size="sm" onClick={handleAdd} disabled={adding || !name.trim() || !email.trim()}>
                    {adding ? "משבץ..." : "הוספת שופט/ת"}
                </Button>
            </div>
        </div>
    );
}

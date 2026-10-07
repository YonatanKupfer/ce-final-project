"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdvisorPicker } from "@/components/advisor-picker";
import { toast } from "sonner";
import { RUBRIC_TEMPLATE_KEYS, type RubricTemplateKey } from "@/lib/constants";

const ROUND_LABELS: Record<RubricTemplateKey, string> = {
    mid_presentation: "מצגת אמצע",
    final_presentation: "מצגת סיום",
};

interface JudgeEntry {
    id: string;
    recipient_name: string;
    recipient_email: string;
    invite_sent_at: string | null;
    status: "pending" | "submitted";
}

interface AdvisorPortalProject {
    id: string;
    project_number: number | null;
    title_he: string;
    title_en: string;
    rounds: Record<RubricTemplateKey, { judges: JudgeEntry[] }>;
}

interface AdvisorPortalData {
    advisor: { name: string; email: string };
    projects: AdvisorPortalProject[];
    knownAdvisors: { name: string; email: string }[];
}

export default function AdvisorPortalPage() {
    const params = useParams();
    const token = params.token as string;

    const [data, setData] = useState<AdvisorPortalData | null>(null);
    const [loading, setLoading] = useState(true);
    const [invalid, setInvalid] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/advisor/${token}`);
            if (!res.ok) {
                setInvalid(true);
            } else {
                setData(await res.json());
            }
        } catch {
            setInvalid(true);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        load();
    }, [load]);

    if (loading) {
        return (
            <html lang="he" dir="rtl" className="h-full">
                <body className="min-h-full flex items-center justify-center bg-background text-foreground p-4">
                    <Skeleton className="h-96 w-full max-w-2xl" />
                </body>
            </html>
        );
    }

    if (invalid || !data) {
        return (
            <html lang="he" dir="rtl" className="h-full">
                <body className="min-h-full flex items-center justify-center bg-background text-foreground p-4">
                    <Card className="max-w-lg w-full text-center">
                        <CardContent className="py-12">
                            <div className="text-5xl mb-4">⚠️</div>
                            <h1 className="text-2xl font-bold text-yellow-600">קישור לא תקין.</h1>
                        </CardContent>
                    </Card>
                </body>
            </html>
        );
    }

    return (
        <html lang="he" dir="rtl" className="h-full">
            <body className="min-h-full bg-background text-foreground p-4">
                <div className="max-w-3xl w-full mx-auto my-8 space-y-4">
                    <div>
                        <h1 className="text-2xl font-bold">שיבוץ שופטים</h1>
                        <p className="text-sm text-muted-foreground">
                            {data.advisor.name} · שיבוץ שופט/ת לכל אחד מהפרויקטים שבאחריותך, בנפרד למצגת האמצע ולמצגת הסיום.
                        </p>
                    </div>

                    {data.projects.length === 0 ? (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">אין פרויקטים בטיפולך.</CardContent>
                        </Card>
                    ) : (
                        data.projects.map((project) => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                knownAdvisors={data.knownAdvisors}
                                token={token}
                                onChanged={load}
                            />
                        ))
                    )}
                </div>
            </body>
        </html>
    );
}

function ProjectCard({
    project,
    knownAdvisors,
    token,
    onChanged,
}: {
    project: AdvisorPortalProject;
    knownAdvisors: { name: string; email: string }[];
    token: string;
    onChanged: () => void;
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
                {RUBRIC_TEMPLATE_KEYS.map((round) => (
                    <RoundSection
                        key={round}
                        round={round}
                        projectId={project.id}
                        judges={project.rounds[round].judges}
                        knownAdvisors={knownAdvisors}
                        token={token}
                        onChanged={onChanged}
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
    token,
    onChanged,
}: {
    round: RubricTemplateKey;
    projectId: string;
    judges: JudgeEntry[];
    knownAdvisors: { name: string; email: string }[];
    token: string;
    onChanged: () => void;
}) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [adding, setAdding] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);

    const handleAdd = async () => {
        if (!name.trim() || !email.trim()) return;
        setAdding(true);
        try {
            const res = await fetch(`/api/advisor/${token}/projects/${projectId}/judges`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rubric_template_key: round, recipient_name: name.trim(), recipient_email: email.trim() }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error);
            }
            toast.success("השופט/ת שובץ/ה");
            setName("");
            setEmail("");
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error && err.message ? err.message : "שגיאה בשיבוץ השופט/ת");
        } finally {
            setAdding(false);
        }
    };

    const handleRemove = async (judge: JudgeEntry) => {
        setRemovingId(judge.id);
        try {
            const res = await fetch(`/api/advisor/${token}/projects/${projectId}/judges/${judge.id}`, { method: "DELETE" });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error);
            }
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error && err.message ? err.message : "שגיאה בהסרת השופט/ת");
        } finally {
            setRemovingId(null);
        }
    };

    return (
        <div className="border rounded-lg p-3 space-y-2">
            <h3 className="text-sm font-semibold">{ROUND_LABELS[round]}</h3>
            {judges.length > 0 && (
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

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreFieldsForm } from "@/components/score-fields-form";
import { TRACKS, normalizeTrack, isAdvisorFinalCombinedForm, type GradingRole, type RubricTemplateKey, type GradeComponentKey } from "@/lib/constants";

interface GradeTokenData {
    invite: {
        id: string;
        role: GradingRole;
        status: "pending" | "submitted";
        recipient_name: string | null;
        score: number | null;
        teamwork_score: number | null;
        project_book_score: number | null;
        objectives_score: number | null;
        deliverables_on_time: boolean | null;
    };
    template: { key: RubricTemplateKey; label_he: string };
    project: {
        project_number: number | null;
        title_he: string;
        title_en: string;
        track: string;
        supervisors_name: string;
        academic_supervisor_name: string;
        abstract: string;
        objective: string;
        scope: string;
    };
    weights?: Partial<Record<GradeComponentKey, number>>;
}

export default function GradeTokenPage() {
    const params = useParams();
    const token = params.token as string;

    const [data, setData] = useState<GradeTokenData | null>(null);
    const [loading, setLoading] = useState(true);
    const [invalid, setInvalid] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/grade/${token}`);
                if (!res.ok) {
                    setInvalid(true);
                } else {
                    const body = await res.json();
                    setData(body);
                    setSubmitted(body.invite.status === "submitted");
                }
            } catch {
                setInvalid(true);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [token]);

    const handleSubmit = async (body: Record<string, unknown>) => {
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`/api/grade/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const resBody = await res.json().catch(() => null);
                throw new Error(resBody?.error || "שגיאה בשליחת הציון");
            }
            setSubmitted(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "שגיאה בשליחת הציון");
        } finally {
            setSubmitting(false);
        }
    };

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

    const { invite, template, project, weights } = data;
    const roleLabel = invite.role === "judge" ? "שופט/ת" : "אחראי.ת אקדמי.ת";
    const combined = isAdvisorFinalCombinedForm(template.key, invite.role);

    return (
        <html lang="he" dir="rtl" className="h-full">
            <body className="min-h-full flex items-center justify-center bg-background text-foreground p-4">
                <div className="max-w-2xl w-full my-8 space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {project.project_number && (
                                    <Badge variant="outline" className="font-mono">#{project.project_number}</Badge>
                                )}
                                <Badge variant="outline">{TRACKS[normalizeTrack(project.track)]?.label}</Badge>
                                <Badge variant="secondary">{template.label_he} — {roleLabel}</Badge>
                            </div>
                            <CardTitle className="text-xl">{project.title_he}</CardTitle>
                            <p className="text-sm text-muted-foreground" dir="ltr">{project.title_en}</p>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <p>מנחה: {project.supervisors_name}</p>
                            <p>אחראי.ת אקדמי.ת: {project.academic_supervisor_name}</p>
                            {project.abstract && <p className="pt-2 whitespace-pre-wrap text-foreground">{project.abstract}</p>}
                        </CardContent>
                    </Card>

                    {submitted && (
                        <Card className="border-green-600/30 bg-green-50 dark:bg-green-900/10">
                            <CardContent className="py-4 text-center text-green-700 dark:text-green-400 text-sm">
                                הציון נשלח בהצלחה. ניתן לערוך ולשלוח מחדש עד למועד סגירת הטופס.
                            </CardContent>
                        </Card>
                    )}

                    {error && (
                        <Card className="border-destructive/30 bg-destructive/5">
                            <CardContent className="py-3 text-center text-destructive text-sm">{error}</CardContent>
                        </Card>
                    )}

                    {combined ? (
                        <ScoreFieldsForm
                            fields={[
                                { key: "final_advisor", label: "ציון מצגת סיום", weightPercent: weights?.final_advisor, initialValue: invite.score },
                                { key: "teamwork", label: "עבודת צוות", weightPercent: weights?.teamwork, initialValue: invite.teamwork_score },
                                { key: "project_book", label: "ספר פרויקט", weightPercent: weights?.project_book, initialValue: invite.project_book_score },
                                { key: "objectives", label: "עמידה ביעדים", weightPercent: weights?.objectives, initialValue: invite.objectives_score },
                            ]}
                            showDeliverablesCheckbox
                            initialDeliverablesOnTime={invite.deliverables_on_time}
                            onSubmit={(values, deliverablesOnTime) =>
                                handleSubmit({
                                    final_advisor: values.final_advisor,
                                    teamwork: values.teamwork,
                                    project_book: values.project_book,
                                    objectives: values.objectives,
                                    deliverables_on_time: deliverablesOnTime,
                                })
                            }
                            submitting={submitting}
                            submitLabel={submitted ? "עדכון ציון" : "שליחת ציון"}
                        />
                    ) : (
                        <ScoreFieldsForm
                            fields={[{ key: "score", label: "ציון (1-100)", initialValue: invite.score }]}
                            onSubmit={(values) => handleSubmit({ score: values.score })}
                            submitting={submitting}
                            submitLabel={submitted ? "עדכון ציון" : "שליחת ציון"}
                        />
                    )}
                </div>
            </body>
        </html>
    );
}

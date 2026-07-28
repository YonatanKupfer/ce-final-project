"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { TRACKS, normalizeTrack, type PublicSafeProject, type ProjectShareComment } from "@/lib/constants";

function DetailSection({ label, value }: { label: string; value: string | null }) {
    if (!value) return null;
    return (
        <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
            <p className="text-sm whitespace-pre-wrap">{value}</p>
        </div>
    );
}

export default function SharedProjectPage() {
    const params = useParams();
    const token = params.token as string;

    const [project, setProject] = useState<PublicSafeProject | null>(null);
    const [comments, setComments] = useState<ProjectShareComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [invalid, setInvalid] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/shared-project/${token}`);
                if (!res.ok) {
                    setInvalid(true);
                } else {
                    const data = await res.json();
                    setProject(data.project);
                    setComments(data.comments || []);
                }
            } catch {
                setInvalid(true);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [token]);

    const handleSubmitComment = async () => {
        if (!newComment.trim()) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/shared-project/${token}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ comment_text: newComment.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                setComments((prev) => [...prev, data.comment]);
                setNewComment("");
            }
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

    if (invalid || !project) {
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
            <body className="min-h-full flex items-center justify-center bg-background text-foreground p-4">
                <Card className="max-w-2xl w-full my-8">
                    <CardHeader>
                        <div className="flex items-center gap-2 mb-1">
                            {project.project_number && (
                                <Badge variant="outline" className="font-mono">#{project.project_number}</Badge>
                            )}
                            <Badge variant="outline">{TRACKS[normalizeTrack(project.track)]?.label}</Badge>
                            {project.recommended_track && (
                                <Badge variant="secondary">גם: {TRACKS[normalizeTrack(project.recommended_track)]?.label}</Badge>
                            )}
                        </div>
                        <CardTitle className="text-xl">{project.title_he}</CardTitle>
                        <p className="text-sm text-muted-foreground" dir="ltr">{project.title_en}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm text-muted-foreground space-y-1">
                            <p>מנחה: {project.supervisors_name}</p>
                            <p>אחראי.ת אקדמי.ת: {project.academic_supervisor_name}</p>
                        </div>

                        <Separator />

                        <DetailSection label="תקציר" value={project.abstract} />
                        <DetailSection label="מטרה" value={project.objective} />
                        <DetailSection label="תכולה" value={project.scope} />
                        {(project.relevant_required_course_1 || project.relevant_required_course_2) && (
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">קורסי חובה רלוונטיים</p>
                                {project.relevant_required_course_1 && <p className="text-sm">• {project.relevant_required_course_1}</p>}
                                {project.relevant_required_course_2 && <p className="text-sm">• {project.relevant_required_course_2}</p>}
                            </div>
                        )}
                        {(project.prereq_course_1 || project.prereq_course_2) && (
                            <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">קורסי קדם</p>
                                {project.prereq_course_1 && <p className="text-sm">• {project.prereq_course_1}</p>}
                                {project.prereq_course_2 && <p className="text-sm">• {project.prereq_course_2}</p>}
                            </div>
                        )}
                        <DetailSection label="מקורות" value={project.references_text} />

                        <Separator />

                        <div className="space-y-3">
                            <h3 className="font-semibold text-sm text-muted-foreground">הערות</h3>
                            {comments.length === 0 && (
                                <p className="text-sm text-muted-foreground">אין הערות עדיין.</p>
                            )}
                            {comments.map((c) => (
                                <div key={c.id} className="bg-muted/30 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium">{c.author_label}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(c.created_at).toLocaleString("he-IL")}
                                        </span>
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">{c.comment_text}</p>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <Textarea
                                placeholder="הוספת הערה..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                rows={3}
                            />
                            <Button
                                onClick={handleSubmitComment}
                                disabled={submitting || !newComment.trim()}
                                className="w-full"
                            >
                                {submitting ? "שולח..." : "שליחת הערה"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </body>
        </html>
    );
}

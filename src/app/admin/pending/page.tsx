"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { Project } from "@/lib/constants";
import { TRACKS, type TrackId } from "@/lib/constants";

export default function PendingProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [reviewProject, setReviewProject] = useState<Project | null>(null);
    const [reviewNotes, setReviewNotes] = useState("");
    const [sending, setSending] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const supabase = createSupabaseBrowserClient();

    const loadProjects = useCallback(async () => {
        const { data } = await supabase
            .from("projects")
            .select("*")
            .in("status", ["pending", "review"])
            .order("created_at", { ascending: false });
        setProjects((data as Project[]) || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    const handleSendReview = async () => {
        if (!reviewProject || !reviewNotes.trim()) return;
        setSending(true);
        try {
            const res = await fetch(`/api/projects/${reviewProject.id}/review`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notes: reviewNotes }),
            });
            if (!res.ok) throw new Error();
            toast.success("ההערות נשלחו למנחה בהצלחה!");
            setReviewProject(null);
            setReviewNotes("");
            loadProjects();
        } catch {
            toast.error("שגיאה בשליחת ההערות");
        } finally {
            setSending(false);
        }
    };

    const handleApprove = async (project: Project) => {
        if (!confirm("האם לאשר את הפרויקט?")) return;
        try {
            const res = await fetch(`/api/projects/${project.id}/approve`, {
                method: "POST",
            });
            if (!res.ok) throw new Error();
            toast.success("הפרויקט אושר בהצלחה!");
            loadProjects();
        } catch {
            toast.error("שגיאה באישור הפרויקט");
        }
    };

    const handleReject = async (project: Project) => {
        if (!confirm("האם לדחות את הפרויקט?")) return;
        try {
            const res = await fetch(`/api/projects/${project.id}/reject`, {
                method: "POST",
            });
            if (!res.ok) throw new Error();
            toast.success("הפרויקט נדחה");
            loadProjects();
        } catch {
            toast.error("שגיאה בדחיית הפרויקט");
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <h1 className="text-2xl font-bold">הצעות ממתינות</h1>
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-48 w-full" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">הצעות ממתינות</h1>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                    {projects.length}
                </Badge>
            </div>

            {projects.length === 0 && (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        אין הצעות ממתינות כרגע
                    </CardContent>
                </Card>
            )}

            {projects.map((project) => (
                <Card key={project.id} className="overflow-hidden">
                    <CardHeader
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setExpandedId(expandedId === project.id ? null : project.id)}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1 flex-1">
                                <CardTitle className="text-lg">{project.title_he}</CardTitle>
                                <p className="text-sm text-muted-foreground" dir="ltr">
                                    {project.title_en}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge>{TRACKS[project.track as TrackId]?.label}</Badge>
                                    <Badge variant={project.status === "review" ? "destructive" : "secondary"}>
                                        {project.status === "review" ? "ממתין לתיקון" : "ממתין לבדיקה"}
                                    </Badge>
                                </div>
                            </div>
                            <span className="text-muted-foreground text-sm">
                                {new Date(project.created_at).toLocaleDateString("he-IL")}
                            </span>
                        </div>
                    </CardHeader>

                    {expandedId === project.id && (
                        <CardContent className="border-t space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InfoField label="מנחה" value={project.supervisors_name} />
                                <InfoField label="אימייל מנחה" value={project.supervisors_email} dir="ltr" />
                                <InfoField label="אחראי.ת אקדמי.ת" value={project.academic_supervisor_name} />
                                <InfoField label="אימייל אקדמי.ת" value={project.academic_supervisor_email} dir="ltr" />
                            </div>
                            <Separator />
                            <InfoField label="תקציר" value={project.abstract} />
                            <InfoField label="מטרה" value={project.objective} />
                            <InfoField label="תכולה" value={project.scope} />
                            {project.prereq_course_1 && (
                                <InfoField label="קורס קדם #1" value={project.prereq_course_1} />
                            )}
                            {project.prereq_course_2 && (
                                <InfoField label="קורס קדם #2" value={project.prereq_course_2} />
                            )}
                            <InfoField label="מקורות" value={project.references_text} />

                            {project.review_notes && (
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
                                    <p className="text-sm font-medium mb-1">הערות שנשלחו:</p>
                                    <p className="text-sm whitespace-pre-wrap">{project.review_notes}</p>
                                </div>
                            )}

                            <Separator />
                            <div className="flex flex-wrap gap-3">
                                <Button onClick={() => handleApprove(project)} className="bg-green-600 hover:bg-green-700">
                                    ✅ אישור פרויקט
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setReviewProject(project);
                                        setReviewNotes(project.review_notes || "");
                                    }}
                                >
                                    📝 שליחת הערות
                                </Button>
                                <Button variant="destructive" onClick={() => handleReject(project)}>
                                    ❌ דחייה
                                </Button>
                            </div>
                        </CardContent>
                    )}
                </Card>
            ))}

            {/* Review Notes Dialog */}
            <Dialog open={!!reviewProject} onOpenChange={() => setReviewProject(null)}>
                <DialogContent className="max-w-lg" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>הערות לתיקון</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        ההערות יישלחו למנחה עם קישור לעריכה ושליחה מחדש של ההצעה.
                    </p>
                    <Textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="כתבו כאן את ההערות..."
                        rows={6}
                    />
                    <DialogFooter>
                        <Button onClick={() => setReviewProject(null)} variant="outline">
                            ביטול
                        </Button>
                        <Button onClick={handleSendReview} disabled={sending || !reviewNotes.trim()}>
                            {sending ? "שולח..." : "שליחת הערות"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function InfoField({ label, value, dir }: { label: string; value: string; dir?: string }) {
    return (
        <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-sm mt-1 whitespace-pre-wrap" dir={dir}>
                {value}
            </p>
        </div>
    );
}

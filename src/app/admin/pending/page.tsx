"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { Project } from "@/lib/constants";
import { TRACKS, TRACK_LIST, normalizeTrack, type TrackId } from "@/lib/constants";
import { useAdminYear } from "@/app/admin/year-context";

export default function PendingProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [reviewProject, setReviewProject] = useState<Project | null>(null);
    const [reviewNotes, setReviewNotes] = useState("");
    const [sending, setSending] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editProject, setEditProject] = useState<Project | null>(null);
    const [editData, setEditData] = useState<Partial<Project>>({});
    const [saving, setSaving] = useState(false);

    const { selectedYear } = useAdminYear();
    const supabase = createSupabaseBrowserClient();

    const loadProjects = useCallback(async () => {
        let query = supabase
            .from("projects")
            .select("*")
            .in("status", ["pending", "review"])
            .order("created_at", { ascending: false });
        if (selectedYear) {
            query = query.eq("academic_year_id", selectedYear.id);
        }
        const { data } = await query;
        setProjects((data as Project[]) || []);
        setLoading(false);
    }, [selectedYear, supabase]);

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

    const handleSaveEdit = async () => {
        if (!editProject) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/projects/${editProject.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editData),
            });
            if (!res.ok) throw new Error();
            toast.success("השינויים נשמרו");
            setEditProject(null);
            loadProjects();
        } catch {
            toast.error("שגיאה בשמירה");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (project: Project) => {
        if (!confirm(`למחוק את הפרויקט "${project.title_he}"?\nפעולה זו תמחק גם את כל ההרשמות לפרויקט.`)) return;
        try {
            const res = await fetch(`/api/admin/projects/${project.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            toast.success("הפרויקט נמחק");
            loadProjects();
        } catch {
            toast.error("שגיאה במחיקה");
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <h1 className="text-xl sm:text-2xl font-bold">הצעות ממתינות</h1>
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
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                            <div className="space-y-1 flex-1">
                                <CardTitle className="text-lg">{project.title_he}</CardTitle>
                                <p className="text-sm text-muted-foreground" dir="ltr">
                                    {project.title_en}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge>{TRACKS[normalizeTrack(project.track)]?.label}</Badge>
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
                                <Button
                                    variant="outline"
                                    onClick={() => { setEditProject(project); setEditData(project); }}
                                >
                                    ✏️ עריכה
                                </Button>
                                <Button variant="destructive" onClick={() => handleReject(project)}>
                                    ❌ דחייה
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => handleDelete(project)}
                                >
                                    🗑️ מחיקה
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

            {/* Edit Project Dialog */}
            <Dialog open={!!editProject} onOpenChange={() => setEditProject(null)}>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>עריכת פרויקט</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>שם הפרויקט (עברית)</Label>
                            <Input value={editData.title_he || ""} onChange={(e) => setEditData({ ...editData, title_he: e.target.value })} />
                        </div>
                        <div>
                            <Label>Project Title</Label>
                            <Input value={editData.title_en || ""} onChange={(e) => setEditData({ ...editData, title_en: e.target.value })} dir="ltr" />
                        </div>
                        <div>
                            <Label>אשכול</Label>
                            <Select value={editData.track ? normalizeTrack(editData.track) : ""} onValueChange={(v) => setEditData({ ...editData, track: v as TrackId })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {TRACK_LIST.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>מומלץ גם לאשכול</Label>
                            <Select value={editData.recommended_track ? normalizeTrack(editData.recommended_track) : "none"} onValueChange={(v) => setEditData({ ...editData, recommended_track: v === "none" ? null : v as TrackId })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">—</SelectItem>
                                    {TRACK_LIST.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>סטטוס</Label>
                            <Select value={editData.status || ""} onValueChange={(v) => setEditData({ ...editData, status: v as Project["status"] })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">pending</SelectItem>
                                    <SelectItem value="review">review</SelectItem>
                                    <SelectItem value="approved">approved</SelectItem>
                                    <SelectItem value="rejected">rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>מספר פרויקט</Label>
                            <Input value={String(editData.project_number || "")} onChange={(e) => setEditData({ ...editData, project_number: e.target.value ? parseInt(e.target.value) : null })} />
                        </div>
                        <div>
                            <Label>מנחה</Label>
                            <Input value={editData.supervisors_name || ""} onChange={(e) => setEditData({ ...editData, supervisors_name: e.target.value })} />
                        </div>
                        <div>
                            <Label>אימייל מנחה</Label>
                            <Input value={editData.supervisors_email || ""} onChange={(e) => setEditData({ ...editData, supervisors_email: e.target.value })} dir="ltr" />
                        </div>
                        <div>
                            <Label>אחראי.ת אקדמי.ת</Label>
                            <Input value={editData.academic_supervisor_name || ""} onChange={(e) => setEditData({ ...editData, academic_supervisor_name: e.target.value })} />
                        </div>
                        <div>
                            <Label>אימייל אקדמי.ת</Label>
                            <Input value={editData.academic_supervisor_email || ""} onChange={(e) => setEditData({ ...editData, academic_supervisor_email: e.target.value })} dir="ltr" />
                        </div>
                        <div>
                            <Label>תקציר</Label>
                            <Textarea value={editData.abstract || ""} onChange={(e) => setEditData({ ...editData, abstract: e.target.value })} rows={3} />
                        </div>
                        <div>
                            <Label>מטרה</Label>
                            <Textarea value={editData.objective || ""} onChange={(e) => setEditData({ ...editData, objective: e.target.value })} rows={3} />
                        </div>
                        <div>
                            <Label>תכולה</Label>
                            <Textarea value={editData.scope || ""} onChange={(e) => setEditData({ ...editData, scope: e.target.value })} rows={3} />
                        </div>
                        <div>
                            <Label>קורס קדם #1</Label>
                            <Input value={editData.prereq_course_1 || ""} onChange={(e) => setEditData({ ...editData, prereq_course_1: e.target.value })} />
                        </div>
                        <div>
                            <Label>קורס קדם #2</Label>
                            <Input value={editData.prereq_course_2 || ""} onChange={(e) => setEditData({ ...editData, prereq_course_2: e.target.value })} />
                        </div>
                        <div>
                            <Label>מקורות</Label>
                            <Textarea value={editData.references_text || ""} onChange={(e) => setEditData({ ...editData, references_text: e.target.value })} rows={3} />
                        </div>
                        <div>
                            <Label>הערות תיקון</Label>
                            <Textarea value={editData.review_notes || ""} onChange={(e) => setEditData({ ...editData, review_notes: e.target.value })} rows={2} />
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="pending_edit_is_taken"
                                checked={!!editData.is_taken}
                                onCheckedChange={(checked) => setEditData({ ...editData, is_taken: !!checked })}
                            />
                            <Label htmlFor="pending_edit_is_taken">פרויקט אויש</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditProject(null)}>ביטול</Button>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                            {saving ? "שומר..." : "שמירת שינויים"}
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

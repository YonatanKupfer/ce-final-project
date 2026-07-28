"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type { Project, ProjectShare } from "@/lib/constants";
import {
    REQUIRED_COURSES,
    TRACKS,
    TRACK_LIST,
    normalizeTrack,
    requiredCourseLabel,
    type TrackId,
} from "@/lib/constants";
import { useAdminYear } from "@/app/admin/year-context";

const DEV_ADMIN = process.env.NEXT_PUBLIC_DEV_ADMIN === "true";

export default function AdminProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [trackFilter, setTrackFilter] = useState<string>("all");
    const [editProject, setEditProject] = useState<Project | null>(null);
    const [editData, setEditData] = useState<Partial<Project>>({});
    const [saving, setSaving] = useState(false);
    const [adminEmail, setAdminEmail] = useState("");
    const [shares, setShares] = useState<ProjectShare[]>([]);
    const [loadingShares, setLoadingShares] = useState(false);
    const [shareRecipients, setShareRecipients] = useState([{ email: "", name: "" }]);
    const [shareNote, setShareNote] = useState("");
    const [sendingShare, setSendingShare] = useState(false);
    const [deletingShareId, setDeletingShareId] = useState<string | null>(null);

    const { selectedYear } = useAdminYear();
    const supabase = createSupabaseBrowserClient();
    const isArchivedYear = selectedYear ? !selectedYear.is_active : false;
    const [carryingOverId, setCarryingOverId] = useState<string | null>(null);

    useEffect(() => {
        if (DEV_ADMIN) {
            setAdminEmail("dev@local");
            return;
        }
        supabase.auth.getUser().then(({ data }) => {
            if (data.user?.email) setAdminEmail(data.user.email);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadShares = useCallback(async (projectId: string) => {
        setLoadingShares(true);
        try {
            const res = await fetch(`/api/admin/projects/${projectId}/shares`);
            const data = await res.json();
            setShares(data.shares || []);
        } catch {
            setShares([]);
        } finally {
            setLoadingShares(false);
        }
    }, []);

    useEffect(() => {
        if (editProject) {
            loadShares(editProject.id);
            setShareRecipients([{ email: "", name: "" }]);
            setShareNote("");
        } else {
            setShares([]);
        }
    }, [editProject, loadShares]);

    const handleSendShare = async () => {
        if (!editProject) return;
        const recipients = shareRecipients
            .map((r) => ({ email: r.email.trim(), name: r.name.trim() }))
            .filter((r) => r.email);
        if (recipients.length === 0) return;
        setSendingShare(true);
        try {
            const res = await fetch(`/api/admin/projects/${editProject.id}/share`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recipients, admin_note: shareNote, created_by_email: adminEmail }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success("הפרויקט שותף בהצלחה");
            setShareRecipients([{ email: "", name: "" }]);
            setShareNote("");
            loadShares(editProject.id);
        } catch (err: unknown) {
            toast.error((err as Error).message || "שגיאה בשיתוף הפרויקט");
        } finally {
            setSendingShare(false);
        }
    };

    const handleDeleteShare = async (share: ProjectShare) => {
        if (!editProject) return;
        if (!confirm("למחוק את השרשור? כל ההערות בו יימחקו לצמיתות.")) return;
        setDeletingShareId(share.id);
        try {
            const res = await fetch(`/api/admin/projects/${editProject.id}/shares/${share.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            toast.success("השרשור נמחק");
            loadShares(editProject.id);
        } catch {
            toast.error("שגיאה במחיקת השרשור");
        } finally {
            setDeletingShareId(null);
        }
    };

    const loadProjects = useCallback(async () => {
        let query = supabase
            .from("projects")
            .select("*")
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

    const filtered = projects.filter((p) => {
        const matchesSearch =
            !search ||
            p.title_he.includes(search) ||
            p.title_en.toLowerCase().includes(search.toLowerCase()) ||
            p.supervisors_name.includes(search) ||
            (p.project_number && p.project_number.toString().includes(search));
        const matchesTrack = trackFilter === "all" || normalizeTrack(p.track) === trackFilter;
        return matchesSearch && matchesTrack;
    });

    const statusColors: Record<string, string> = {
        pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
        review: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
        approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
        rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    };

    const handleSave = async () => {
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

    const handleCarryOver = async (project: Project) => {
        if (!confirm(`להעביר את "${project.title_he}" לשנה הפעילה?`)) return;
        setCarryingOverId(project.id);
        try {
            const res = await fetch(`/api/admin/projects/${project.id}/carry-over`, { method: "POST" });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            toast.success("הפרויקט הועבר לשנה הפעילה");
        } catch (err: unknown) {
            toast.error((err as Error).message || "שגיאה בהעברה");
        } finally {
            setCarryingOverId(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <h1 className="text-xl sm:text-2xl font-bold">כל הפרויקטים</h1>
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">כל הפרויקטים</h1>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <Input
                    placeholder="חיפוש..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full sm:max-w-xs"
                />
                <Select value={trackFilter} onValueChange={(v) => setTrackFilter(v ?? "all")}>
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[220px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="w-auto min-w-[var(--anchor-width)]">
                        <SelectItem value="all">כל האשכולות</SelectItem>
                        {TRACK_LIST.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Badge variant="secondary" className="px-3 py-2">{filtered.length} פרויקטים</Badge>
            </div>

            {/* Mobile card layout */}
            <div className="md:hidden space-y-4">
                {filtered.map((p) => (
                    <Card key={p.id} className={p.is_taken ? "border-red-200 dark:border-red-800" : ""}>
                        <CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-mono font-bold">{p.project_number || "—"}</span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-1 rounded-full ${statusColors[p.status] || ""}`}>
                                        {p.status}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setEditProject(p); setEditData(p); }}
                                    >
                                        ✏️
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => handleDelete(p)}
                                    >
                                        🗑️
                                    </Button>
                                </div>
                            </div>
                            <div className="font-medium">{p.title_he}</div>
                            <div className="text-xs text-muted-foreground" dir="ltr">{p.title_en}</div>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">{TRACKS[normalizeTrack(p.track)]?.label}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">{p.supervisors_name}</div>
                            <div className="text-xs text-muted-foreground">
                                {new Date(p.created_at).toLocaleDateString("he-IL")}
                            </div>
                            {isArchivedYear && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full text-xs"
                                    disabled={carryingOverId === p.id}
                                    onClick={() => handleCarryOver(p)}
                                >
                                    {carryingOverId === p.id ? "מעביר..." : "↗ העבר לשנה הפעילה"}
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Desktop table layout */}
            <div className="hidden md:block rounded-lg border overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-16">מס׳</TableHead>
                            <TableHead>שם הפרויקט</TableHead>
                            <TableHead>אשכול</TableHead>
                            <TableHead>מנחה</TableHead>
                            <TableHead>סטטוס</TableHead>
                            <TableHead>תאריך</TableHead>
                            <TableHead className="w-20">פעולות</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.map((p) => (
                            <TableRow
                                key={p.id}
                                className={p.is_taken ? "bg-red-50 dark:bg-red-900/10" : ""}
                            >
                                <TableCell className="font-mono font-bold">
                                    {p.project_number || "—"}
                                </TableCell>
                                <TableCell>
                                    <div className="font-medium">{p.title_he}</div>
                                    <div className="text-xs text-muted-foreground" dir="ltr">{p.title_en}</div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">{TRACKS[normalizeTrack(p.track)]?.label}</Badge>
                                </TableCell>
                                <TableCell className="text-sm">{p.supervisors_name}</TableCell>
                                <TableCell>
                                    <span className={`text-xs px-2 py-1 rounded-full ${statusColors[p.status] || ""}`}>
                                        {p.status}
                                    </span>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {new Date(p.created_at).toLocaleDateString("he-IL")}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setEditProject(p);
                                                setEditData(p);
                                            }}
                                        >
                                            ✏️
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(p)}
                                        >
                                            🗑️
                                        </Button>
                                        {isArchivedYear && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                title="העבר לשנה הפעילה"
                                                disabled={carryingOverId === p.id}
                                                onClick={() => handleCarryOver(p)}
                                            >
                                                {carryingOverId === p.id ? "..." : "↗"}
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editProject} onOpenChange={() => setEditProject(null)}>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>עריכת פרויקט</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <EditField label="שם הפרויקט (עברית)" value={editData.title_he || ""} onChange={(v) => setEditData({ ...editData, title_he: v })} />
                        <EditField label="Project Title" value={editData.title_en || ""} onChange={(v) => setEditData({ ...editData, title_en: v })} dir="ltr" />
                        <div>
                            <Label>אשכול</Label>
                            <Select value={editData.track ? normalizeTrack(editData.track) : ""} onValueChange={(v) => setEditData({ ...editData, track: v as TrackId })}>
                                <SelectTrigger className="w-full">
                                    <span data-slot="select-value" className="flex flex-1">
                                        {editData.track
                                            ? TRACKS[normalizeTrack(editData.track)]?.label
                                            : <span className="text-muted-foreground">בחר אשכול</span>}
                                    </span>
                                </SelectTrigger>
                                <SelectContent className="min-w-[var(--anchor-width)]">
                                    {TRACK_LIST.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>סטטוס</Label>
                            <Select value={editData.status || ""} onValueChange={(v) => setEditData({ ...editData, status: v as Project["status"] })}>
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">pending</SelectItem>
                                    <SelectItem value="review">review</SelectItem>
                                    <SelectItem value="approved">approved</SelectItem>
                                    <SelectItem value="rejected">rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <EditField label="מספר פרויקט" value={String(editData.project_number || "")} onChange={(v) => setEditData({ ...editData, project_number: v ? parseInt(v) : null })} />
                        <EditField label="מנחה" value={editData.supervisors_name || ""} onChange={(v) => setEditData({ ...editData, supervisors_name: v })} />
                        <EditField label="אימייל מנחה" value={editData.supervisors_email || ""} onChange={(v) => setEditData({ ...editData, supervisors_email: v })} dir="ltr" />
                        <EditField label="אחראי.ת אקדמי.ת" value={editData.academic_supervisor_name || ""} onChange={(v) => setEditData({ ...editData, academic_supervisor_name: v })} />
                        <EditField label="אימייל אקדמי.ת" value={editData.academic_supervisor_email || ""} onChange={(v) => setEditData({ ...editData, academic_supervisor_email: v })} dir="ltr" />
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
                            <Label>מומלץ גם לאשכול</Label>
                            <Select value={editData.recommended_track ? normalizeTrack(editData.recommended_track) : "none"} onValueChange={(v) => setEditData({ ...editData, recommended_track: v === "none" ? null : v as TrackId })}>
                                <SelectTrigger className="w-full">
                                    <span data-slot="select-value" className="flex flex-1">
                                        {editData.recommended_track
                                            ? TRACKS[normalizeTrack(editData.recommended_track)]?.label
                                            : "—"}
                                    </span>
                                </SelectTrigger>
                                <SelectContent className="min-w-[var(--anchor-width)]">
                                    <SelectItem value="none">—</SelectItem>
                                    {TRACK_LIST.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <RequiredCourseEditSelect
                            label="קורס חובה רלוונטי #1"
                            value={editData.relevant_required_course_1 || ""}
                            onChange={(value) => setEditData({ ...editData, relevant_required_course_1: value })}
                        />
                        <RequiredCourseEditSelect
                            label="קורס חובה רלוונטי #2"
                            value={editData.relevant_required_course_2 || ""}
                            onChange={(value) => setEditData({ ...editData, relevant_required_course_2: value })}
                        />
                        <EditField label="קורס קדם #1" value={editData.prereq_course_1 || ""} onChange={(v) => setEditData({ ...editData, prereq_course_1: v })} />
                        <EditField label="קורס קדם #2" value={editData.prereq_course_2 || ""} onChange={(v) => setEditData({ ...editData, prereq_course_2: v })} />
                        <div>
                            <Label>מקורות</Label>
                            <Textarea value={editData.references_text || ""} onChange={(e) => setEditData({ ...editData, references_text: e.target.value })} rows={3} />
                        </div>
                        <div className="rounded-lg border border-dashed p-3 space-y-2 bg-muted/30">
                            <Label className="flex items-center gap-2">
                                מורכבות הנדסית מול כלי AI
                                <span className="text-[10px] font-normal text-muted-foreground bg-background border px-1.5 py-0.5 rounded-full">גלוי לניהול בלבד</span>
                            </Label>
                            <Textarea value={editData.ai_complexity_justification || ""} onChange={(e) => setEditData({ ...editData, ai_complexity_justification: e.target.value })} rows={3} />
                        </div>
                        <div>
                            <Label>הערות תיקון</Label>
                            <Textarea value={editData.review_notes || ""} onChange={(e) => setEditData({ ...editData, review_notes: e.target.value })} rows={2} />
                        </div>
                        <div className="rounded-lg border border-dashed p-3 space-y-3 bg-muted/30">
                            <Label>שיתוף עם גורם חיצוני</Label>
                            <div className="space-y-2">
                                {shareRecipients.map((r, i) => (
                                    <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                                        <Input
                                            placeholder="אימייל הנמען"
                                            value={r.email}
                                            onChange={(e) => {
                                                const next = [...shareRecipients];
                                                next[i] = { ...next[i], email: e.target.value };
                                                setShareRecipients(next);
                                            }}
                                            dir="ltr"
                                        />
                                        <Input
                                            placeholder="שם הנמען (אופציונלי)"
                                            value={r.name}
                                            onChange={(e) => {
                                                const next = [...shareRecipients];
                                                next[i] = { ...next[i], name: e.target.value };
                                                setShareRecipients(next);
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive"
                                            disabled={shareRecipients.length === 1}
                                            onClick={() => setShareRecipients(shareRecipients.filter((_, idx) => idx !== i))}
                                        >
                                            ✕
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShareRecipients([...shareRecipients, { email: "", name: "" }])}
                                >
                                    + הוספת נמען
                                </Button>
                            </div>
                            <Textarea
                                placeholder="הערה לנמענים (אופציונלי)"
                                value={shareNote}
                                onChange={(e) => setShareNote(e.target.value)}
                                rows={2}
                            />
                            <Button
                                size="sm"
                                onClick={handleSendShare}
                                disabled={sendingShare || !shareRecipients.some((r) => r.email.trim())}
                            >
                                {sendingShare ? "שולח..." : "שליחה לגורם חיצוני"}
                            </Button>

                            {loadingShares ? (
                                <p className="text-sm text-muted-foreground">טוען שיתופים...</p>
                            ) : shares.length > 0 && (
                                <div className="space-y-2 pt-2 border-t">
                                    {shares.map((share) => (
                                        <div key={share.id} className="bg-background rounded-lg border p-2 space-y-1">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium">
                                                    {(share.recipients ?? []).map((r) => r.name || r.email).join(", ") || "—"}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(share.created_at).toLocaleDateString("he-IL")}
                                                    </span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive hover:text-destructive h-6 px-2"
                                                        disabled={deletingShareId === share.id}
                                                        onClick={() => handleDeleteShare(share)}
                                                    >
                                                        🗑️
                                                    </Button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground" dir="ltr">
                                                {(share.recipients ?? []).map((r) => r.email).join(", ")}
                                            </p>
                                            {(share.comments?.length ?? 0) > 0 ? (
                                                <div className="space-y-1 pt-1">
                                                    {share.comments!.map((c) => (
                                                        <div key={c.id} className="bg-muted/50 rounded p-2 text-sm">
                                                            <div className="flex items-center justify-between mb-0.5">
                                                                <span className="text-xs font-medium">{c.author_label}</span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {new Date(c.created_at).toLocaleString("he-IL")}
                                                                </span>
                                                            </div>
                                                            <p className="whitespace-pre-wrap">{c.comment_text}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">אין תגובות עדיין</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="edit_is_taken"
                                checked={!!editData.is_taken}
                                onCheckedChange={(checked) => setEditData({ ...editData, is_taken: !!checked })}
                            />
                            <Label htmlFor="edit_is_taken">פרויקט אויש</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditProject(null)}>ביטול</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "שומר..." : "שמירת שינויים"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function RequiredCourseEditSelect({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div>
            <Label>{label}</Label>
            <Select value={value || "none"} onValueChange={(nextValue) => onChange(nextValue && nextValue !== "none" ? nextValue : "")}>
                <SelectTrigger className="w-full">
                    <span data-slot="select-value" className="flex flex-1 text-right">
                        {value || <span className="text-muted-foreground">—</span>}
                    </span>
                </SelectTrigger>
                <SelectContent className="w-auto min-w-[var(--anchor-width)] max-w-[min(42rem,calc(100vw-2rem))]">
                    <SelectItem value="none">—</SelectItem>
                    {REQUIRED_COURSES.map((course) => {
                        const optionLabel = requiredCourseLabel(course);
                        return (
                            <SelectItem key={course.id} value={optionLabel}>
                                <span className="font-mono me-2">{course.id}</span>
                                {course.name}
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
        </div>
    );
}

function EditField({ label, value, onChange, dir }: { label: string; value: string; onChange: (v: string) => void; dir?: string }) {
    return (
        <div>
            <Label>{label}</Label>
            <Input value={value} onChange={(e) => onChange(e.target.value)} dir={dir} />
        </div>
    );
}

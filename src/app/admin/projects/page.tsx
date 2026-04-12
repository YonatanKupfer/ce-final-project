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
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type { Project } from "@/lib/constants";
import { TRACKS, TRACK_LIST, type TrackId } from "@/lib/constants";

export default function AdminProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [trackFilter, setTrackFilter] = useState<string>("all");
    const [editProject, setEditProject] = useState<Project | null>(null);
    const [editData, setEditData] = useState<Partial<Project>>({});
    const [saving, setSaving] = useState(false);

    const supabase = createSupabaseBrowserClient();

    const loadProjects = useCallback(async () => {
        const { data } = await supabase
            .from("projects")
            .select("*")
            .order("created_at", { ascending: false });
        setProjects((data as Project[]) || []);
        setLoading(false);
    }, []);

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
        const matchesTrack = trackFilter === "all" || p.track === trackFilter;
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

    if (loading) {
        return (
            <div className="space-y-4">
                <h1 className="text-2xl font-bold">כל הפרויקטים</h1>
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
                    className="max-w-xs"
                />
                <Select value={trackFilter} onValueChange={(v) => setTrackFilter(v ?? "all")}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">כל השרשראות</SelectItem>
                        {TRACK_LIST.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Badge variant="secondary" className="px-3 py-2">{filtered.length} פרויקטים</Badge>
            </div>

            {/* Table */}
            <div className="rounded-lg border overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-16">מס׳</TableHead>
                            <TableHead>שם הפרויקט</TableHead>
                            <TableHead>שרשרת</TableHead>
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
                                    <Badge variant="outline">{TRACKS[p.track as TrackId]?.label}</Badge>
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
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editProject} onOpenChange={() => setEditProject(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>עריכת פרויקט</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <EditField label="שם הפרויקט (עברית)" value={editData.title_he || ""} onChange={(v) => setEditData({ ...editData, title_he: v })} />
                        <EditField label="Project Title" value={editData.title_en || ""} onChange={(v) => setEditData({ ...editData, title_en: v })} dir="ltr" />
                        <div>
                            <Label>שרשרת</Label>
                            <Select value={editData.track || ""} onValueChange={(v) => setEditData({ ...editData, track: v as TrackId })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
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

function EditField({ label, value, onChange, dir }: { label: string; value: string; onChange: (v: string) => void; dir?: string }) {
    return (
        <div>
            <Label>{label}</Label>
            <Input value={value} onChange={(e) => onChange(e.target.value)} dir={dir} />
        </div>
    );
}

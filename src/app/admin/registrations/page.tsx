"use client";

import { useEffect, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { Registration } from "@/lib/constants";

export default function AdminRegistrationsPage() {
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [editReg, setEditReg] = useState<Registration | null>(null);
    const [editData, setEditData] = useState<Partial<Registration>>({});
    const [saving, setSaving] = useState(false);

    const supabase = createSupabaseBrowserClient();

    const loadRegistrations = useCallback(async () => {
        const { data } = await supabase
            .from("registrations")
            .select("*, project:projects(*)")
            .order("created_at", { ascending: false });
        setRegistrations((data as Registration[]) || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadRegistrations();
    }, [loadRegistrations]);

    const filtered = registrations.filter((r) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            r.student1_name.toLowerCase().includes(s) ||
            r.student1_id.includes(s) ||
            (r.student2_name && r.student2_name.toLowerCase().includes(s)) ||
            (r.project?.title_he || "").includes(search) ||
            (r.project?.title_en || "").toLowerCase().includes(s)
        );
    });

    const statusColors: Record<string, string> = {
        pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
        approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
        rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    };

    const handleSave = async () => {
        if (!editReg) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/registrations/${editReg.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editData),
            });
            if (!res.ok) throw new Error();
            toast.success("השינויים נשמרו");
            setEditReg(null);
            loadRegistrations();
        } catch {
            toast.error("שגיאה בשמירה");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <h1 className="text-2xl font-bold">הרשמות</h1>
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">הרשמות</h1>

            <div className="flex flex-wrap gap-3">
                <Input
                    placeholder="חיפוש..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-xs"
                />
                <Badge variant="secondary" className="px-3 py-2">{filtered.length} הרשמות</Badge>
            </div>

            <div className="rounded-lg border overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>פרויקט</TableHead>
                            <TableHead>סטודנט 1</TableHead>
                            <TableHead>סטודנט 2</TableHead>
                            <TableHead>סטטוס</TableHead>
                            <TableHead>תאריך</TableHead>
                            <TableHead className="w-20">פעולות</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell>
                                    <div className="font-medium text-sm">
                                        {r.project?.project_number && <span className="font-mono me-1">#{r.project.project_number}</span>}
                                        {r.project?.title_he || "—"}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="text-sm">{r.student1_name}</div>
                                    <div className="text-xs text-muted-foreground">{r.student1_id}</div>
                                </TableCell>
                                <TableCell>
                                    {r.student2_name ? (
                                        <>
                                            <div className="text-sm">{r.student2_name}</div>
                                            <div className="text-xs text-muted-foreground">{r.student2_id}</div>
                                        </>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <span className={`text-xs px-2 py-1 rounded-full ${statusColors[r.status] || ""}`}>
                                        {r.status}
                                    </span>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {new Date(r.created_at).toLocaleDateString("he-IL")}
                                </TableCell>
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setEditReg(r);
                                            setEditData(r);
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
            <Dialog open={!!editReg} onOpenChange={() => setEditReg(null)}>
                <DialogContent className="max-w-lg" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>עריכת הרשמה</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>סטטוס</Label>
                            <Select value={editData.status || ""} onValueChange={(v) => setEditData({ ...editData, status: v as Registration["status"] })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">pending</SelectItem>
                                    <SelectItem value="approved">approved</SelectItem>
                                    <SelectItem value="rejected">rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>שם סטודנט 1</Label>
                            <Input value={editData.student1_name || ""} onChange={(e) => setEditData({ ...editData, student1_name: e.target.value })} />
                        </div>
                        <div>
                            <Label>ת״ז סטודנט 1</Label>
                            <Input value={editData.student1_id || ""} onChange={(e) => setEditData({ ...editData, student1_id: e.target.value })} />
                        </div>
                        <div>
                            <Label>מייל סטודנט 1</Label>
                            <Input value={editData.student1_email || ""} onChange={(e) => setEditData({ ...editData, student1_email: e.target.value })} dir="ltr" />
                        </div>
                        <div>
                            <Label>שם סטודנט 2</Label>
                            <Input value={editData.student2_name || ""} onChange={(e) => setEditData({ ...editData, student2_name: e.target.value })} />
                        </div>
                        <div>
                            <Label>ת״ז סטודנט 2</Label>
                            <Input value={editData.student2_id || ""} onChange={(e) => setEditData({ ...editData, student2_id: e.target.value })} />
                        </div>
                        <div>
                            <Label>מייל סטודנט 2</Label>
                            <Input value={editData.student2_email || ""} onChange={(e) => setEditData({ ...editData, student2_email: e.target.value })} dir="ltr" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditReg(null)}>ביטול</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "שומר..." : "שמירת שינויים"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

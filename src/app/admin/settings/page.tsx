"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useAdminYear } from "@/app/admin/year-context";
import type { AcademicYear } from "@/lib/constants";

export default function AdminSettingsPage() {
    const { years, refreshYears } = useAdminYear();
    const [showCreate, setShowCreate] = useState(false);
    const [newSlug, setNewSlug] = useState("");
    const [newLabelEn, setNewLabelEn] = useState("");
    const [newLabelHe, setNewLabelHe] = useState("");
    const [creating, setCreating] = useState(false);
    const [activating, setActivating] = useState<string | null>(null);
    const [carryingOver, setCarryingOver] = useState<string | null>(null);

    const handleCreate = async () => {
        if (!newSlug.trim() || !newLabelEn.trim() || !newLabelHe.trim()) {
            toast.error("כל השדות נדרשים");
            return;
        }
        setCreating(true);
        try {
            const res = await fetch("/api/admin/academic-years", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug: newSlug.trim(), label_en: newLabelEn.trim(), label_he: newLabelHe.trim() }),
            });
            if (!res.ok) {
                const { error } = await res.json();
                throw new Error(error);
            }
            toast.success("שנה אקדמית נוצרה בהצלחה");
            setShowCreate(false);
            setNewSlug("");
            setNewLabelEn("");
            setNewLabelHe("");
            await refreshYears();
        } catch (err: unknown) {
            toast.error((err as Error).message || "שגיאה ביצירת השנה");
        } finally {
            setCreating(false);
        }
    };

    const handleSetActive = async (year: AcademicYear) => {
        if (!confirm(`להגדיר את "${year.label_he} / ${year.label_en}" כשנה הפעילה?`)) return;
        setActivating(year.id);
        try {
            const res = await fetch(`/api/admin/academic-years/${year.id}`, {
                method: "PUT",
            });
            if (!res.ok) {
                const { error } = await res.json();
                throw new Error(error);
            }
            toast.success(`${year.label_he} הוגדרה כשנה הפעילה`);
            await refreshYears();
        } catch (err: unknown) {
            toast.error((err as Error).message || "שגיאה בהגדרת השנה");
        } finally {
            setActivating(null);
        }
    };

    const handleCarryOver = async (year: AcademicYear) => {
        const activeYear = years.find((y) => y.is_active);
        if (!activeYear) {
            toast.error("אין שנה פעילה");
            return;
        }
        if (!confirm(`להעביר פרויקטים מאושרים ופנויים מ-${year.label_he} לשנה הפעילה (${activeYear.label_he})?`)) return;
        setCarryingOver(year.id);
        try {
            const res = await fetch(`/api/admin/academic-years/${year.id}/carry-over`, {
                method: "POST",
            });
            if (!res.ok) {
                const { error } = await res.json();
                throw new Error(error);
            }
            const { count } = await res.json();
            toast.success(`${count} פרויקטים הועברו לשנה ${activeYear.label_he}`);
        } catch (err: unknown) {
            toast.error((err as Error).message || "שגיאה בהעברת פרויקטים");
        } finally {
            setCarryingOver(null);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">הגדרות — שנים אקדמיות</h1>
                <Button onClick={() => setShowCreate((v) => !v)} variant="outline">
                    {showCreate ? "ביטול" : "+ שנה חדשה"}
                </Button>
            </div>

            {showCreate && (
                <Card>
                    <CardHeader>
                        <CardTitle>יצירת שנה אקדמית חדשה</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <Label>קוד שנה (slug)</Label>
                                <Input
                                    placeholder="2627"
                                    value={newSlug}
                                    onChange={(e) => setNewSlug(e.target.value)}
                                    dir="ltr"
                                />
                                <p className="text-xs text-muted-foreground">מזהה קצר ללא רווחים, למשל 2627</p>
                            </div>
                            <div className="space-y-1">
                                <Label>תווית אנגלית</Label>
                                <Input
                                    placeholder="2026-2027"
                                    value={newLabelEn}
                                    onChange={(e) => setNewLabelEn(e.target.value)}
                                    dir="ltr"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label>תווית עברית</Label>
                                <Input
                                    placeholder='תשפ"ז'
                                    value={newLabelHe}
                                    onChange={(e) => setNewLabelHe(e.target.value)}
                                />
                            </div>
                        </div>
                        <Button onClick={handleCreate} disabled={creating}>
                            {creating ? "יוצר..." : "יצירה"}
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Separator />

            {/* Desktop table */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>קוד</TableHead>
                            <TableHead>תווית</TableHead>
                            <TableHead>עברית</TableHead>
                            <TableHead>סטטוס</TableHead>
                            <TableHead>פעולות</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {years.map((year) => (
                            <TableRow key={year.id}>
                                <TableCell className="font-mono">{year.slug}</TableCell>
                                <TableCell dir="ltr">{year.label_en}</TableCell>
                                <TableCell>{year.label_he}</TableCell>
                                <TableCell>
                                    {year.is_active ? (
                                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">פעיל</Badge>
                                    ) : (
                                        <Badge variant="outline">ארכיון</Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        {!year.is_active && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleSetActive(year)}
                                                    disabled={activating === year.id}
                                                >
                                                    {activating === year.id ? "מגדיר..." : "הגדר כפעיל"}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleCarryOver(year)}
                                                    disabled={carryingOver === year.id || !years.find((y) => y.is_active)}
                                                    title="העבר פרויקטים מאושרים ופנויים לשנה הפעילה"
                                                >
                                                    {carryingOver === year.id ? "מעביר..." : "העבר פרויקטים"}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile card layout */}
            <div className="md:hidden space-y-3">
                {years.map((year) => (
                    <Card key={year.id}>
                        <CardContent className="pt-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold">{year.label_he}</p>
                                    <p className="text-sm text-muted-foreground" dir="ltr">{year.label_en}</p>
                                    <p className="text-xs text-muted-foreground font-mono">{year.slug}</p>
                                </div>
                                {year.is_active ? (
                                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">פעיל</Badge>
                                ) : (
                                    <Badge variant="outline">ארכיון</Badge>
                                )}
                            </div>
                            {!year.is_active && (
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => handleSetActive(year)}
                                        disabled={activating === year.id}
                                    >
                                        {activating === year.id ? "מגדיר..." : "הגדר כפעיל"}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="flex-1"
                                        onClick={() => handleCarryOver(year)}
                                        disabled={carryingOver === year.id || !years.find((y) => y.is_active)}
                                    >
                                        {carryingOver === year.id ? "מעביר..." : "העבר פרויקטים"}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

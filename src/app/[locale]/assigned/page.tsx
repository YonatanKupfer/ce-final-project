"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TRACKS, type TrackId, type AcademicYear } from "@/lib/constants";

interface AssignedProject {
    id: string;
    project_id: string;
    student1_name: string;
    student1_id: string;
    student2_name: string | null;
    student2_id: string | null;
    project: {
        project_number: number;
        title_he: string;
        title_en: string;
        track: string;
        supervisors_name: string;
        academic_supervisor_name: string;
        academic_year_id: string | null;
    };
}

export default function AssignedPage() {
    const t = useTranslations("assignedTable");
    const tCommon = useTranslations("common");
    const [registrations, setRegistrations] = useState<AssignedProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [years, setYears] = useState<AcademicYear[]>([]);
    const [selectedYearSlug, setSelectedYearSlug] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/academic-years")
            .then((r) => r.json())
            .then((data: AcademicYear[]) => {
                setYears(data);
                const active = data.find((y) => y.is_active);
                if (active) setSelectedYearSlug(active.slug);
            })
            .catch(() => {});
    }, []);

    const selectedYear = years.find((y) => y.slug === selectedYearSlug) ?? null;
    const isReadOnly = selectedYear ? !selectedYear.is_active : false;

    const loadData = useCallback(async () => {
        if (!selectedYearSlug || !years.length) return;
        const year = years.find((y) => y.slug === selectedYearSlug);
        if (!year) return;
        const supabase = createSupabaseBrowserClient();
        if (!supabase) return;
        const { data } = await supabase
            .from("registrations")
            .select("id, project_id, student1_name, student1_id, student2_name, student2_id, project:projects(project_number, title_he, title_en, track, supervisors_name, academic_supervisor_name, academic_year_id)")
            .eq("status", "approved")
            .order("created_at", { ascending: true });
        const all = (data as unknown as AssignedProject[]) || [];
        const filtered = all.filter((r) => r.project?.academic_year_id === year.id);
        setRegistrations(filtered);
        setLoading(false);
    }, [selectedYearSlug, years]);

    useEffect(() => {
        if (selectedYearSlug && years.length > 0) {
            setLoading(true);
            loadData();
        }
    }, [loadData, selectedYearSlug, years]);

    const last4 = (id: string | null) => {
        if (!id || id.length < 4) return id || "";
        return id.slice(-4);
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-2xl sm:text-3xl font-bold mb-6">{t("title")}</h1>
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("title")}</h1>
                {years.length > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{tCommon("academicYear")}:</span>
                        <Select value={selectedYearSlug ?? ""} onValueChange={setSelectedYearSlug}>
                            <SelectTrigger className="w-44 h-8 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map((y) => (
                                    <SelectItem key={y.id} value={y.slug}>
                                        {y.label_he} — {y.label_en}{y.is_active ? " ✓" : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {isReadOnly && (
                <div className="mb-4 px-4 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                    {tCommon("readOnlyBanner")}
                </div>
            )}

            {registrations.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        אין פרויקטים משובצים כרגע
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Mobile card layout */}
                    <div className="md:hidden space-y-4">
                        {registrations.map((r) => (
                            <Card key={r.id}>
                                <CardContent className="p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono font-bold text-lg">{r.project?.project_number}</span>
                                        <Badge variant="outline" className="text-xs">
                                            {TRACKS[r.project?.track as TrackId]?.label}
                                        </Badge>
                                    </div>
                                    <div className="font-medium">{r.project?.title_he}</div>
                                    <div className="text-xs text-muted-foreground" dir="ltr">{r.project?.title_en}</div>
                                    <div className="text-sm text-muted-foreground">
                                        <span className="font-medium text-foreground">{t("supervisor")}:</span> {r.project?.supervisors_name}
                                    </div>
                                    {r.project?.academic_supervisor_name && (
                                        <div className="text-xs text-muted-foreground">{r.project?.academic_supervisor_name}</div>
                                    )}
                                    <div className="text-sm font-mono">
                                        <span className="font-medium text-foreground font-sans">{t("students")}:</span> {last4(r.student1_id)}{r.student2_id && ` / ${last4(r.student2_id)}`}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Desktop table layout */}
                    <div className="hidden md:block rounded-lg border overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-16">{t("projectNumber")}</TableHead>
                                    <TableHead>{t("projectTitle")}</TableHead>
                                    <TableHead>{t("supervisor")}</TableHead>
                                    <TableHead>{t("students")}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {registrations.map((r) => (
                                    <TableRow key={r.id}>
                                        <TableCell className="font-mono font-bold text-lg">
                                            {r.project?.project_number}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{r.project?.title_he}</div>
                                            <div className="text-xs text-muted-foreground" dir="ltr">
                                                {r.project?.title_en}
                                            </div>
                                            <Badge variant="outline" className="mt-1 text-xs">
                                                {TRACKS[r.project?.track as TrackId]?.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            <div>{r.project?.supervisors_name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {r.project?.academic_supervisor_name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono">
                                            {last4(r.student1_id)}
                                            {r.student2_id && ` / ${last4(r.student2_id)}`}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </>
            )}
        </div>
    );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TRACKS, type TrackId } from "@/lib/constants";

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
    };
}

export default function AssignedPage() {
    const t = useTranslations("assignedTable");
    const [registrations, setRegistrations] = useState<AssignedProject[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        const supabase = createSupabaseBrowserClient();
        if (!supabase) return;
        const { data } = await supabase
            .from("registrations")
            .select("id, project_id, student1_name, student1_id, student2_name, student2_id, project:projects(project_number, title_he, title_en, track, supervisors_name, academic_supervisor_name)")
            .eq("status", "approved")
            .order("created_at", { ascending: true });
        setRegistrations((data as unknown as AssignedProject[]) || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const last4 = (id: string | null) => {
        if (!id || id.length < 4) return id || "";
        return id.slice(-4);
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold tracking-tight mb-6">{t("title")}</h1>

            {registrations.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        אין פרויקטים משובצים כרגע
                    </CardContent>
                </Card>
            ) : (
                <div className="rounded-lg border overflow-auto">
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
            )}
        </div>
    );
}

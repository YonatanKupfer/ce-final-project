"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { Project, AcademicYear } from "@/lib/constants";
import { TRACK_LIST, academicYearLabel, normalizeTrack } from "@/lib/constants";

export default function ProjectsPage() {
    const t = useTranslations("projectsTable");
    const tTracks = useTranslations("tracks");
    const tCommon = useTranslations("common");
    const locale = useLocale();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [years, setYears] = useState<AcademicYear[]>([]);
    const [selectedYearSlug, setSelectedYearSlug] = useState<string | null>(null);

    // Fetch available academic years once on mount
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

    const loadProjects = useCallback(async () => {
        if (!selectedYearSlug) return;
        setLoading(true);
        const supabase = createSupabaseBrowserClient();
        if (!supabase) return;
        const year = years.find((y) => y.slug === selectedYearSlug);
        if (!year) return;
        const { data } = await supabase
            .from("projects")
            .select("*")
            .eq("status", "approved")
            .eq("academic_year_id", year.id)
            .order("project_number", { ascending: true });
        setProjects((data as Project[]) || []);
        setLoading(false);
    }, [selectedYearSlug, years]);

    useEffect(() => {
        if (selectedYearSlug && years.length > 0) {
            const timeout = setTimeout(() => {
                void loadProjects();
            }, 0);
            return () => clearTimeout(timeout);
        }
    }, [loadProjects, selectedYearSlug, years]);

    const getProjectsForTrack = (trackId: string) => {
        return projects.filter((p) => {
            const matchesTrack =
                normalizeTrack(p.track) === trackId ||
                (p.recommended_track && normalizeTrack(p.recommended_track) === trackId);
            const matchesSearch =
                !search ||
                p.title_he.includes(search) ||
                p.title_en.toLowerCase().includes(search.toLowerCase()) ||
                p.supervisors_name.includes(search) ||
                (p.project_number && p.project_number.toString().includes(search));
            return matchesTrack && matchesSearch;
        });
    };

    const allFiltered = projects.filter((p) => {
        if (!search) return true;
        return (
            p.title_he.includes(search) ||
            p.title_en.toLowerCase().includes(search.toLowerCase()) ||
            p.supervisors_name.includes(search) ||
            (p.project_number && p.project_number.toString().includes(search))
        );
    });

    const titleField = locale === "he" ? "title_he" : "title_en";

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
                                <span data-slot="select-value" className="flex flex-1 text-left">
                                    {selectedYear
                                        ? academicYearLabel(selectedYear, locale) + (selectedYear.is_active ? " ✓" : "")
                                        : ""}
                                </span>
                            </SelectTrigger>
                            <SelectContent>
                                {years.map((y) => (
                                    <SelectItem key={y.id} value={y.slug}>
                                        {academicYearLabel(y, locale)}{y.is_active ? " ✓" : ""}
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

            <div className="mb-6">
                <Input
                    placeholder={`${t("title")} — חיפוש...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full sm:max-w-md"
                />
            </div>

            <Tabs defaultValue="all" className="space-y-4">
                <TabsList className="flex flex-wrap !h-auto gap-1 p-1">
                    <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        {t("allTracks")} ({allFiltered.length})
                    </TabsTrigger>
                    {TRACK_LIST.map((track) => (
                        <TabsTrigger
                            key={track.id}
                            value={track.id}
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                            <bdi>{tTracks(track.id)}</bdi> ({getProjectsForTrack(track.id).length})
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="all">
                    <ProjectTable
                        projects={allFiltered}
                        expandedId={expandedId}
                        setExpandedId={setExpandedId}
                        titleField={titleField}
                        t={t}
                    />
                </TabsContent>

                {TRACK_LIST.map((track) => (
                    <TabsContent key={track.id} value={track.id}>
                        <ProjectTable
                            projects={getProjectsForTrack(track.id)}
                            expandedId={expandedId}
                            setExpandedId={setExpandedId}
                            titleField={titleField}
                            t={t}
                        />
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}

function ProjectTable({
    projects,
    expandedId,
    setExpandedId,
    titleField,
    t,
}: {
    projects: Project[];
    expandedId: string | null;
    setExpandedId: (id: string | null) => void;
    titleField: "title_he" | "title_en";
    t: (key: string) => string;
}) {
    if (projects.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                    לא נמצאו פרויקטים
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            {/* Mobile card layout */}
            <div className="md:hidden space-y-4">
                {projects.map((p) => (
                    <Card
                        key={p.id}
                        className={`cursor-pointer ${p.is_taken ? "border-red-200 dark:border-red-800" : ""}`}
                        onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    >
                        <CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-lg">{p.project_number}</span>
                                <Badge variant={p.is_taken ? "destructive" : "secondary"}>
                                    {p.is_taken ? t("taken") : t("available")}
                                </Badge>
                            </div>
                            <div className="font-medium">{p[titleField]}</div>
                            <div className="text-xs text-muted-foreground" dir={titleField === "title_he" ? "ltr" : "rtl"}>
                                {titleField === "title_he" ? p.title_en : p.title_he}
                            </div>
                            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                <span>{p.supervisors_name}</span>
                                {p.academic_supervisor_name && <span>• {p.academic_supervisor_name}</span>}
                            </div>
                            {expandedId === p.id && (
                                <div className="border-t pt-3 mt-3 space-y-3">
                                    <DetailSection label="תקציר / Abstract" value={p.abstract} />
                                    <DetailSection label="מטרה / Objective" value={p.objective} />
                                    <DetailSection label="תכולה / Scope" value={p.scope} />
                                    {(p.prereq_course_1 || p.prereq_course_2) && (
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground mb-1">קורסי קדם / Prerequisites</p>
                                            {p.prereq_course_1 && <p className="text-sm">• {p.prereq_course_1}</p>}
                                            {p.prereq_course_2 && <p className="text-sm">• {p.prereq_course_2}</p>}
                                        </div>
                                    )}
                                    <DetailSection label="מקורות / References" value={p.references_text} />
                                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                                        <span>📧 {p.supervisors_email}</span>
                                        <span>📧 {p.academic_supervisor_email}</span>
                                    </div>
                                </div>
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
                            <TableHead className="w-16 sticky top-0">{t("projectNumber")}</TableHead>
                            <TableHead className="sticky top-0">{t("projectTitle")}</TableHead>
                            <TableHead className="sticky top-0">{t("supervisor")}</TableHead>
                            <TableHead className="sticky top-0">{t("academicSupervisor")}</TableHead>
                            <TableHead className="w-24 sticky top-0">{t("status")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {projects.map((p) => (
                            <Fragment key={p.id}>
                                <TableRow
                                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${p.is_taken ? "bg-red-50 dark:bg-red-900/10 text-red-900 dark:text-red-200" : ""
                                        }`}
                                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                                >
                                    <TableCell className="font-mono font-bold text-lg">
                                        {p.project_number}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-medium">{p[titleField]}</div>
                                        <div className="text-xs text-muted-foreground" dir={titleField === "title_he" ? "ltr" : "rtl"}>
                                            {titleField === "title_he" ? p.title_en : p.title_he}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">{p.supervisors_name}</TableCell>
                                    <TableCell className="text-sm">{p.academic_supervisor_name}</TableCell>
                                    <TableCell>
                                        <Badge variant={p.is_taken ? "destructive" : "secondary"}>
                                            {p.is_taken ? t("taken") : t("available")}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                                {expandedId === p.id && (
                                    <TableRow key={`${p.id}-details`}>
                                        <TableCell colSpan={5} className="bg-muted/30 p-6">
                                            <div className="space-y-4 max-w-4xl">
                                                <DetailSection label="תקציר / Abstract" value={p.abstract} />
                                                <DetailSection label="מטרה / Objective" value={p.objective} />
                                                <DetailSection label="תכולה / Scope" value={p.scope} />
                                                {(p.prereq_course_1 || p.prereq_course_2) && (
                                                    <div>
                                                        <p className="text-sm font-medium text-muted-foreground mb-1">קורסי קדם / Prerequisites</p>
                                                        {p.prereq_course_1 && <p className="text-sm">• {p.prereq_course_1}</p>}
                                                        {p.prereq_course_2 && <p className="text-sm">• {p.prereq_course_2}</p>}
                                                    </div>
                                                )}
                                                <DetailSection label="מקורות / References" value={p.references_text} />
                                                <Separator />
                                                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                                    <span>📧 {p.supervisors_email}</span>
                                                    <span>📧 {p.academic_supervisor_email}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </Fragment>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </>
    );
}

function DetailSection({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
            <p className="text-sm whitespace-pre-wrap">{value}</p>
        </div>
    );
}

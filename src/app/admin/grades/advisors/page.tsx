"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useAdminYear } from "@/app/admin/year-context";
import { SendAdvisorLinksButton, FormPreviewButton } from "@/app/admin/grades/grading-actions";

const DEV_ADMIN = process.env.NEXT_PUBLIC_DEV_ADMIN === "true";

interface AdvisorRow {
    name: string;
    email: string;
    link: { id: string; token: string } | null;
}

export default function AdvisorLinksPage() {
    const { selectedYear } = useAdminYear();
    const supabase = createSupabaseBrowserClient();

    const [adminEmail, setAdminEmail] = useState("");
    const [advisors, setAdvisors] = useState<AdvisorRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyEmail, setBusyEmail] = useState<string | null>(null);

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

    const loadAdvisors = useCallback(async () => {
        if (!selectedYear) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/grading/advisor-links?year=${selectedYear.slug}`);
            const body = await res.json();
            setAdvisors(body.advisors || []);
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        loadAdvisors();
    }, [loadAdvisors]);

    const handleGetLink = async (advisor: AdvisorRow) => {
        setBusyEmail(advisor.email);
        try {
            const res = await fetch("/api/admin/grading/advisor-links", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    academic_supervisor_email: advisor.email,
                    academic_supervisor_name: advisor.name,
                    created_by_email: adminEmail,
                }),
            });
            if (!res.ok) throw new Error();
            const body = await res.json();
            const url = `${window.location.origin}/advisor/${body.link.token}`;
            await navigator.clipboard.writeText(url);
            toast.success("הקישור נוצר והועתק");
            loadAdvisors();
        } catch {
            toast.error("שגיאה ביצירת הקישור");
        } finally {
            setBusyEmail(null);
        }
    };

    const handleCopyLink = async (link: { token: string }) => {
        const url = `${window.location.origin}/advisor/${link.token}`;
        await navigator.clipboard.writeText(url);
        toast.success("הקישור הועתק");
    };

    const handleSend = async (link: { id: string }, email: string) => {
        setBusyEmail(email);
        try {
            const res = await fetch(`/api/admin/grading/advisor-links/${link.id}/send`, { method: "POST" });
            if (!res.ok) throw new Error();
            toast.success("הקישור נשלח במייל");
        } catch {
            toast.error("שגיאה בשליחת המייל");
        } finally {
            setBusyEmail(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-2xl font-bold">קישורי אחראים אקדמיים</h1>
                    <p className="text-sm text-muted-foreground">
                        כל קישור מאפשר לאחראי.ת האקדמי.ת לשבץ שופט/ת לכל אחד מהפרויקטים שבאחריותו/ה, למצגת האמצע ולמצגת הסיום.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <SendAdvisorLinksButton
                        yearSlug={selectedYear?.slug ?? null}
                        yearLabel={selectedYear?.label_he ?? ""}
                        adminEmail={adminEmail}
                        advisorCount={advisors.length}
                        disabled={loading || advisors.length === 0}
                        onSent={loadAdvisors}
                    />
                    <FormPreviewButton kind="advisor_portal" weights={{}} />
                </div>
            </div>

            {loading ? (
                <Skeleton className="h-64 w-full" />
            ) : advisors.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">אין אחראים אקדמיים להצגה.</CardContent>
                </Card>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>שם</TableHead>
                                <TableHead>אימייל</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {advisors.map((advisor) => (
                                <TableRow key={advisor.email}>
                                    <TableCell>{advisor.name}</TableCell>
                                    <TableCell dir="ltr" className="text-muted-foreground">{advisor.email}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 justify-end">
                                            {advisor.link ? (
                                                <>
                                                    <Button size="sm" variant="outline" onClick={() => handleCopyLink(advisor.link!)}>
                                                        העתקת קישור
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        disabled={busyEmail === advisor.email}
                                                        onClick={() => handleSend(advisor.link!, advisor.email)}
                                                    >
                                                        שליחה במייל
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    disabled={busyEmail === advisor.email}
                                                    onClick={() => handleGetLink(advisor)}
                                                >
                                                    קבלת קישור
                                                </Button>
                                            )}
                                        </div>
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

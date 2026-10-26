"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import {
    AdvisorPortalView,
    type AdvisorPortalActions,
    type AdvisorPortalData,
} from "@/components/advisor-portal-view";

export default function AdvisorPortalPage() {
    const params = useParams();
    const token = params.token as string;

    const [data, setData] = useState<AdvisorPortalData | null>(null);
    const [loading, setLoading] = useState(true);
    const [invalid, setInvalid] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/advisor/${token}`);
            if (!res.ok) {
                setInvalid(true);
            } else {
                setData(await res.json());
            }
        } catch {
            setInvalid(true);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        load();
    }, [load]);

    const actions = useMemo<AdvisorPortalActions>(() => ({
        addJudge: async (projectId, round, name, email) => {
            const res = await fetch(`/api/advisor/${token}/projects/${projectId}/judges`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rubric_template_key: round, recipient_name: name, recipient_email: email }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error);
            }
            await load();
        },
        removeJudge: async (projectId, judge) => {
            const res = await fetch(`/api/advisor/${token}/projects/${projectId}/judges/${judge.id}`, { method: "DELETE" });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error);
            }
            await load();
        },
    }), [token, load]);

    if (loading) {
        return (
            <html lang="he" dir="rtl" className="h-full">
                <body className="min-h-full flex items-center justify-center bg-background text-foreground p-4">
                    <Skeleton className="h-96 w-full max-w-2xl" />
                </body>
            </html>
        );
    }

    if (invalid || !data) {
        return (
            <html lang="he" dir="rtl" className="h-full">
                <body className="min-h-full flex items-center justify-center bg-background text-foreground p-4">
                    <Card className="max-w-lg w-full text-center">
                        <CardContent className="py-12">
                            <div className="text-5xl mb-4">⚠️</div>
                            <h1 className="text-2xl font-bold text-yellow-600">קישור לא תקין.</h1>
                        </CardContent>
                    </Card>
                </body>
            </html>
        );
    }

    return (
        <html lang="he" dir="rtl" className="h-full">
            <body className="min-h-full bg-background text-foreground p-4">
                <div className="max-w-3xl w-full mx-auto my-8">
                    <AdvisorPortalView data={data} actions={actions} />
                </div>
                <Toaster position="bottom-left" richColors />
            </body>
        </html>
    );
}

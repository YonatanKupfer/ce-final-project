"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GradeFormView, type GradeFormData } from "@/components/grade-form-view";

export default function GradeTokenPage() {
    const params = useParams();
    const token = params.token as string;

    const [data, setData] = useState<GradeFormData | null>(null);
    const [loading, setLoading] = useState(true);
    const [invalid, setInvalid] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submittedAt, setSubmittedAt] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch(`/api/grade/${token}`);
                if (!res.ok) {
                    setInvalid(true);
                } else {
                    const body = await res.json();
                    setData(body);
                    setSubmittedAt(body.invite.status === "submitted" ? body.invite.submitted_at : null);
                }
            } catch {
                setInvalid(true);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [token]);

    const handleSubmit = async (body: Record<string, unknown>) => {
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`/api/grade/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const resBody = await res.json().catch(() => null);
                throw new Error(resBody?.error || "שגיאה בשליחת הציון");
            }
            setSubmittedAt(new Date().toISOString());
        } catch (err) {
            setError(err instanceof Error ? err.message : "שגיאה בשליחת הציון");
        } finally {
            setSubmitting(false);
        }
    };

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
            <body className="min-h-full flex items-center justify-center bg-background text-foreground p-4">
                <div className="max-w-2xl w-full my-8">
                    <GradeFormView
                        data={data}
                        submittedAt={submittedAt}
                        submitting={submitting}
                        error={error}
                        onSubmit={handleSubmit}
                    />
                </div>
            </body>
        </html>
    );
}

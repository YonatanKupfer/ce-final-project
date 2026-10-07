"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAdminYear } from "@/app/admin/year-context";
import type { GradeComponent } from "@/lib/constants";

export default function GradeSettingsPage() {
    const { selectedYear } = useAdminYear();

    const [weights, setWeights] = useState<GradeComponent[]>([]);
    const [draftWeights, setDraftWeights] = useState<Record<string, string>>({});
    const [weightsLoading, setWeightsLoading] = useState(true);
    const [savingWeights, setSavingWeights] = useState(false);

    const loadWeights = useCallback(async () => {
        if (!selectedYear) return;
        setWeightsLoading(true);
        try {
            const res = await fetch(`/api/admin/grading/weights?year=${selectedYear.slug}`);
            const body = await res.json();
            const list = (body.weights || []) as GradeComponent[];
            setWeights(list);
            setDraftWeights(Object.fromEntries(list.map((w) => [w.key, String(w.weight_percent)])));
        } finally {
            setWeightsLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        loadWeights();
    }, [loadWeights]);

    const sum = Object.values(draftWeights).reduce((s, v) => s + (Number(v) || 0), 0);
    const sumValid = Math.abs(sum - 100) < 0.01;

    const handleSaveWeights = async () => {
        if (!selectedYear || !sumValid) return;
        setSavingWeights(true);
        try {
            const res = await fetch("/api/admin/grading/weights", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    year: selectedYear.slug,
                    weights: weights.map((w) => ({ key: w.key, weight_percent: Number(draftWeights[w.key]) || 0 })),
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error);
            }
            toast.success("המשקלים נשמרו");
            loadWeights();
        } catch (err) {
            toast.error(err instanceof Error && err.message ? err.message : "שגיאה בשמירת המשקלים");
        } finally {
            setSavingWeights(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold">הגדרות ציונים</h1>
                <p className="text-sm text-muted-foreground">עריכת משקלי מרכיבי הציון.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">משקלי מרכיבי הציון — {selectedYear?.label_he ?? ""}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {weightsLoading ? (
                        <Skeleton className="h-48 w-full" />
                    ) : (
                        <>
                            {weights.map((w) => (
                                <div key={w.key} className="flex items-center gap-3">
                                    <Label className="flex-1">{w.label_he}</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step="any"
                                        className="w-24"
                                        value={draftWeights[w.key] ?? ""}
                                        onChange={(e) => setDraftWeights((prev) => ({ ...prev, [w.key]: e.target.value }))}
                                    />
                                    <span className="text-sm text-muted-foreground w-4">%</span>
                                </div>
                            ))}
                            <div className="flex items-center justify-between pt-2 border-t">
                                <span className={`text-sm font-medium ${sumValid ? "text-green-600" : "text-destructive"}`}>
                                    סה&quot;כ: {sum}% {!sumValid && "(חייב להיות 100%)"}
                                </span>
                                <Button onClick={handleSaveWeights} disabled={!sumValid || savingWeights}>
                                    {savingWeights ? "שומר..." : "שמירת משקלים"}
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

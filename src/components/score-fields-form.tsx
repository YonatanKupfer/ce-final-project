"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";

export interface ScoreField {
    key: string;
    label: string;
    // Shown next to the field when given — the judge forms (mid/final)
    // deliberately omit it; the academic advisor's combined
    // final_presentation form shows it for every field.
    weightPercent?: number;
    initialValue?: number | null;
}

interface ScoreFieldsFormProps {
    fields: ScoreField[];
    showDeliverablesCheckbox?: boolean;
    initialDeliverablesOnTime?: boolean | null;
    onSubmit: (values: Record<string, number>, deliverablesOnTime?: boolean) => Promise<void>;
    submitting?: boolean;
    submitLabel?: string;
}

// Every grading form is now one or more plain 1-100 fields — a single
// field for judges and for the mid_presentation advisor, four fields
// (presentation + teamwork + project_book + objectives) for the
// final_presentation advisor. No rubric criteria are ever shown.
export function ScoreFieldsForm({
    fields,
    showDeliverablesCheckbox,
    initialDeliverablesOnTime,
    onSubmit,
    submitting,
    submitLabel = "שליחת ציון",
}: ScoreFieldsFormProps) {
    const [values, setValues] = useState<Record<string, string>>(() =>
        Object.fromEntries(fields.map((f) => [f.key, f.initialValue != null ? String(f.initialValue) : ""]))
    );
    const [deliverablesOnTime, setDeliverablesOnTime] = useState(initialDeliverablesOnTime ?? false);

    const isValid = (key: string) => {
        const raw = values[key];
        if (raw === "" || raw === undefined) return false;
        const num = Number(raw);
        return !Number.isNaN(num) && num >= 1 && num <= 100;
    };
    const allValid = fields.every((f) => isValid(f.key));

    const handleSubmit = async () => {
        if (!allValid) return;
        const numericValues = Object.fromEntries(fields.map((f) => [f.key, Number(values[f.key])]));
        await onSubmit(numericValues, showDeliverablesCheckbox ? deliverablesOnTime : undefined);
    };

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                {fields.map((field) => (
                    <div key={field.key} className="flex items-center gap-3">
                        <Label className="flex-1">
                            {field.label}
                            {field.weightPercent !== undefined && (
                                <span className="text-muted-foreground"> (משקל: {field.weightPercent}% מהציון הסופי)</span>
                            )}
                        </Label>
                        <Input
                            type="number"
                            min={1}
                            max={100}
                            step="any"
                            className="w-24"
                            value={values[field.key] ?? ""}
                            onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        />
                    </div>
                ))}
                {showDeliverablesCheckbox && (
                    <div className="flex items-center gap-2">
                        <Checkbox checked={deliverablesOnTime} onCheckedChange={(c) => setDeliverablesOnTime(!!c)} />
                        <Label>כל התוצרים של הפרויקט הוגשו בזמן</Label>
                    </div>
                )}
                <Button onClick={handleSubmit} disabled={!allValid || submitting} className="w-full">
                    {submitting ? "שולח..." : submitLabel}
                </Button>
            </CardContent>
        </Card>
    );
}

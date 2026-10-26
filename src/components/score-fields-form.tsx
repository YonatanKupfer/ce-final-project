"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
    isBookTeamObjectivesForm,
    type GradeComponentKey,
    type GradingInvite,
    type RubricTemplateKey,
} from "@/lib/constants";

export interface ScoreField {
    key: string;
    label: string;
    // Shown next to the field when given — the presentation-round forms
    // deliberately omit it; the book_team_objectives form shows it for
    // every field.
    weightPercent?: number;
    initialValue?: number | null;
}

interface ScoreFieldsFormProps {
    fields: ScoreField[];
    showDeliverablesCheckbox?: boolean;
    initialDeliverablesOnTime?: boolean | null;
    initialComments?: string | null;
    onSubmit: (
        values: Record<string, number>,
        extras: { deliverablesOnTime?: boolean; comments: string }
    ) => Promise<void>;
    submitting?: boolean;
    submitLabel?: string;
}

// Every grading form is one or more plain 1-100 fields — a single field
// for every presentation-round form, three fields (teamwork +
// project_book + objectives) for book_team_objectives. No rubric criteria
// are ever shown.
export function ScoreFieldsForm({
    fields,
    showDeliverablesCheckbox,
    initialDeliverablesOnTime,
    initialComments,
    onSubmit,
    submitting,
    submitLabel = "שליחת ציון",
}: ScoreFieldsFormProps) {
    const [values, setValues] = useState<Record<string, string>>(() =>
        Object.fromEntries(fields.map((f) => [f.key, f.initialValue != null ? String(f.initialValue) : ""]))
    );
    const [deliverablesOnTime, setDeliverablesOnTime] = useState(initialDeliverablesOnTime ?? false);
    const [comments, setComments] = useState(initialComments ?? "");

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
        await onSubmit(numericValues, {
            deliverablesOnTime: showDeliverablesCheckbox ? deliverablesOnTime : undefined,
            comments: comments.trim(),
        });
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
                <div className="space-y-1.5">
                    <Label htmlFor="grading-comments">
                        הערות <span className="text-muted-foreground font-normal">(לא חובה)</span>
                    </Label>
                    <Textarea
                        id="grading-comments"
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        placeholder="ניתן להוסיף כאן הערות או פירוט לגבי הציון..."
                        rows={4}
                        maxLength={5000}
                    />
                </div>
                <Button onClick={handleSubmit} disabled={!allValid || submitting} className="w-full">
                    {submitting ? "שולח..." : submitLabel}
                </Button>
            </CardContent>
        </Card>
    );
}

type InviteScores = Pick<GradingInvite, "score" | "teamwork_score" | "project_book_score" | "objectives_score" | "deliverables_on_time" | "comments">;

// Picks the right fields for an invite's form and maps the submitted values
// to the request body /api/grade/[token] and the admin PATCH route expect.
export function InviteScoreForm({
    templateKey,
    invite,
    weights,
    onSubmit,
    submitting,
    submitLabel,
}: {
    templateKey: RubricTemplateKey;
    invite: InviteScores;
    weights?: Partial<Record<GradeComponentKey, number>>;
    onSubmit: (body: Record<string, unknown>) => Promise<void>;
    submitting?: boolean;
    submitLabel?: string;
}) {
    if (isBookTeamObjectivesForm(templateKey)) {
        return (
            <ScoreFieldsForm
                fields={[
                    { key: "teamwork", label: "עבודת צוות", weightPercent: weights?.teamwork, initialValue: invite.teamwork_score },
                    { key: "project_book", label: "ספר פרויקט", weightPercent: weights?.project_book, initialValue: invite.project_book_score },
                    { key: "objectives", label: "עמידה ביעדים", weightPercent: weights?.objectives, initialValue: invite.objectives_score },
                ]}
                showDeliverablesCheckbox
                initialDeliverablesOnTime={invite.deliverables_on_time}
                initialComments={invite.comments}
                onSubmit={(values, { deliverablesOnTime, comments }) =>
                    onSubmit({
                        teamwork: values.teamwork,
                        project_book: values.project_book,
                        objectives: values.objectives,
                        deliverables_on_time: deliverablesOnTime,
                        comments,
                    })
                }
                submitting={submitting}
                submitLabel={submitLabel}
            />
        );
    }

    return (
        <ScoreFieldsForm
            fields={[{ key: "score", label: "ציון (1-100)", initialValue: invite.score }]}
            initialComments={invite.comments}
            onSubmit={(values, { comments }) => onSubmit({ score: values.score, comments })}
            submitting={submitting}
            submitLabel={submitLabel}
        />
    );
}

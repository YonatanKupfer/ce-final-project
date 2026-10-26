"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InviteScoreForm } from "@/components/score-fields-form";
import { formatDateTime } from "@/lib/utils";
import {
    TRACKS,
    GRADING_ROLE_LABELS,
    normalizeTrack,
    isBookTeamObjectivesForm,
    type GradingRole,
    type RubricTemplateKey,
    type GradeComponentKey,
} from "@/lib/constants";

export interface GradeFormData {
    invite: {
        role: GradingRole;
        recipient_name: string | null;
        score: number | null;
        teamwork_score: number | null;
        project_book_score: number | null;
        objectives_score: number | null;
        deliverables_on_time: boolean | null;
        deliverables_submitted_on: string | null;
        comments: string | null;
    };
    template: { key: RubricTemplateKey; label_he: string };
    project: {
        project_number: number | null;
        title_he: string;
        title_en: string;
        track: string;
        supervisors_name: string;
        academic_supervisor_name: string;
        abstract: string;
    };
    weights?: Partial<Record<GradeComponentKey, number>>;
}

// The body of the public /grade/[token] page — shared with the admin
// "preview form" dialog so admins see exactly what a recipient will see.
export function GradeFormView({
    data,
    submittedAt,
    submitting,
    error,
    onSubmit,
}: {
    data: GradeFormData;
    // Last submission time; null while the form hasn't been submitted yet.
    submittedAt: string | null;
    submitting: boolean;
    error: string | null;
    onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
    const { invite, template, project, weights } = data;

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {project.project_number && (
                            <Badge variant="outline" className="font-mono">#{project.project_number}</Badge>
                        )}
                        <Badge variant="outline">{TRACKS[normalizeTrack(project.track)]?.label}</Badge>
                        <Badge variant="secondary">{template.label_he} — {GRADING_ROLE_LABELS[invite.role]}</Badge>
                    </div>
                    <CardTitle className="text-xl">{project.title_he}</CardTitle>
                    <p className="text-sm text-muted-foreground" dir="ltr">{project.title_en}</p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>מנחה: {project.supervisors_name}</p>
                    <p>אחראי.ת אקדמי.ת: {project.academic_supervisor_name}</p>
                    {project.abstract && <p className="pt-2 whitespace-pre-wrap text-foreground">{project.abstract}</p>}
                </CardContent>
            </Card>

            {submittedAt && (
                <Card className="border-green-600/30 bg-green-50 dark:bg-green-900/10">
                    <CardContent className="py-4 text-center text-green-700 dark:text-green-400 text-sm">
                        הציון הוגש בתאריך {formatDateTime(submittedAt)}. ניתן לערוך ולשלוח מחדש עד למועד סגירת הטופס.
                    </CardContent>
                </Card>
            )}

            {error && (
                <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="py-3 text-center text-destructive text-sm">{error}</CardContent>
                </Card>
            )}

            {isBookTeamObjectivesForm(template.key) && (
                <p className="text-sm text-muted-foreground">
                    יש להזין ציון בין 1 ל-100 לכל אחד מהרכיבים. לצד כל רכיב מופיע משקלו בציון הסופי של הפרויקט.
                </p>
            )}

            <InviteScoreForm
                templateKey={template.key}
                invite={invite}
                weights={weights}
                onSubmit={onSubmit}
                submitting={submitting}
                submitLabel={submittedAt ? "עדכון ציון" : "שליחת ציון"}
            />
        </div>
    );
}

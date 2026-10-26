"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";
import { GradeFormView, type GradeFormData } from "@/components/grade-form-view";
import {
    AdvisorPortalView,
    type AdvisorPortalActions,
    type AdvisorPortalData,
    type AdvisorPortalProject,
} from "@/components/advisor-portal-view";
import {
    TRACK_LIST,
    RUBRIC_TEMPLATE_LABELS,
    RUBRIC_TEMPLATE_ROLES,
    GRADING_ROLE_LABELS,
    isBookTeamObjectivesForm,
    type GradingRole,
    type RubricTemplateKey,
    type GradeComponentKey,
} from "@/lib/constants";

export function SendRoundButton({
    templateKey,
    yearSlug,
    adminEmail,
    onSent,
}: {
    templateKey: RubricTemplateKey;
    yearSlug: string | null;
    adminEmail: string;
    onSent: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [preview, setPreview] = useState<{ projects_count: number; advisors_to_send: number; judges_to_send: number } | null>(null);
    const [sending, setSending] = useState(false);
    const advisorOnly = isBookTeamObjectivesForm(templateKey);

    const handleOpen = async () => {
        if (!yearSlug) return;
        setOpen(true);
        setLoadingPreview(true);
        setPreview(null);
        try {
            const res = await fetch(`/api/admin/grading/send-round/${templateKey}?year=${yearSlug}`);
            const body = await res.json();
            setPreview(body);
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleConfirm = async () => {
        if (!yearSlug) return;
        setSending(true);
        try {
            const res = await fetch(`/api/admin/grading/send-round/${templateKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ year: yearSlug, created_by_email: adminEmail }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error);
            toast.success(`נשלחו ${body.sent} קישורים (${body.already_sent_skipped} נשלחו בעבר)${body.failed?.length ? `, ${body.failed.length} נכשלו` : ""}`);
            setOpen(false);
            onSent();
        } catch (err) {
            toast.error(err instanceof Error && err.message ? err.message : "שגיאה בשליחת הקישורים");
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <Button size="sm" onClick={handleOpen} disabled={!yearSlug}>
                📤 שליחת קישורי ציון
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent dir="rtl">
                    <DialogHeader>
                        <DialogTitle>שליחת קישורי ציון — {RUBRIC_TEMPLATE_LABELS[templateKey]}</DialogTitle>
                    </DialogHeader>
                    {loadingPreview ? (
                        <Skeleton className="h-24 w-full" />
                    ) : preview ? (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                {advisorOnly
                                    ? `בפרויקטים המאושרים (${preview.projects_count}): יישלחו ${preview.advisors_to_send} קישורים לאחראים אקדמיים.`
                                    : `בפרויקטים המאושרים (${preview.projects_count}): יישלחו ${preview.advisors_to_send} קישורים לאחראים אקדמיים ו-${preview.judges_to_send} קישורים לשופטים שלא נשלח להם קישור עדיין.`}
                            </p>
                            <Button onClick={handleConfirm} disabled={sending} className="w-full">
                                {sending ? "שולח..." : "אישור ושליחה"}
                            </Button>
                        </div>
                    ) : (
                        <p className="text-sm text-destructive">שגיאה בטעינת התצוגה המקדימה</p>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

interface RoundStatus {
    total: number;
    submitted: number;
    submitted_list: {
        id: string;
        role: GradingRole;
        recipient_name: string | null;
        recipient_email: string | null;
        project_number: number | null;
        title_he: string;
        submitted_at: string | null;
    }[];
    pending: number;
    pending_unsent: number;
    cooldown_hours: number;
    recipients: {
        email: string;
        name: string | null;
        last_reminder_sent_at: string | null;
        eligible: boolean;
        invites: { id: string; role: GradingRole; project_number: number | null; title_he: string; reminder_count: number }[];
    }[];
}

// Submission status (who submitted when, who's still pending) + "remind
// everyone who hasn't submitted" for one form.
// Reminders go out as one combined email per recipient, skipping anyone
// reminded within the server's cooldown window.
export function RoundReminders({
    templateKey,
    yearSlug,
    refreshKey,
}: {
    templateKey: RubricTemplateKey;
    yearSlug: string | null;
    refreshKey: number;
}) {
    const [status, setStatus] = useState<RoundStatus | null>(null);
    const [open, setOpen] = useState(false);
    const [sending, setSending] = useState(false);

    const loadStatus = useCallback(async () => {
        if (!yearSlug) return;
        try {
            const res = await fetch(`/api/admin/grading/remind-round/${templateKey}?year=${yearSlug}`);
            setStatus(res.ok ? await res.json() : null);
        } catch {
            setStatus(null);
        }
    }, [templateKey, yearSlug]);

    useEffect(() => {
        loadStatus();
    }, [loadStatus, refreshKey]);

    const handleOpen = () => {
        setOpen(true);
        loadStatus();
    };

    const handleConfirm = async () => {
        if (!yearSlug) return;
        setSending(true);
        try {
            const res = await fetch(`/api/admin/grading/remind-round/${templateKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ year: yearSlug }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error);
            toast.success(
                `נשלחו תזכורות ל-${body.reminded} נמענים` +
                (body.skipped_recent ? ` (${body.skipped_recent} דולגו — קיבלו תזכורת לאחרונה)` : "") +
                (body.failed?.length ? `, ${body.failed.length} נכשלו` : "")
            );
            setOpen(false);
            loadStatus();
        } catch (err) {
            toast.error(err instanceof Error && err.message ? err.message : "שגיאה בשליחת התזכורות");
        } finally {
            setSending(false);
        }
    };

    if (!status || status.total === 0) return null;

    const eligible = status.recipients.filter((r) => r.eligible);
    const eligibleForms = eligible.reduce((sum, r) => sum + r.invites.length, 0);
    const allDone = status.submitted === status.total;

    return (
        <>
            <Button size="sm" variant="ghost" onClick={handleOpen} title="סטטוס הגשה">
                <Badge variant={allDone ? "default" : "outline"}>
                    {status.submitted}/{status.total} הוגשו
                </Badge>
            </Button>
            {status.recipients.length > 0 && (
                <Button size="sm" variant="outline" onClick={handleOpen}>
                    🔔 תזכורת ({status.recipients.length})
                </Button>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>סטטוס הגשה — {RUBRIC_TEMPLATE_LABELS[templateKey]}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold">ממתינים להגשה ({status.pending})</h3>
                        {status.pending_unsent > 0 && (
                            <p className="text-sm rounded-md border border-dashed px-3 py-2 text-muted-foreground">
                                {status.pending_unsent} טפסים טרם נשלחו כלל (או שאין להם כתובת מייל) — הם לא נכללים בתזכורת.
                                לשליחתם יש להשתמש ב&quot;שליחת קישורי ציון&quot;.
                            </p>
                        )}
                        {status.recipients.length > 0 && (
                            <>
                                <p className="text-sm text-muted-foreground">
                                    כל נמען/ת יקבל/תקבל מייל אחד שמרכז את כל הטפסים הממתינים שלו/ה, עם קישור נפרד לכל פרויקט.
                                    מי שקיבל/ה תזכורת ב-{status.cooldown_hours} השעות האחרונות ידולג/תדולג.
                                </p>
                                <div className="rounded-lg border divide-y">
                                    {status.recipients.map((r) => (
                                        <div key={r.email} className={`px-3 py-2 text-sm space-y-1 ${r.eligible ? "" : "opacity-60"}`}>
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                <div>
                                                    <span className="font-medium">{r.name || r.email}</span>
                                                    {r.name && <span className="text-muted-foreground" dir="ltr"> · {r.email}</span>}
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {r.last_reminder_sent_at
                                                        ? `תזכורת אחרונה: ${formatDateTime(r.last_reminder_sent_at)}`
                                                        : "טרם נשלחה תזכורת"}
                                                    {!r.eligible && " · ידולג"}
                                                </span>
                                            </div>
                                            <ul className="text-muted-foreground space-y-0.5">
                                                {r.invites.map((inv) => (
                                                    <li key={inv.id}>
                                                        {inv.project_number ? `#${inv.project_number} ` : ""}{inv.title_he}
                                                        <span className="text-xs"> · {GRADING_ROLE_LABELS[inv.role]}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                                <Button onClick={handleConfirm} disabled={sending || eligible.length === 0} className="w-full">
                                    {sending
                                        ? "שולח..."
                                        : eligible.length === 0
                                            ? "כל הנמענים קיבלו תזכורת לאחרונה"
                                            : `שליחת תזכורת ל-${eligible.length} נמענים (${eligibleForms} טפסים)`}
                                </Button>
                            </>
                        )}
                        {status.pending === 0 && <p className="text-sm text-muted-foreground">כל הטפסים הוגשו.</p>}

                        <h3 className="text-sm font-semibold pt-2">הוגשו ({status.submitted})</h3>
                        {status.submitted_list.length === 0 ? (
                            <p className="text-sm text-muted-foreground">טרם הוגשו טפסים.</p>
                        ) : (
                            <div className="rounded-lg border divide-y">
                                {status.submitted_list.map((inv) => (
                                    <div key={inv.id} className="px-3 py-2 text-sm flex items-center justify-between gap-2 flex-wrap">
                                        <div>
                                            <span className="font-medium">{inv.recipient_name || inv.recipient_email || 'הזנה ידנית ע"י הצוות'}</span>
                                            <span className="text-muted-foreground">
                                                {" · "}{inv.project_number ? `#${inv.project_number} ` : ""}{inv.title_he}
                                                <span className="text-xs"> · {GRADING_ROLE_LABELS[inv.role]}</span>
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {inv.submitted_at ? `הוגש: ${formatDateTime(inv.submitted_at)}` : "הוגש"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

// Emails every academic advisor with an approved+staffed project in the
// year their personal judge-assignment portal link.
export function SendAdvisorLinksButton({
    yearSlug,
    yearLabel,
    adminEmail,
    advisorCount,
    disabled,
    onSent,
}: {
    yearSlug: string | null;
    yearLabel: string;
    adminEmail: string;
    advisorCount?: number;
    disabled?: boolean;
    onSent?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [sending, setSending] = useState(false);

    const handleSendAll = async () => {
        if (!yearSlug) return;
        setSending(true);
        try {
            const res = await fetch("/api/admin/grading/advisor-links/send-all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ year: yearSlug, created_by_email: adminEmail }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error);
            toast.success(`נשלחו קישורים ל-${body.sent} מתוך ${body.total} אחראים אקדמיים${body.failed?.length ? `, ${body.failed.length} נכשלו` : ""}`);
            setOpen(false);
            onSent?.();
        } catch (err) {
            toast.error(err instanceof Error && err.message ? err.message : "שגיאה בשליחת הקישורים");
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            <Button size="sm" onClick={() => setOpen(true)} disabled={disabled || !yearSlug}>
                📤 שליחת קישור שיבוץ לכל האחראים
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent dir="rtl">
                    <DialogHeader>
                        <DialogTitle>שליחת קישור שיבוץ שופטים לכל האחראים האקדמיים</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        יישלח מייל ל{advisorCount !== undefined ? `כל ${advisorCount}` : "כל"} האחראים האקדמיים עם פרויקט מאושר
                        ומאויש בשנה הנבחרת ({yearLabel}), כולל למי שכבר קיבל קישור בעבר. המייל מסביר שיש ללחוץ על
                        הקישור ולשבץ שופטים לכל פרויקט — השופטים עצמם לא מקבלים מייל בשלב זה.
                    </p>
                    <Button onClick={handleSendAll} disabled={sending} className="w-full">
                        {sending ? "שולח..." : "אישור ושליחה"}
                    </Button>
                </DialogContent>
            </Dialog>
        </>
    );
}

export type PreviewKind = RubricTemplateKey | "advisor_portal";

const SAMPLE_PROJECT: GradeFormData["project"] = {
    project_number: 101,
    title_he: "פרויקט לדוגמה",
    title_en: "Sample Project",
    track: TRACK_LIST[0].id,
    supervisors_name: "שם המנחה",
    academic_supervisor_name: "שם האחראי.ת האקדמי.ת",
    abstract: "כאן יופיע תקציר הפרויקט כפי שהוגש בהצעה.",
};

const SAMPLE_KNOWN_ADVISORS = [
    { name: "שופט/ת לדוגמה א", email: "judge.a@example.com" },
    { name: "שופט/ת לדוגמה ב", email: "judge.b@example.com" },
];

function samplePortalData(): AdvisorPortalData {
    const emptyRounds = () => ({ mid_presentation: { judges: [] }, final_presentation: { judges: [] } });
    return {
        advisor: { name: "שם האחראי.ת האקדמי.ת", email: "advisor@example.com" },
        projects: [
            { id: "sample-1", project_number: 101, title_he: "פרויקט לדוגמה א", title_en: "Sample Project A", rounds: emptyRounds() },
            { id: "sample-2", project_number: 102, title_he: "פרויקט לדוגמה ב", title_en: "Sample Project B", rounds: emptyRounds() },
        ],
        knownAdvisors: SAMPLE_KNOWN_ADVISORS,
    };
}

// Shows admins exactly what a recipient will see, filled with sample data.
// Interactions work locally so the flow can be tried out, but nothing is
// ever saved or emailed.
export function FormPreviewButton({
    kind,
    weights,
}: {
    kind: PreviewKind;
    weights: Partial<Record<GradeComponentKey, number>>;
}) {
    const [open, setOpen] = useState(false);
    const title = kind === "advisor_portal" ? "עמוד שיבוץ שופטים (אחראי.ת אקדמי.ת)" : RUBRIC_TEMPLATE_LABELS[kind];

    return (
        <>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                👁️ תצוגה מקדימה
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent dir="rtl" className="w-[calc(100vw-2rem)] max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>תצוגה מקדימה — {title}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm rounded-md border border-dashed bg-muted/40 px-3 py-2 text-muted-foreground">
                        כך ייראה העמוד לנמען, עם נתונים לדוגמה. ניתן לנסות את הטופס — שום דבר לא יישמר ולא יישלח.
                    </p>
                    {open && (kind === "advisor_portal" ? <AdvisorPortalPreview /> : <GradeFormPreview templateKey={kind} weights={weights} />)}
                </DialogContent>
            </Dialog>
        </>
    );
}

function GradeFormPreview({
    templateKey,
    weights,
}: {
    templateKey: RubricTemplateKey;
    weights: Partial<Record<GradeComponentKey, number>>;
}) {
    const roles = RUBRIC_TEMPLATE_ROLES[templateKey];
    const [role, setRole] = useState<GradingRole>(roles[0]);
    const [submittedAt, setSubmittedAt] = useState<string | null>(null);

    const data: GradeFormData = {
        invite: {
            role,
            recipient_name: null,
            score: null,
            teamwork_score: null,
            project_book_score: null,
            objectives_score: null,
            deliverables_on_time: null,
            deliverables_submitted_on: null,
            comments: null,
        },
        template: { key: templateKey, label_he: RUBRIC_TEMPLATE_LABELS[templateKey] },
        project: SAMPLE_PROJECT,
        weights: isBookTeamObjectivesForm(templateKey) ? weights : undefined,
    };

    return (
        <div className="space-y-3">
            {roles.length > 1 && (
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">הצגה בתור:</span>
                    {roles.map((r) => (
                        <Button
                            key={r}
                            size="sm"
                            variant={r === role ? "default" : "outline"}
                            onClick={() => { setRole(r); setSubmittedAt(null); }}
                        >
                            {GRADING_ROLE_LABELS[r]}
                        </Button>
                    ))}
                </div>
            )}
            <GradeFormView
                key={role}
                data={data}
                submittedAt={submittedAt}
                submitting={false}
                error={null}
                onSubmit={async () => {
                    setSubmittedAt(new Date().toISOString());
                    toast.info("תצוגה מקדימה — הציון לא נשמר");
                }}
            />
        </div>
    );
}

function AdvisorPortalPreview() {
    const [data, setData] = useState<AdvisorPortalData>(samplePortalData);

    const updateRounds = (projectId: string, update: (rounds: AdvisorPortalProject["rounds"]) => AdvisorPortalProject["rounds"]) =>
        setData((prev) => ({
            ...prev,
            projects: prev.projects.map((p) => (p.id === projectId ? { ...p, rounds: update(p.rounds) } : p)),
        }));

    const actions: AdvisorPortalActions = {
        addJudge: async (projectId, round, name, email) => {
            const project = data.projects.find((p) => p.id === projectId);
            if (project?.rounds[round].judges.some((j) => j.recipient_email.toLowerCase() === email.toLowerCase())) {
                throw new Error("השופט/ת הזה/זו כבר משובץ/ת לפרויקט זה בסבב זה");
            }
            updateRounds(projectId, (rounds) => ({
                ...rounds,
                [round]: {
                    judges: [
                        ...rounds[round].judges,
                        { id: crypto.randomUUID(), recipient_name: name, recipient_email: email, invite_sent_at: null, submitted_at: null, status: "pending" },
                    ],
                },
            }));
        },
        removeJudge: async (projectId, judge) => {
            updateRounds(projectId, (rounds) => ({
                mid_presentation: { judges: rounds.mid_presentation.judges.filter((j) => j.id !== judge.id) },
                final_presentation: { judges: rounds.final_presentation.judges.filter((j) => j.id !== judge.id) },
            }));
        },
    };

    return <AdvisorPortalView data={data} actions={actions} />;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ScoreFieldsForm } from "@/components/score-fields-form";
import { useAdminYear } from "@/app/admin/year-context";
import {
    GRADE_COMPONENT_DEFAULTS,
    RUBRIC_TEMPLATE_KEYS,
    RUBRIC_TEMPLATE_ROLES,
    GRADING_ROLE_LABELS,
    isAdvisorFinalCombinedForm,
    type GradingInvite,
    type GradingRole,
    type RubricTemplateKey,
    type GradeComponentKey,
} from "@/lib/constants";

const DEV_ADMIN = process.env.NEXT_PUBLIC_DEV_ADMIN === "true";

const TEMPLATE_LABELS: Record<RubricTemplateKey, string> = {
    mid_presentation: "מצגת אמצע",
    final_presentation: "מצגת סיום",
};

interface SummaryRow {
    project_id: string;
    project_number: number | null;
    title_he: string;
    title_en: string;
    prep_report_submitted: boolean;
    students: string[];
    component_scores: Partial<Record<GradeComponentKey, number>>;
    complete: boolean;
    final_grade: number | null;
}

type InviteWithTemplate = GradingInvite & { rubric_template?: { key: RubricTemplateKey; label_he: string } };

export default function AdminGradesPage() {
    const { selectedYear } = useAdminYear();
    const supabase = createSupabaseBrowserClient();

    const [rows, setRows] = useState<SummaryRow[]>([]);
    const [weights, setWeights] = useState<Partial<Record<GradeComponentKey, number>>>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

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

    const loadSummary = useCallback(async () => {
        if (!selectedYear) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/grading/summary?year=${selectedYear.slug}`);
            const body = await res.json();
            setRows(body.rows || []);
            setWeights(body.weights || {});
        } finally {
            setLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => {
        loadSummary();
    }, [loadSummary]);

    const filtered = rows.filter((r) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            r.title_he.includes(search) ||
            r.title_en.toLowerCase().includes(s) ||
            r.students.some((n) => n.toLowerCase().includes(s))
        );
    });

    const selectedRow = rows.find((r) => r.project_id === selectedProjectId) || null;

    const handleTogglePrep = async (row: SummaryRow, checked: boolean) => {
        try {
            const res = await fetch(`/api/admin/projects/${row.project_id}/grading/prep-report`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submitted: checked }),
            });
            if (!res.ok) throw new Error();
            loadSummary();
        } catch {
            toast.error('שגיאה בעדכון דו"ח מכין');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-2xl font-bold">ציונים</h1>
                    <p className="text-sm text-muted-foreground">ניהול ציוני הפרויקטים — {selectedYear?.label_he ?? ""}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {RUBRIC_TEMPLATE_KEYS.map((key) => (
                        <SendRoundButton key={key} templateKey={key} yearSlug={selectedYear?.slug ?? null} adminEmail={adminEmail} onSent={loadSummary} />
                    ))}
                    <Link href="/admin/grades/advisors">
                        <Button variant="outline">🔗 קישורי אחראים אקדמיים</Button>
                    </Link>
                    <Link href="/admin/grades/settings">
                        <Button variant="outline">⚙️ הגדרות ציונים</Button>
                    </Link>
                </div>
            </div>

            <Input
                placeholder="חיפוש לפי שם פרויקט או סטודנט..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
            />

            {loading ? (
                <Skeleton className="h-96 w-full" />
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">אין פרויקטים להצגה.</CardContent>
                </Card>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>#</TableHead>
                                <TableHead>פרויקט</TableHead>
                                <TableHead>סטודנטים</TableHead>
                                <TableHead>דו&quot;ח מכין</TableHead>
                                <TableHead>ציון סופי</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map((row) => (
                                <TableRow key={row.project_id}>
                                    <TableCell className="font-mono">{row.project_number ?? "—"}</TableCell>
                                    <TableCell>{row.title_he}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{row.students.join(", ") || "—"}</TableCell>
                                    <TableCell>
                                        <Checkbox
                                            checked={row.prep_report_submitted}
                                            onCheckedChange={(c) => handleTogglePrep(row, !!c)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {row.final_grade !== null ? (
                                            <Badge>{row.final_grade.toFixed(1)}</Badge>
                                        ) : (
                                            <Badge variant="outline">חלקי</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Button size="sm" variant="ghost" onClick={() => setSelectedProjectId(row.project_id)}>
                                            פרטים
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <Dialog open={!!selectedProjectId} onOpenChange={(open) => !open && setSelectedProjectId(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    {selectedRow && (
                        <ProjectGradeDetail row={selectedRow} adminEmail={adminEmail} weights={weights} onChanged={loadSummary} />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function SendRoundButton({
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
            <Button variant="outline" onClick={handleOpen}>
                📤 שלח קישורי ציון ל{TEMPLATE_LABELS[templateKey]}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>שליחת קישורי ציון — {TEMPLATE_LABELS[templateKey]}</DialogTitle>
                    </DialogHeader>
                    {loadingPreview ? (
                        <Skeleton className="h-24 w-full" />
                    ) : preview ? (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                בפרויקטים המאושרים ({preview.projects_count}): יישלחו {preview.advisors_to_send} קישורים לאחראים אקדמיים
                                ו-{preview.judges_to_send} קישורים לשופטים שלא נשלח להם קישור עדיין.
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

function ProjectGradeDetail({
    row,
    adminEmail,
    weights,
    onChanged,
}: {
    row: SummaryRow;
    adminEmail: string;
    weights: Partial<Record<GradeComponentKey, number>>;
    onChanged: () => void;
}) {
    const [invites, setInvites] = useState<InviteWithTemplate[]>([]);
    const [loadingInvites, setLoadingInvites] = useState(true);
    const [newInvite, setNewInvite] = useState<{
        template: RubricTemplateKey;
        role: GradingRole;
        name: string;
        email: string;
        note: string;
    }>({ template: "mid_presentation", role: "academic_advisor", name: "", email: "", note: "" });
    const [creating, setCreating] = useState(false);
    const [reminding, setReminding] = useState<string | null>(null);
    const [editingInviteId, setEditingInviteId] = useState<string | null>(null);
    const [savingManual, setSavingManual] = useState(false);

    const loadInvites = useCallback(async () => {
        setLoadingInvites(true);
        try {
            const res = await fetch(`/api/admin/projects/${row.project_id}/grading/invites`);
            const body = await res.json();
            setInvites(body.invites || []);
        } finally {
            setLoadingInvites(false);
        }
    }, [row.project_id]);

    useEffect(() => {
        loadInvites();
    }, [loadInvites]);

    const handleCreateInvite = async () => {
        setCreating(true);
        try {
            const res = await fetch(`/api/admin/projects/${row.project_id}/grading/invites`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rubric_template_key: newInvite.template,
                    role: newInvite.role,
                    recipient_email: newInvite.email.trim(),
                    recipient_name: newInvite.name.trim(),
                    admin_note: newInvite.note.trim(),
                    created_by_email: adminEmail,
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error);
            }
            toast.success(newInvite.email.trim() ? "ההזמנה נשלחה במייל" : "ההזמנה נוצרה");
            setNewInvite((prev) => ({ ...prev, name: "", email: "", note: "" }));
            loadInvites();
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error && err.message ? err.message : "שגיאה ביצירת ההזמנה");
        } finally {
            setCreating(false);
        }
    };

    const handleRemind = async (invite: InviteWithTemplate) => {
        setReminding(invite.id);
        try {
            const res = await fetch(`/api/admin/grading/invites/${invite.id}/remind`, { method: "POST" });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error);
            }
            toast.success("תזכורת נשלחה");
            loadInvites();
        } catch (err) {
            toast.error(err instanceof Error && err.message ? err.message : "שגיאה בשליחת התזכורת");
        } finally {
            setReminding(null);
        }
    };

    const handleDelete = async (invite: InviteWithTemplate) => {
        if (!confirm("למחוק את ההזמנה? לא ניתן לשחזר.")) return;
        try {
            const res = await fetch(`/api/admin/grading/invites/${invite.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            toast.success("ההזמנה נמחקה");
            if (editingInviteId === invite.id) setEditingInviteId(null);
            loadInvites();
            onChanged();
        } catch {
            toast.error("שגיאה במחיקת ההזמנה");
        }
    };

    const handleManualSubmit = async (inviteId: string, body: Record<string, unknown>) => {
        setSavingManual(true);
        try {
            const res = await fetch(`/api/admin/grading/invites/${inviteId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const resBody = await res.json().catch(() => null);
                throw new Error(resBody?.error);
            }
            toast.success("הציון נשמר");
            setEditingInviteId(null);
            loadInvites();
            onChanged();
        } catch (err) {
            toast.error(err instanceof Error && err.message ? err.message : "שגיאה בשמירת הציון");
        } finally {
            setSavingManual(false);
        }
    };

    return (
        <div className="space-y-5">
            <DialogHeader>
                <DialogTitle>{row.title_he}</DialogTitle>
            </DialogHeader>

            <div className="space-y-1">
                <h3 className="text-sm font-semibold text-muted-foreground">פירוט הציון</h3>
                <div className="rounded-lg border divide-y">
                    {GRADE_COMPONENT_DEFAULTS.map((c) => {
                        const score = row.component_scores[c.key];
                        return (
                            <div key={c.key} className="flex items-center justify-between px-3 py-1.5 text-sm">
                                <span>{c.label_he}</span>
                                <span className="text-muted-foreground">{score !== undefined ? score.toFixed(1) : "—"}</span>
                            </div>
                        );
                    })}
                    <div className="flex items-center justify-between px-3 py-2 text-sm font-semibold">
                        <span>ציון סופי</span>
                        <span>{row.final_grade !== null ? row.final_grade.toFixed(1) : "לא הושלם"}</span>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">הזמנות למתן ציון</h3>
                {loadingInvites ? (
                    <Skeleton className="h-24 w-full" />
                ) : invites.length === 0 ? (
                    <p className="text-sm text-muted-foreground">אין הזמנות עדיין.</p>
                ) : (
                    <div className="space-y-2">
                        {invites.map((invite) => (
                            <div key={invite.id} className="border rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="text-sm">
                                        <span className="font-medium">
                                            {invite.rubric_template ? TEMPLATE_LABELS[invite.rubric_template.key] : ""}
                                        </span>
                                        {" · "}
                                        <span>{GRADING_ROLE_LABELS[invite.role]}</span>
                                        {invite.recipient_name && <span className="text-muted-foreground"> · {invite.recipient_name}</span>}
                                        {invite.recipient_email && (
                                            <span className="text-muted-foreground" dir="ltr"> · {invite.recipient_email}</span>
                                        )}
                                    </div>
                                    <Badge variant={invite.status === "submitted" ? "default" : "outline"}>
                                        {invite.status === "submitted" ? "הוגש" : "ממתין"}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingInviteId(editingInviteId === invite.id ? null : invite.id)}
                                    >
                                        {invite.status === "submitted" ? "עריכת ציון" : "הזנת ציון ידנית"}
                                    </Button>
                                    {invite.status === "pending" && invite.recipient_email && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            disabled={reminding === invite.id}
                                            onClick={() => handleRemind(invite)}
                                        >
                                            {reminding === invite.id ? "שולח..." : "תזכורת"}
                                        </Button>
                                    )}
                                    <Button size="sm" variant="ghost" onClick={() => handleDelete(invite)}>
                                        מחיקה
                                    </Button>
                                </div>
                                {editingInviteId === invite.id && (
                                    <div className="pt-2 border-t">
                                        {invite.rubric_template && isAdvisorFinalCombinedForm(invite.rubric_template.key, invite.role) ? (
                                            <ScoreFieldsForm
                                                fields={[
                                                    { key: "final_advisor", label: "ציון מצגת סיום", weightPercent: weights.final_advisor, initialValue: invite.score },
                                                    { key: "teamwork", label: "עבודת צוות", weightPercent: weights.teamwork, initialValue: invite.teamwork_score },
                                                    { key: "project_book", label: "ספר פרויקט", weightPercent: weights.project_book, initialValue: invite.project_book_score },
                                                    { key: "objectives", label: "עמידה ביעדים", weightPercent: weights.objectives, initialValue: invite.objectives_score },
                                                ]}
                                                showDeliverablesCheckbox
                                                initialDeliverablesOnTime={invite.deliverables_on_time}
                                                onSubmit={(values, deliverablesOnTime) =>
                                                    handleManualSubmit(invite.id, {
                                                        final_advisor: values.final_advisor,
                                                        teamwork: values.teamwork,
                                                        project_book: values.project_book,
                                                        objectives: values.objectives,
                                                        deliverables_on_time: deliverablesOnTime,
                                                    })
                                                }
                                                submitting={savingManual}
                                                submitLabel="שמירת ציון"
                                            />
                                        ) : (
                                            <ScoreFieldsForm
                                                fields={[{ key: "score", label: "ציון (1-100)", initialValue: invite.score }]}
                                                onSubmit={(values) => handleManualSubmit(invite.id, { score: values.score })}
                                                submitting={savingManual}
                                                submitLabel="שמירת ציון"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-semibold text-muted-foreground">הוספת הזמנה חדשה</h3>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <Label>טופס</Label>
                        <Select
                            value={newInvite.template}
                            onValueChange={(v) =>
                                setNewInvite((prev) => ({
                                    ...prev,
                                    template: v as RubricTemplateKey,
                                    role: RUBRIC_TEMPLATE_ROLES[v as RubricTemplateKey][0],
                                }))
                            }
                        >
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {RUBRIC_TEMPLATE_KEYS.map((k) => (
                                    <SelectItem key={k} value={k}>{TEMPLATE_LABELS[k]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>תפקיד</Label>
                        <Select
                            value={newInvite.role}
                            onValueChange={(v) => setNewInvite((prev) => ({ ...prev, role: v as GradingRole }))}
                        >
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {RUBRIC_TEMPLATE_ROLES[newInvite.template].map((r) => (
                                    <SelectItem key={r} value={r}>{GRADING_ROLE_LABELS[r]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <Input
                    placeholder="שם (לא חובה)"
                    value={newInvite.name}
                    onChange={(e) => setNewInvite((prev) => ({ ...prev, name: e.target.value }))}
                />
                <Input
                    placeholder='אימייל (לשליחת קישור; ריק = הזנה ידנית ע"י הצוות)'
                    value={newInvite.email}
                    onChange={(e) => setNewInvite((prev) => ({ ...prev, email: e.target.value }))}
                    dir="ltr"
                />
                <Button onClick={handleCreateInvite} disabled={creating} className="w-full">
                    {creating ? "יוצר..." : newInvite.email.trim() ? "שליחת הזמנה במייל" : "יצירת הזמנה להזנה ידנית"}
                </Button>
            </div>
        </div>
    );
}

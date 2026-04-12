"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface RegistrationData {
    id: string;
    status: string;
    student1_name: string;
    student1_id: string;
    student1_email: string;
    student2_name: string | null;
    student2_id: string | null;
    student2_email: string | null;
    project: {
        project_number: number;
        title_he: string;
        title_en: string;
        track: string;
        supervisors_name: string;
    };
}

export default function SupervisorDecisionPage() {
    const params = useParams();
    const token = params.token as string;
    const [registration, setRegistration] = useState<RegistrationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [deciding, setDeciding] = useState(false);
    const [result, setResult] = useState<"approved" | "rejected" | "already" | "invalid" | null>(null);

    useEffect(() => {
        async function loadRegistration() {
            try {
                const res = await fetch(`/api/registrations/${token}/info`);
                if (!res.ok) {
                    const data = await res.json();
                    if (data.error === "Already decided") {
                        setResult("already");
                    } else {
                        setResult("invalid");
                    }
                } else {
                    const data = await res.json();
                    setRegistration(data.registration);
                }
            } catch {
                setResult("invalid");
            } finally {
                setLoading(false);
            }
        }
        loadRegistration();
    }, [token]);

    const handleDecision = async (decision: "approved" | "rejected") => {
        if (!confirm(decision === "approved" ? "האם לאשר את ההרשמה?" : "האם לדחות את ההרשמה?")) return;
        setDeciding(true);
        try {
            const res = await fetch(`/api/registrations/${token}/decide`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ decision }),
            });
            if (res.ok) {
                setResult(decision);
            }
        } catch {
            // ignore
        } finally {
            setDeciding(false);
        }
    };

    if (loading) {
        return (
            <html lang="he" dir="rtl" className="h-full">
                <body className="min-h-full flex items-center justify-center bg-background text-foreground p-4">
                    <Skeleton className="h-96 w-full max-w-lg" />
                </body>
            </html>
        );
    }

    if (result) {
        const messages = {
            approved: { icon: "✅", title: "ההרשמה אושרה בהצלחה!", color: "text-green-600" },
            rejected: { icon: "❌", title: "ההרשמה נדחתה.", color: "text-red-600" },
            already: { icon: "ℹ️", title: "כבר התקבלה החלטה לגבי בקשה זו.", color: "text-blue-600" },
            invalid: { icon: "⚠️", title: "קישור לא תקין.", color: "text-yellow-600" },
        };
        const msg = messages[result];
        return (
            <html lang="he" dir="rtl" className="h-full">
                <body className="min-h-full flex items-center justify-center bg-background text-foreground p-4">
                    <Card className="max-w-lg w-full text-center">
                        <CardContent className="py-12">
                            <div className="text-5xl mb-4">{msg.icon}</div>
                            <h1 className={`text-2xl font-bold ${msg.color}`}>{msg.title}</h1>
                        </CardContent>
                    </Card>
                </body>
            </html>
        );
    }

    if (!registration) return null;

    return (
        <html lang="he" dir="rtl" className="h-full">
            <body className="min-h-full flex items-center justify-center bg-background text-foreground p-4">
                <Card className="max-w-lg w-full">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">אישור / דחיית הרשמה</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Project Info */}
                        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                            <h3 className="font-semibold text-sm text-muted-foreground">פרטי הפרויקט</h3>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-lg">
                                    #{registration.project.project_number}
                                </Badge>
                            </div>
                            <p className="font-medium">{registration.project.title_he}</p>
                            <p className="text-sm text-muted-foreground" dir="ltr">
                                {registration.project.title_en}
                            </p>
                        </div>

                        <Separator />

                        {/* Student Info */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-sm text-muted-foreground">פרטי הסטודנטים</h3>
                            <div className="bg-muted/30 rounded-lg p-3">
                                <p className="font-medium">{registration.student1_name}</p>
                                <p className="text-sm text-muted-foreground">{registration.student1_id} • {registration.student1_email}</p>
                            </div>
                            {registration.student2_name && (
                                <div className="bg-muted/30 rounded-lg p-3">
                                    <p className="font-medium">{registration.student2_name}</p>
                                    <p className="text-sm text-muted-foreground">{registration.student2_id} • {registration.student2_email}</p>
                                </div>
                            )}
                        </div>

                        <Separator />

                        {/* Decision Buttons */}
                        <div className="flex gap-4">
                            <Button
                                onClick={() => handleDecision("approved")}
                                disabled={deciding}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-lg py-6"
                            >
                                ✅ אישור
                            </Button>
                            <Button
                                onClick={() => handleDecision("rejected")}
                                disabled={deciding}
                                variant="destructive"
                                className="flex-1 text-lg py-6"
                            >
                                ❌ דחייה
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </body>
        </html>
    );
}

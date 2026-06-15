"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    createSupabaseBrowserClient,
    isSupabaseBrowserConfigured,
} from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";

function getCallbackError() {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));

    return (
        search.get("error_description") ||
        hash.get("error_description") ||
        search.get("error") ||
        hash.get("error")
    );
}

export default function AuthCallbackPage() {
    const configured = isSupabaseBrowserConfigured();
    const [error, setError] = useState<string | null>(
        configured ? null : "חסרה הגדרת Supabase בסביבה המקומית."
    );

    useEffect(() => {
        if (!configured) return;

        let cancelled = false;
        const callbackError = getCallbackError();
        const supabase = createSupabaseBrowserClient();

        async function completeLogin() {
            const { data: { session }, error: sessionError } =
                await supabase.auth.getSession();

            if (cancelled) return;

            if (callbackError || sessionError || !session?.user?.email) {
                setError(
                    callbackError ||
                    sessionError?.message ||
                    "קישור ההתחברות אינו תקין, פג תוקף או כבר היה בשימוש."
                );
                return;
            }

            const { data: staff, error: staffError } = await supabase
                .from("staff_emails")
                .select("email")
                .ilike("email", session.user.email.trim())
                .maybeSingle();

            if (cancelled) return;

            if (staffError || !staff) {
                if (staffError) {
                    console.error("[auth callback] staff lookup failed:", staffError);
                }
                await supabase.auth.signOut();
                setError("כתובת האימייל אינה מורשית לגשת ללוח הניהול.");
                return;
            }

            window.location.replace("/admin/pending");
        }

        completeLogin();

        return () => {
            cancelled = true;
        };
    }, [configured]);

    return (
        <main className="min-h-screen flex items-center justify-center p-6">
            <div className="text-center space-y-5 max-w-md">
                {error ? (
                    <>
                        <h1 className="text-2xl font-bold">ההתחברות לא הושלמה</h1>
                        <p className="text-muted-foreground">{error}</p>
                        <p className="text-sm text-muted-foreground">
                            בקשו קישור חדש ופתחו את הקישור האחרון שנשלח.
                        </p>
                        <Button nativeButton={false} render={<Link href="/admin" />}>
                            חזרה להתחברות
                        </Button>
                    </>
                ) : (
                    <>
                        <div className="text-lg font-medium">משלים התחברות...</div>
                        <p className="text-sm text-muted-foreground">
                            מיד תועברו ללוח הניהול.
                        </p>
                    </>
                )}
            </div>
        </main>
    );
}

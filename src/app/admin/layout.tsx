"use client";

import { useEffect, useState, Suspense } from "react";
import {
    createSupabaseBrowserClient,
    isSupabaseBrowserConfigured,
} from "@/lib/supabase-browser";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { AdminYearProvider, useAdminYear } from "@/app/admin/year-context";

const NAV_ITEMS = [
    { href: "/admin/pending", label: "הצעות ממתינות", icon: "⏳" },
    { href: "/admin/projects", label: "כל הפרויקטים", icon: "📋" },
    { href: "/admin/registrations", label: "הרשמות", icon: "👥" },
    { href: "/admin/settings", label: "הגדרות", icon: "⚙️" },
];

const DEV_ADMIN = process.env.NEXT_PUBLIC_DEV_ADMIN === "true";
const SUPABASE_CONFIGURED = isSupabaseBrowserConfigured();

async function isStaffEmail(supabase: SupabaseClient, email: string) {
    const { data, error } = await supabase
        .from("staff_emails")
        .select("email")
        .ilike("email", email.trim())
        .maybeSingle();

    if (error) {
        console.error("[admin auth] staff lookup failed:", error);
        return false;
    }

    return !!data;
}

function YearSwitcher() {
    const { years, selectedYear, setSelectedSlug } = useAdminYear();
    if (years.length === 0) return null;
    return (
        <div className="px-1 mb-3">
            <p className="text-xs text-muted-foreground mb-1">שנה אקדמית</p>
            <Select value={selectedYear?.slug ?? ""} onValueChange={setSelectedSlug}>
                <SelectTrigger className="w-full h-8 text-sm">
                    <span data-slot="select-value" className="flex flex-1 text-left">
                        {selectedYear
                            ? `${selectedYear.label_he}${selectedYear.is_active ? " ✓" : ""}`
                            : <span className="text-muted-foreground">בחרו שנה</span>}
                    </span>
                </SelectTrigger>
                <SelectContent>
                    {years.map((y) => (
                        <SelectItem key={y.id} value={y.slug}>
                            {y.label_he} — {y.label_en}{y.is_active ? " ✓" : ""}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(
        DEV_ADMIN ? ({ email: "dev@local" } as User) : null
    );
    const [isStaff, setIsStaff] = useState(DEV_ADMIN);
    const [loading, setLoading] = useState(!DEV_ADMIN && SUPABASE_CONFIGURED);
    const [email, setEmail] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [magicLinkSent, setMagicLinkSent] = useState(false);
    const [sending, setSending] = useState(false);
    const [verifyingCode, setVerifyingCode] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(
        SUPABASE_CONFIGURED
            ? null
            : "חסרה הגדרת Supabase בסביבה המקומית."
    );
    const pathname = usePathname();
    const supabase = createSupabaseBrowserClient();

    useEffect(() => {
        // Dev bypass: skip auth when NEXT_PUBLIC_DEV_ADMIN=true
        if (DEV_ADMIN || !SUPABASE_CONFIGURED) return;

        let cancelled = false;

        async function checkAuth() {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (cancelled) return;

            if (error) {
                console.error("[admin auth] getUser failed:", error);
            }

            setUser(user);
            setIsStaff(user?.email ? await isStaffEmail(supabase, user.email) : false);
            if (cancelled) return;
            setLoading(false);
        }
        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
            const nextUser = session?.user ?? null;
            setUser(nextUser);

            setTimeout(async () => {
                const staff = nextUser?.email
                    ? await isStaffEmail(supabase, nextUser.email)
                    : false;
                if (!cancelled) setIsStaff(staff);
            }, 0);
        });

        return () => {
            cancelled = true;
            subscription.unsubscribe();
        };
    }, [supabase]);

    const handleLogin = async () => {
        if (!SUPABASE_CONFIGURED || !email.trim()) return;
        setSending(true);
        setLoginError(null);
        const normalizedEmail = email.trim().toLowerCase();

        const staff = await isStaffEmail(supabase, normalizedEmail);

        if (!staff) {
            setSending(false);
            setLoginError("כתובת האימייל אינה מורשית לגשת ללוח הניהול.");
            return;
        }

        const { error } = await supabase.auth.signInWithOtp({
            email: normalizedEmail,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        setSending(false);
        if (error) {
            console.error("[admin login] signInWithOtp error:", error);
            setLoginError(error.message);
        } else {
            setEmail(normalizedEmail);
            setOtpCode("");
            setMagicLinkSent(true);
        }
    };

    const handleVerifyCode = async () => {
        if (!SUPABASE_CONFIGURED || !email.trim() || !otpCode.trim()) return;
        setVerifyingCode(true);
        setLoginError(null);

        const normalizedEmail = email.trim().toLowerCase();
        const token = otpCode.replace(/\s/g, "");

        const { data, error } = await supabase.auth.verifyOtp({
            email: normalizedEmail,
            token,
            type: "email",
        });

        if (error || !data.user?.email) {
            setVerifyingCode(false);
            setLoginError(error?.message || "קוד ההתחברות אינו תקין או פג תוקף.");
            return;
        }

        const staff = await isStaffEmail(supabase, data.user.email);
        setVerifyingCode(false);

        if (!staff) {
            await supabase.auth.signOut();
            setLoginError("כתובת האימייל אינה מורשית לגשת ללוח הניהול.");
            return;
        }

        setUser(data.user);
        setIsStaff(true);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setIsStaff(false);
    };

    if (loading) {
        return (
            <html lang="he" dir="rtl" className="h-full">
                <body className="min-h-full flex items-center justify-center bg-background text-foreground">
                    <div className="text-lg">טוען...</div>
                </body>
            </html>
        );
    }

    if (!user || !isStaff) {
        return (
            <html lang="he" dir="rtl" className="h-full">
                <body className="min-h-full flex items-center justify-center bg-background text-foreground">
                    <div className="text-center space-y-6 p-8 max-w-sm w-full">
                        <h1 className="text-3xl font-bold">ניהול פרויקטי גמר</h1>

                        {user && !isStaff ? (
                            <>
                                <p className="text-muted-foreground">
                                    הכתובת <strong>{user.email}</strong> אינה מורשית לגשת ללוח הניהול.
                                </p>
                                <Button onClick={handleLogout} variant="outline">התנתקות</Button>
                            </>
                        ) : magicLinkSent ? (
                            <>
                                <div className="text-4xl">📧</div>
                                <p className="text-muted-foreground">
                                    קישור התחברות נשלח לכתובת <strong>{email}</strong>.
                                    <br />אפשר ללחוץ על הקישור או להזין כאן את קוד ההתחברות מהמייל.
                                </p>
                                <div className="space-y-3">
                                    <Input
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        placeholder="קוד התחברות"
                                        value={otpCode}
                                        onChange={(e) => { setOtpCode(e.target.value); setLoginError(null); }}
                                        onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                                        dir="ltr"
                                        className="text-center"
                                    />
                                    {loginError && (
                                        <p className="text-sm text-destructive" dir="ltr" style={{ textAlign: "left" }}>
                                            {loginError}
                                        </p>
                                    )}
                                    <Button
                                        onClick={handleVerifyCode}
                                        size="lg"
                                        className="w-full"
                                        disabled={verifyingCode || !otpCode.trim()}
                                    >
                                        {verifyingCode ? "מאמת..." : "כניסה עם קוד"}
                                    </Button>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => { setMagicLinkSent(false); setOtpCode(""); setLoginError(null); }}>
                                    שליחה מחדש
                                </Button>
                            </>
                        ) : (
                            <>
                                <p className="text-muted-foreground">
                                    הזינו את כתובת האימייל שלכם לקבלת קישור התחברות
                                </p>
                                <div className="space-y-3">
                                    <Input
                                        type="email"
                                        placeholder="your@email.com"
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value); setLoginError(null); }}
                                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                                        dir="ltr"
                                        className="text-center"
                                    />
                                    {loginError && (
                                        <p className="text-sm text-destructive" dir="ltr" style={{ textAlign: "left" }}>
                                            {loginError}
                                        </p>
                                    )}
                                    <Button
                                        onClick={handleLogin}
                                        size="lg"
                                        className="w-full"
                                        disabled={!SUPABASE_CONFIGURED || sending || !email.trim()}
                                    >
                                        {sending ? "שולח..." : "שליחת קישור התחברות"}
                                    </Button>
                                </div>
                            </>
                        )}

                        <div>
                            <Link href="/he" className="text-sm text-muted-foreground hover:underline">
                                חזרה לדף הבית
                            </Link>
                        </div>
                    </div>
                </body>
            </html>
        );
    }

    return (
        <AdminYearProvider>
        <Suspense>
        <html lang="he" dir="rtl" className="h-full">
            <body className="min-h-full bg-background text-foreground">
                <div className="flex min-h-screen">
                    {/* Desktop Sidebar */}
                    <aside className="hidden md:flex w-64 border-l bg-muted/30 p-4 flex-col">
                        <div className="mb-6">
                            <h2 className="font-bold text-lg">לוח ניהול</h2>
                            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <Separator className="mb-4" />
                        <YearSwitcher />
                        <nav className="space-y-1 flex-1">
                            {NAV_ITEMS.map((item) => (
                                <Link key={item.href} href={item.href}>
                                    <Button
                                        variant={pathname === item.href ? "secondary" : "ghost"}
                                        className="w-full justify-start gap-2"
                                    >
                                        <span>{item.icon}</span>
                                        {item.label}
                                    </Button>
                                </Link>
                            ))}
                        </nav>
                        <Separator className="mb-4" />
                        <div className="space-y-2">
                            <Link href="/he">
                                <Button variant="ghost" className="w-full justify-start gap-2" size="sm">
                                    🏠 דף הבית
                                </Button>
                            </Link>
                            <Button variant="ghost" onClick={handleLogout} className="w-full justify-start gap-2" size="sm">
                                🚪 התנתקות
                            </Button>
                        </div>
                    </aside>

                    {/* Mobile Header + Sheet */}
                    <div className="flex-1 flex flex-col">
                        <header className="md:hidden flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                            <h2 className="font-bold text-lg">לוח ניהול</h2>
                            <Sheet>
                                <SheetTrigger render={<Button variant="ghost" size="sm" className="text-xl px-2" />}>
                                    ☰
                                </SheetTrigger>
                                <SheetContent side="right" className="w-64 p-4">
                                    <SheetHeader>
                                        <SheetTitle>תפריט</SheetTitle>
                                    </SheetHeader>
                                    <p className="text-sm text-muted-foreground truncate mb-4 mt-2">{user.email}</p>
                                    <Separator className="mb-4" />
                                    <YearSwitcher />
                                    <nav className="space-y-1">
                                        {NAV_ITEMS.map((item) => (
                                            <Link key={item.href} href={item.href}>
                                                <Button
                                                    variant={pathname === item.href ? "secondary" : "ghost"}
                                                    className="w-full justify-start gap-2"
                                                >
                                                    <span>{item.icon}</span>
                                                    {item.label}
                                                </Button>
                                            </Link>
                                        ))}
                                    </nav>
                                    <Separator className="my-4" />
                                    <div className="space-y-2">
                                        <Link href="/he">
                                            <Button variant="ghost" className="w-full justify-start gap-2" size="sm">
                                                🏠 דף הבית
                                            </Button>
                                        </Link>
                                        <Button variant="ghost" onClick={handleLogout} className="w-full justify-start gap-2" size="sm">
                                            🚪 התנתקות
                                        </Button>
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </header>

                        {/* Main Content */}
                        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
                    </div>
                </div>
                <Toaster position="bottom-left" richColors />
            </body>
        </html>
        </Suspense>
        </AdminYearProvider>
    );
}

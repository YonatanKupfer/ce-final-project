"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function Header() {
    const t = useTranslations("common");
    const locale = useLocale();
    const pathname = usePathname();
    const isRtl = locale === "he";
    const otherLocale = locale === "he" ? "en" : "he";

    const switchPath = pathname.replace(`/${locale}`, `/${otherLocale}`);

    return (
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <Link
                    href={`/${locale}`}
                    className="text-lg font-bold text-primary hover:opacity-80 transition-opacity"
                >
                    {t("appName")}
                </Link>

                <nav className="flex items-center gap-1 sm:gap-2">
                    <Link href={`/${locale}/projects`}>
                        <Button variant="ghost" size="sm" className="text-xs sm:text-sm">
                            {t("projects")}
                        </Button>
                    </Link>
                    <Link href={`/${locale}/propose`}>
                        <Button variant="ghost" size="sm" className="text-xs sm:text-sm">
                            {t("propose")}
                        </Button>
                    </Link>
                    <Link href={`/${locale}/register`}>
                        <Button variant="ghost" size="sm" className="text-xs sm:text-sm">
                            {t("register")}
                        </Button>
                    </Link>
                    <div className={`h-6 w-px bg-border ${isRtl ? "mr-1" : "ml-1"}`} />
                    <Link href="/admin">
                        <Button variant="ghost" size="sm" className="text-xs sm:text-sm">
                            {t("admin")}
                        </Button>
                    </Link>
                    <Link href={switchPath}>
                        <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                            {t("switchLang")}
                        </Button>
                    </Link>
                </nav>
            </div>
        </header>
    );
}

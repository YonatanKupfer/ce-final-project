"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function Header() {
    const t = useTranslations("common");
    const locale = useLocale();
    const pathname = usePathname();
    const isRtl = locale === "he";
    const otherLocale = locale === "he" ? "en" : "he";
    const regulationsUrl =
        process.env.NEXT_PUBLIC_PROJECT_REGULATIONS_URL || "/project-regulations.pdf";

    const switchPath = pathname.replace(`/${locale}`, `/${otherLocale}`);

    return (
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-4">
                <Link
                    href={`/${locale}`}
                    className="text-base sm:text-lg font-bold text-primary hover:opacity-80 transition-opacity"
                >
                    {t("appName")}
                </Link>

                {/* Desktop nav */}
                <nav className="hidden sm:flex items-center gap-1 sm:gap-2">
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
                    <Link href={`/${locale}/assigned`}>
                        <Button variant="ghost" size="sm" className="text-xs sm:text-sm">
                            {t("assigned")}
                        </Button>
                    </Link>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs sm:text-sm"
                        nativeButton={false}
                        render={
                            <a
                                href={regulationsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            />
                        }
                    >
                        {t("regulations")}
                    </Button>
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

                {/* Mobile nav */}
                <div className="sm:hidden flex items-center gap-2">
                    <Link href={switchPath}>
                        <Button variant="outline" size="sm" className="text-xs px-2">
                            {t("switchLang")}
                        </Button>
                    </Link>
                    <Sheet>
                        <SheetTrigger render={<Button variant="ghost" size="sm" className="text-xl px-2" />}>
                            ☰
                        </SheetTrigger>
                        <SheetContent side={isRtl ? "right" : "left"} className="w-64 p-4">
                            <SheetHeader>
                                <SheetTitle>{t("appName")}</SheetTitle>
                            </SheetHeader>
                            <nav className="mt-4 space-y-1">
                                <Link href={`/${locale}/projects`}>
                                    <Button variant="ghost" className="w-full justify-start">
                                        📋 {t("projects")}
                                    </Button>
                                </Link>
                                <Link href={`/${locale}/propose`}>
                                    <Button variant="ghost" className="w-full justify-start">
                                        📝 {t("propose")}
                                    </Button>
                                </Link>
                                <Link href={`/${locale}/register`}>
                                    <Button variant="ghost" className="w-full justify-start">
                                        ✍️ {t("register")}
                                    </Button>
                                </Link>
                                <Link href={`/${locale}/assigned`}>
                                    <Button variant="ghost" className="w-full justify-start">
                                        👥 {t("assigned")}
                                    </Button>
                                </Link>
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start"
                                    nativeButton={false}
                                    render={
                                        <a
                                            href={regulationsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        />
                                    }
                                >
                                    📄 {t("regulations")}
                                </Button>
                                <Link href="/admin">
                                    <Button variant="ghost" className="w-full justify-start">
                                        ⚙️ {t("admin")}
                                    </Button>
                                </Link>
                            </nav>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}

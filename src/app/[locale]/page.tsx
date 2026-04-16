import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const t = useTranslations("landing");
    const tc = useTranslations("common");

    return (
        <div className="container mx-auto px-4 py-12">
            <div className="text-center mb-12">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">{t("title")}</h1>
                <p className="text-xl text-muted-foreground">{t("subtitle")}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <Link href="propose" className="group">
                    <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50 group-hover:-translate-y-1">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-xl">
                                    📝
                                </span>
                                {t("proposeCard")}
                            </CardTitle>
                            <CardDescription className="text-base">
                                {t("proposeDesc")}
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="register" className="group">
                    <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50 group-hover:-translate-y-1">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 text-xl">
                                    ✍️
                                </span>
                                {t("registerCard")}
                            </CardTitle>
                            <CardDescription className="text-base">
                                {t("registerDesc")}
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="projects" className="group">
                    <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50 group-hover:-translate-y-1">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 text-xl">
                                    📋
                                </span>
                                {t("projectsCard")}
                            </CardTitle>
                            <CardDescription className="text-base">
                                {t("projectsDesc")}
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </Link>

                <Link href="assigned" className="group">
                    <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50 group-hover:-translate-y-1">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 text-xl">
                                    👥
                                </span>
                                {t("assignedCard")}
                            </CardTitle>
                            <CardDescription className="text-base">
                                {t("assignedDesc")}
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </Link>
            </div>
        </div>
    );
}

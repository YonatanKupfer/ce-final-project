import { useTranslations } from "next-intl";
import { RegistrationForm } from "@/components/registration-form";

export default function RegisterPage() {
    const t = useTranslations("register");

    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
            </div>
            <RegistrationForm />
        </div>
    );
}

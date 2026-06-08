"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { registrationFormSchema, type RegistrationFormData } from "@/lib/validations";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Project } from "@/lib/constants";

export function RegistrationForm() {
    const t = useTranslations("register");
    const tc = useTranslations("common");
    const [projects, setProjects] = useState<Project[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<RegistrationFormData>({
        resolver: zodResolver(registrationFormSchema),
        defaultValues: {
            project_id: "",
            student1_name: "",
            student1_id: "",
            student1_email: "",
            student2_name: "",
            student2_id: "",
            student2_email: "",
            is_ce_student: false,
        },
    });

    useEffect(() => {
        async function loadProjects() {
            const client = createSupabaseBrowserClient();
            if (!client) return;
            const { data } = await client
                .from("projects")
                .select("*")
                .eq("status", "approved")
                .eq("is_taken", false)
                .order("project_number", { ascending: true });
            setProjects((data as Project[]) || []);
            setLoadingProjects(false);
        }
        loadProjects();
    }, []);

    const onSubmit = async (data: RegistrationFormData) => {
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/registrations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Registration failed");
            }
            setIsSuccess(true);
            toast.success(t("successTitle"));
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : tc("error");
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isCeStudent = watch("is_ce_student");

    if (isSuccess) {
        return (
            <Card className="max-w-2xl mx-auto">
                <CardContent className="pt-8 pb-8 text-center">
                    <div className="text-5xl mb-4">✅</div>
                    <h2 className="text-2xl font-bold mb-2">{t("successTitle")}</h2>
                    <p className="text-muted-foreground">{t("successMessage")}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Project Selection */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">{t("selectProject")}</CardTitle>
                </CardHeader>
                <CardContent>
                    {loadingProjects ? (
                        <Skeleton className="h-10 w-full" />
                    ) : (
                        <div className="space-y-2">
                            <Label>{t("selectProject")} <span className="text-destructive">*</span></Label>
                            <Select
                                value={watch("project_id")}
                                onValueChange={(val) => { if (val) setValue("project_id", val, { shouldValidate: true }); }}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder={t("selectProject")} />
                                </SelectTrigger>
                                <SelectContent className="w-auto min-w-[var(--anchor-width)]">
                                    {projects.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            <span className="font-mono me-2">#{p.project_number}</span>
                                            {p.title_he}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.project_id && (
                                <p className="text-sm text-destructive">{errors.project_id.message}</p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Student 1 */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">סטודנט/ית 1</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField label={t("student1Name")} error={errors.student1_name?.message} required>
                        <Input {...register("student1_name")} />
                    </FormField>
                    <FormField label={t("student1Id")} error={errors.student1_id?.message} required>
                        <Input {...register("student1_id")} dir="ltr" />
                    </FormField>
                    <FormField label={t("student1Email")} error={errors.student1_email?.message} required>
                        <Input {...register("student1_email")} type="email" dir="ltr" />
                    </FormField>
                </CardContent>
            </Card>

            {/* Student 2 (Optional) */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">{t("student2Section")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField label={t("student2Name")}>
                        <Input {...register("student2_name")} />
                    </FormField>
                    <FormField label={t("student2Id")}>
                        <Input {...register("student2_id")} dir="ltr" />
                    </FormField>
                    <FormField label={t("student2Email")} error={errors.student2_email?.message}>
                        <Input {...register("student2_email")} type="email" dir="ltr" />
                    </FormField>
                </CardContent>
            </Card>

            {/* CE Student Confirmation */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                        <Checkbox
                            id="is_ce_student"
                            checked={isCeStudent}
                            onCheckedChange={(checked) => setValue("is_ce_student", !!checked, { shouldValidate: true })}
                        />
                        <div>
                            <Label htmlFor="is_ce_student" className="cursor-pointer font-medium">
                                {t("isCeStudent")} <span className="text-destructive">*</span>
                            </Label>
                            {errors.is_ce_student && (
                                <p className="text-sm text-destructive mt-1">{errors.is_ce_student.message}</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-center">
                <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-[200px]">
                    {isSubmitting ? tc("loading") : tc("submit")}
                </Button>
            </div>
        </form>
    );
}

function FormField({
    label,
    error,
    required,
    children,
}: {
    label: string;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <Label>
                {label}
                {required && <span className="text-destructive ms-1">*</span>}
            </Label>
            {children}
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { projectFormSchema, type ProjectFormData } from "@/lib/validations";
import { REQUIRED_COURSES, TRACK_LIST, requiredCourseLabel, type TrackId } from "@/lib/constants";

const DRAFT_KEY = "proposal-draft";

interface ProposalFormProps {
  editToken?: string;
  initialData?: Partial<ProjectFormData> & { id?: string };
}

export function ProposalForm({ editToken, initialData }: ProposalFormProps) {
  const t = useTranslations("propose");
  const tc = useTranslations("common");
  const tTracks = useTranslations("tracks");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const submissionSucceeded = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: initialData || {
      title_he: "",
      title_en: "",
      track: undefined,
      recommended_track: "",
      supervisors_name: "",
      supervisors_email: "",
      academic_supervisor_name: "",
      academic_supervisor_email: "",
      abstract: "",
      objective: "",
      scope: "",
      relevant_required_course_1: "",
      relevant_required_course_2: "",
      prereq_course_1: "",
      prereq_course_2: "",
      references_text: "",
    },
  });

  const watchedValues = watch();

  // Auto-save draft to localStorage (only for new submissions, not edits)
  useEffect(() => {
    if (editToken) return;
    const timeout = setTimeout(() => {
      if (!submissionSucceeded.current) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(watchedValues));
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [watchedValues, editToken]);

  // Load draft from localStorage on mount (only for new submissions)
  useEffect(() => {
    if (editToken || initialData) return;
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        Object.entries(draft).forEach(([key, value]) => {
          if (value) setValue(key as keyof ProjectFormData, value as string);
        });
      } catch { }
    }
  }, [editToken, initialData, setValue]);

  const onSubmit = async (data: ProjectFormData) => {
    setIsSubmitting(true);
    try {
      const url = editToken
        ? `/api/projects/${initialData?.id}`
        : "/api/projects";
      const method = editToken ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, edit_token: editToken }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Submission failed");
      }

      submissionSucceeded.current = true;
      localStorage.removeItem(DRAFT_KEY);
      reset();
      setIsSuccess(true);
      toast.success(editToken ? t("resubmitSuccess") : t("successTitle"));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : tc("error");
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

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
      {/* Section 1: Project Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("section1")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormField label={t("titleHe")} error={errors.title_he?.message} required>
            <Input {...register("title_he")} dir="rtl" />
          </FormField>

          <FormField label={t("titleEn")} error={errors.title_en?.message} required>
            <Input {...register("title_en")} dir="ltr" />
          </FormField>

          <FormField label={t("track")} error={errors.track?.message} required>
            <Select
              value={watchedValues.track}
              onValueChange={(val) => { if (val) setValue("track", val as TrackId, { shouldValidate: true }); }}
            >
              <SelectTrigger className="w-full">
                <span data-slot="select-value" className="flex flex-1">
                  {watchedValues.track ? (
                    tTracks(watchedValues.track)
                  ) : (
                    <span className="text-muted-foreground">{t("selectTrack")}</span>
                  )}
                </span>
              </SelectTrigger>
              <SelectContent>
                {TRACK_LIST.map((track) => (
                  <SelectItem key={track.id} value={track.id}>
                    {tTracks(track.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label={t("recommendedTrack")}
            subtitle={t("recommendedTrackSubtitle")}
          >
            <Select
              value={watchedValues.recommended_track || "none"}
              onValueChange={(val) =>
                setValue("recommended_track", (!val || val === "none" ? "" : val) as "" | TrackId)
              }
            >
              <SelectTrigger className="w-full">
                <span data-slot="select-value" className="flex flex-1">
                  {watchedValues.recommended_track
                    ? tTracks(watchedValues.recommended_track)
                    : "—"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {TRACK_LIST.map((track) => (
                  <SelectItem key={track.id} value={track.id}>
                    {tTracks(track.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </CardContent>
      </Card>

      {/* Section 2: Supervisor Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("section2")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormField label={t("supervisorName")} error={errors.supervisors_name?.message} required>
            <Input {...register("supervisors_name")} />
          </FormField>

          <FormField label={t("supervisorEmail")} error={errors.supervisors_email?.message} required>
            <Input {...register("supervisors_email")} type="email" dir="ltr" />
          </FormField>

          <Separator />

          <FormField
            label={t("academicSupervisor")}
            subtitle={t("academicSupervisorSubtitle")}
            error={errors.academic_supervisor_name?.message}
            required
          >
            <Input {...register("academic_supervisor_name")} />
          </FormField>

          <FormField
            label={t("academicSupervisorEmail")}
            error={errors.academic_supervisor_email?.message}
            required
          >
            <Input {...register("academic_supervisor_email")} type="email" dir="ltr" />
          </FormField>
        </CardContent>
      </Card>

      {/* Section 3: Academic Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("section3")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FormField label={t("abstract")} error={errors.abstract?.message} required>
            <Textarea {...register("abstract")} rows={5} />
          </FormField>

          <FormField
            label={t("objective")}
            subtitle={t("objectiveSubtitle")}
            error={errors.objective?.message}
            required
          >
            <Textarea {...register("objective")} rows={6} />
          </FormField>

          <FormField
            label={t("scope")}
            subtitle={t("scopeSubtitle")}
            error={errors.scope?.message}
            required
          >
            <Textarea {...register("scope")} rows={6} />
          </FormField>
        </CardContent>
      </Card>

      {/* Section 4: Prerequisites & References */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("section4")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <FormField
              label={t("relevantRequiredCourses")}
              subtitle={t("relevantRequiredCoursesSubtitle")}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <RequiredCourseSelect
                  value={watchedValues.relevant_required_course_1}
                  excludedValue={watchedValues.relevant_required_course_2}
                  placeholder={t("relevantRequiredCourse1")}
                  onChange={(value) => setValue("relevant_required_course_1", value)}
                />
                <RequiredCourseSelect
                  value={watchedValues.relevant_required_course_2}
                  excludedValue={watchedValues.relevant_required_course_1}
                  placeholder={t("relevantRequiredCourse2")}
                  onChange={(value) => setValue("relevant_required_course_2", value)}
                />
              </div>
            </FormField>
          </div>

          <FormField
            label={t("prereq1")}
            subtitle={t("prereqSubtitle")}
          >
            <Input {...register("prereq_course_1")} />
          </FormField>

          <FormField
            label={t("prereq2")}
            subtitle={t("prereqSubtitle")}
          >
            <Input {...register("prereq_course_2")} />
          </FormField>

          <FormField
            label={t("references")}
            subtitle={t("referencesSubtitle")}
            error={errors.references_text?.message}
            required
          >
            <Textarea {...register("references_text")} rows={5} />
          </FormField>
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

function RequiredCourseSelect({
  value,
  excludedValue,
  placeholder,
  onChange,
}: {
  value?: string;
  excludedValue?: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value || "none"}
      onValueChange={(nextValue) => onChange(nextValue && nextValue !== "none" ? nextValue : "")}
    >
      <SelectTrigger className="w-full min-h-10">
        <span data-slot="select-value" className="flex flex-1 text-right">
          {value || <span className="text-muted-foreground">{placeholder}</span>}
        </span>
      </SelectTrigger>
      <SelectContent className="w-auto min-w-[var(--anchor-width)] max-w-[min(42rem,calc(100vw-2rem))]">
        <SelectItem value="none">—</SelectItem>
        {REQUIRED_COURSES.map((course) => {
          const label = requiredCourseLabel(course);
          return (
            <SelectItem key={course.id} value={label} disabled={label === excludedValue}>
              <span className="font-mono me-2">{course.id}</span>
              {course.name}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function FormField({
  label,
  subtitle,
  error,
  required,
  children,
}: {
  label: string;
  subtitle?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ms-1">*</span>}
      </Label>
      {subtitle && (
        <p className="text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
      )}
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

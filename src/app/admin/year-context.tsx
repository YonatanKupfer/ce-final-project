"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { AcademicYear } from "@/lib/constants";

interface AdminYearContextValue {
    years: AcademicYear[];
    selectedYear: AcademicYear | null;
    setSelectedSlug: (slug: string | null) => void;
    refreshYears: () => Promise<void>;
}

const AdminYearContext = createContext<AdminYearContextValue>({
    years: [],
    selectedYear: null,
    setSelectedSlug: () => {},
    refreshYears: async () => {},
});

export function useAdminYear() {
    return useContext(AdminYearContext);
}

export function AdminYearProvider({ children }: { children: ReactNode }) {
    const [years, setYears] = useState<AcademicYear[]>([]);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const yearSlug = searchParams.get("year");

    const refreshYears = useCallback(async () => {
        const res = await fetch("/api/academic-years");
        if (res.ok) {
            const data: AcademicYear[] = await res.json();
            setYears(data);
        }
    }, []);

    useEffect(() => {
        refreshYears();
    }, [refreshYears]);

    // Once years are loaded, default the URL to the active year if no ?year param
    useEffect(() => {
        if (years.length > 0 && !yearSlug) {
            const active = years.find((y) => y.is_active);
            if (active) {
                const params = new URLSearchParams(searchParams.toString());
                params.set("year", active.slug);
                router.replace(`${pathname}?${params.toString()}`);
            }
        }
    }, [years, yearSlug, pathname, searchParams, router]);

    const selectedYear = years.find((y) => y.slug === yearSlug) ?? years.find((y) => y.is_active) ?? null;

    const setSelectedSlug = (slug: string | null) => {
        if (!slug) return;
        const params = new URLSearchParams(searchParams.toString());
        params.set("year", slug);
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <AdminYearContext.Provider value={{ years, selectedYear, setSelectedSlug, refreshYears }}>
            {children}
        </AdminYearContext.Provider>
    );
}

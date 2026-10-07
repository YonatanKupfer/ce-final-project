"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OTHER_VALUE = "__other__";

interface AdvisorPickerProps {
    knownAdvisors: { name: string; email: string }[];
    nameValue: string;
    emailValue: string;
    onChange: (name: string, email: string) => void;
}

// Lets an advisor assign a judge either by picking an existing advisor
// identity already known to the system, or by typing in a new name/email.
// Built from the existing Select primitive — the repo has no searchable
// combobox component, so this stays a plain dropdown + "other" escape hatch.
export function AdvisorPicker({ knownAdvisors, nameValue, emailValue, onChange }: AdvisorPickerProps) {
    const matched = knownAdvisors.find((a) => a.email === emailValue && a.name === nameValue);
    // "Other" must be its own toggle, not inferred from name/email being
    // non-empty — switching into "other" mode clears both values, which
    // would otherwise make the derived state immediately fall back to
    // "nothing selected" and hide the free-text inputs again.
    const [isOther, setIsOther] = useState(() => !matched && (nameValue !== "" || emailValue !== ""));
    const selectValue = isOther ? OTHER_VALUE : matched ? matched.email : "";

    return (
        <div className="space-y-2">
            <div>
                <Label>בחירה מרשימת אחראים קיימים</Label>
                <Select
                    value={selectValue}
                    onValueChange={(v) => {
                        if (v === OTHER_VALUE) {
                            setIsOther(true);
                            onChange("", "");
                            return;
                        }
                        setIsOther(false);
                        const advisor = knownAdvisors.find((a) => a.email === v);
                        if (advisor) onChange(advisor.name, advisor.email);
                    }}
                >
                    <SelectTrigger className="w-full"><SelectValue placeholder="בחירה..." /></SelectTrigger>
                    <SelectContent>
                        {knownAdvisors.map((a) => (
                            <SelectItem key={a.email} value={a.email}>{a.name} ({a.email})</SelectItem>
                        ))}
                        <SelectItem value={OTHER_VALUE}>אחר (הזנה חופשית)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {isOther && (
                <div className="grid grid-cols-2 gap-2">
                    <Input
                        placeholder="שם השופט/ת"
                        value={nameValue}
                        onChange={(e) => onChange(e.target.value, emailValue)}
                    />
                    <Input
                        placeholder="אימייל"
                        dir="ltr"
                        value={emailValue}
                        onChange={(e) => onChange(nameValue, e.target.value)}
                    />
                </div>
            )}
        </div>
    );
}

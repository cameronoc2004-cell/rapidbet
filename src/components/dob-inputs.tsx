"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Three small numeric inputs for entering a date of birth — MM / DD / YYYY.
// Combines them into a hidden field named "dob" in YYYY-MM-DD format on the
// surrounding <form>, so the existing submitDateOfBirth server action sees
// the same shape it always has.
//
// Why three fields instead of <input type="date">?
//   The native iOS date picker is a fat scroll wheel that defaults to
//   today's date — wrong default for someone entering their birthday
//   ~25 years ago. Two-tap entry per field is faster.
//
// UX notes:
//   - inputMode="numeric" so iOS shows the digit keypad, not the alpha kb.
//   - Auto-advance focus when MM or DD reaches 2 chars.
//   - Non-digit characters are filtered as the user types.
//   - The hidden dob field stays empty until all three are filled; the
//     submit handler / server action will reject empty as invalid_dob.
export function DobInputs() {
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");

  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  // Compose YYYY-MM-DD only when all three are present. The server action
  // does the actual validity check; we just shape it.
  const dob = useMemo(() => {
    if (month.length === 0 || day.length === 0 || year.length !== 4) return "";
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }, [month, day, year]);

  // Auto-advance focus once a field is "full" (MM/DD at 2 chars).
  useEffect(() => {
    if (month.length === 2) dayRef.current?.focus();
  }, [month]);
  useEffect(() => {
    if (day.length === 2) yearRef.current?.focus();
  }, [day]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <NumericField
          label="Month"
          placeholder="MM"
          value={month}
          maxLength={2}
          onChange={(v) => setMonth(v)}
        />
        <NumericField
          label="Day"
          placeholder="DD"
          value={day}
          maxLength={2}
          inputRef={dayRef}
          onChange={(v) => setDay(v)}
        />
        <NumericField
          label="Year"
          placeholder="YYYY"
          value={year}
          maxLength={4}
          inputRef={yearRef}
          onChange={(v) => setYear(v)}
        />
      </div>
      <input type="hidden" name="dob" value={dob} />
    </div>
  );
}

function NumericField({
  label,
  placeholder,
  value,
  maxLength,
  inputRef,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  maxLength: number;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) =>
          // Strip non-digits as the user types so paste/autocorrect can't
          // sneak a letter or separator in.
          onChange(e.target.value.replace(/\D/g, "").slice(0, maxLength))
        }
        inputMode="numeric"
        type="text"
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={
          label === "Month" ? "bday-month" : label === "Day" ? "bday-day" : "bday-year"
        }
        className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-center font-mono text-base text-[var(--text)] outline-none focus:border-[var(--primary)]"
      />
    </label>
  );
}

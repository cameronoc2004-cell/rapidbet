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
//   - Real-time validation: rejects non-existent dates (Feb 31, month 61,
//     etc.), future dates, and under-18s. Inline red message names the
//     specific problem. Hidden dob field stays empty until valid; the
//     parent form's submit button can disable itself via onValidityChange.

const MIN_AGE_YEARS = 18;
// Earliest birthday we'll allow — defensive against typos. Pre-1900 isn't
// going to be a real user; if a 125-year-old user shows up, raise this.
const MIN_YEAR = 1900;

interface DobInputsProps {
  // Called whenever the parsed date's validity changes. Use it to disable
  // the surrounding form's submit button until the user has entered a real
  // date that satisfies the age gate.
  onValidityChange?: (valid: boolean) => void;
}

interface Validation {
  valid: boolean;
  iso: string;        // YYYY-MM-DD when valid, "" otherwise
  error: string | null;
  showError: boolean; // only after the user has touched all 3 fields
}

function validate(month: string, day: string, year: string): Validation {
  const m = Number(month);
  const d = Number(day);
  const y = Number(year);

  // Nothing typed yet? Don't surface an error.
  if (!month && !day && !year) {
    return { valid: false, iso: "", error: null, showError: false };
  }

  // Wait for full year before bothering — typing "1" → "19" → "199" → "1998"
  // shouldn't flash three different errors.
  const allEntered = month !== "" && day !== "" && year.length === 4;
  if (!allEntered) {
    return { valid: false, iso: "", error: null, showError: false };
  }

  if (m < 1 || m > 12) {
    return { valid: false, iso: "", error: "Month must be between 1 and 12.", showError: true };
  }
  if (d < 1 || d > 31) {
    return { valid: false, iso: "", error: "Day must be between 1 and 31.", showError: true };
  }
  if (y < MIN_YEAR || y > new Date().getFullYear()) {
    return { valid: false, iso: "", error: "Enter a real year.", showError: true };
  }

  // Calendar-aware: reject Feb 31, Apr 31, etc. Use UTC Date and verify the
  // round-trip matches what was entered (JS auto-rolls overflow into the
  // next month otherwise).
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return { valid: false, iso: "", error: "That date doesn't exist.", showError: true };
  }

  // Age check (UTC-stable). Server enforces this too — keeping the client
  // friendly so they don't tap Save and bounce back with an error banner.
  const today = new Date();
  const yearsDiff = today.getUTCFullYear() - y;
  const monthsDiff = today.getUTCMonth() - (m - 1);
  const daysDiff = today.getUTCDate() - d;
  const age = yearsDiff - (monthsDiff < 0 || (monthsDiff === 0 && daysDiff < 0) ? 1 : 0);
  if (age < MIN_AGE_YEARS) {
    return {
      valid: false,
      iso: "",
      error: `You must be at least ${MIN_AGE_YEARS} to play.`,
      showError: true,
    };
  }

  return {
    valid: true,
    iso: `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    error: null,
    showError: false,
  };
}

export function DobInputs({ onValidityChange }: DobInputsProps) {
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");

  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => validate(month, day, year), [month, day, year]);

  useEffect(() => {
    onValidityChange?.(result.valid);
  }, [result.valid, onValidityChange]);

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
          invalid={result.showError && (Number(month) < 1 || Number(month) > 12)}
          onChange={setMonth}
        />
        <NumericField
          label="Day"
          placeholder="DD"
          value={day}
          maxLength={2}
          inputRef={dayRef}
          invalid={result.showError && (Number(day) < 1 || Number(day) > 31)}
          onChange={setDay}
        />
        <NumericField
          label="Year"
          placeholder="YYYY"
          value={year}
          maxLength={4}
          inputRef={yearRef}
          invalid={result.showError && (Number(year) < MIN_YEAR || Number(year) > new Date().getFullYear())}
          onChange={setYear}
        />
      </div>
      {result.showError && result.error && (
        <p className="text-xs text-[var(--danger)]">{result.error}</p>
      )}
      <input type="hidden" name="dob" value={result.iso} />
    </div>
  );
}

function NumericField({
  label,
  placeholder,
  value,
  maxLength,
  inputRef,
  invalid,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  maxLength: number;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  invalid?: boolean;
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
          onChange(e.target.value.replace(/\D/g, "").slice(0, maxLength))
        }
        inputMode="numeric"
        type="text"
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={
          label === "Month" ? "bday-month" : label === "Day" ? "bday-day" : "bday-year"
        }
        className={
          "mt-1.5 w-full rounded-lg border bg-[var(--surface-2)] px-3 py-2.5 text-center font-mono text-base text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)] " +
          (invalid ? "border-[var(--danger)]" : "border-[var(--border)]")
        }
      />
    </label>
  );
}

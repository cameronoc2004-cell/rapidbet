"use client";

import { useState } from "react";
import { DobInputs } from "./dob-inputs";

// Client wrapper that owns the Save button's disabled state. The parent
// (server) onboarding page hands us the server action; we manage the
// child DobInputs' validation locally and ungate the button only when
// the date is a real date that satisfies the age gate.
interface Props {
  action: (formData: FormData) => Promise<void>;
}

export function DobForm({ action }: Props) {
  const [valid, setValid] = useState(false);

  return (
    <form action={action} className="space-y-3">
      <DobInputs onValidityChange={setValid} />
      <p className="text-[11px] text-[var(--text-muted)]">
        We use this to confirm eligibility. It is never shown publicly.
      </p>
      <button
        type="submit"
        disabled={!valid}
        className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] hover:ring-2 hover:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--primary)] disabled:hover:ring-0"
      >
        Save
      </button>
    </form>
  );
}

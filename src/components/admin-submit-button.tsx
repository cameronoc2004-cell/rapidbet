"use client";

import { useFormStatus } from "react-dom";

interface SubmitButtonProps {
  children: React.ReactNode;
  pendingLabel?: string;
}

// Disables itself while the parent <form> action is in flight. Prevents the
// "I clicked Post and it submitted twice before the page navigated" race that
// previously caused duplicate question rows.
export function AdminSubmitButton({
  children,
  pendingLabel = "Posting…",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] hover:ring-2 hover:ring-white/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[var(--primary)] disabled:hover:ring-0"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

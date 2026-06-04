"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

// Re-fetches the parent server component's data without a full reload.
// useTransition tracks router.refresh()'s in-flight state, so we can spin the
// icon during the round-trip. 44pt target so iOS thumbs hit it cleanly.
export function RefreshButton({
  className = "",
  label = "Refresh",
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (pending) return;
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={label}
      title={label}
      className={
        "inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:border-[var(--primary-lo)] hover:text-white disabled:cursor-wait " +
        className
      }
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={pending ? "animate-spin" : ""}
        aria-hidden="true"
      >
        {/* Sync / refresh icon: two opposing arrows along a circle */}
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 4v5h-5" />
      </svg>
    </button>
  );
}

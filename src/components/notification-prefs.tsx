"use client";

import { useFormStatus } from "react-dom";
import { updateNotificationPrefs } from "@/app/me/actions";

interface NotificationPrefsProps {
  notifyEmail: boolean;
  notifyPush: boolean;
}

export function NotificationPrefs({ notifyEmail, notifyPush }: NotificationPrefsProps) {
  return (
    <form
      action={updateNotificationPrefs}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <div className="font-display text-base font-semibold text-[var(--text)]">
        Notification settings
      </div>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        We only notify you for results you care about — never for re-engagement.
      </p>

      <div className="mt-4 space-y-3">
        <ToggleRow
          name="notifyEmail"
          label="Email me"
          sub="Wins and account events"
          defaultChecked={notifyEmail}
        />
        <ToggleRow
          name="notifyPush"
          label="Push me"
          sub="Browser / mobile notifications"
          defaultChecked={notifyPush}
        />
      </div>

      <SaveButton />
    </form>
  );
}

function ToggleRow({
  name,
  label,
  sub,
  defaultChecked,
}: {
  name: string;
  label: string;
  sub: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 transition-colors hover:border-[var(--primary-lo)]/60">
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--text)]">{label}</div>
        <div className="mt-0.5 text-xs text-[var(--text-muted)]">{sub}</div>
      </div>
      {/* Switch: checkbox + two absolutely-positioned spans, both siblings of
          the checkbox so peer-checked: works on each. */}
      <span className="relative mt-1 inline-block h-5 w-9 shrink-0">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-[var(--border)] transition-colors peer-checked:bg-[var(--primary)]"
        />
        <span
          aria-hidden="true"
          className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4"
        />
      </span>
    </label>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] hover:ring-2 hover:ring-white/40 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save preferences"}
    </button>
  );
}

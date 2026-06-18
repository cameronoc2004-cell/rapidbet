import { NativeGate } from "@/components/native-gate";
import { isAdmin } from "@/lib/session";
import { adminSignOut } from "./login/actions";

// Bare admin chrome — completely separate from the consumer app shell (no top
// bar, tabs, balance, onboarding). The root layout (app/layout.tsx) renders
// this branch for /admin* via the x-pathname header. NativeGate bounces the
// native iOS app out of the admin area, so admin never appears in the app.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await isAdmin();

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <NativeGate redirectTo="/" />
      <header className="shrink-0 border-b border-[var(--border)]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
          <div className="font-display text-base font-bold tracking-tight">
            <span className="text-[var(--text)]">Rally</span>
            <span className="text-[var(--primary)]">Pot</span>
            <span className="ml-2 align-middle font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Admin
            </span>
          </div>
          {admin && (
            <form action={adminSignOut}>
              <button
                type="submit"
                className="rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:border-[var(--danger)]/60 hover:text-[var(--danger)]"
              >
                Sign out
              </button>
            </form>
          )}
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}

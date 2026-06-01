import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, questions } from "@/db/schema";
import { closeQuestion, createQuestion, resolveQuestion } from "./actions";

const OK: Record<string, string> = {
  created: "Question created.",
  resolved: "Question resolved and pot paid out.",
  closed: "Question closed.",
};
const ERR: Record<string, string> = {
  unauthorized: "Wrong admin password.",
  invalid_input: "Invalid input.",
  not_found: "Question not found.",
  already_resolved: "Question already resolved.",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;

  const open = await db
    .select()
    .from(questions)
    .where(eq(questions.status, "open"))
    .orderBy(desc(questions.createdAt));

  const closed = await db
    .select()
    .from(questions)
    .where(eq(questions.status, "closed"))
    .orderBy(desc(questions.createdAt));

  const allEntries = await db.select().from(entries);
  const entryCounts = new Map<number, number>();
  const potByQ = new Map<number, number>();
  for (const e of allEntries) {
    entryCounts.set(e.questionId, (entryCounts.get(e.questionId) ?? 0) + 1);
    potByQ.set(e.questionId, (potByQ.get(e.questionId) ?? 0) + e.amountPaid);
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="mt-1 text-sm text-neutral-500">
          MVP gate via shared password. Replace with real RBAC before real money.
        </p>
      </header>

      {ok && OK[ok] && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          {OK[ok]}
        </div>
      )}
      {error && ERR[error] && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {ERR[error]}
        </div>
      )}

      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">Create question</h2>
        <form action={createQuestion} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input name="title" label="Title" placeholder="How many points in Q1?" required />
          <Input name="gameLabel" label="Game label" placeholder="Week 5 vs Rivals" required />
          <Input name="description" label="Description (optional)" />
          <Select name="quarter" label="Quarter" options={["Q1", "Q2", "Q3", "Q4", "OT"]} />
          <Select name="currency" label="Currency" options={["GC", "SC"]} />
          <Input name="buyInAmount" label="Buy-in" type="number" defaultValue="5" min={1} required />
          <Input name="admin_password" label="Admin password" type="password" required />
          <div className="sm:col-span-2">
            <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
              Create
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Open & closed questions</h2>
        {[...open, ...closed].length === 0 && (
          <p className="text-sm text-neutral-500">Nothing yet.</p>
        )}
        {[...open, ...closed].map((q) => (
          <article
            key={q.id}
            className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="text-xs text-neutral-500">
                  #{q.id} · {q.gameLabel} · {q.quarter} ·{" "}
                  <span className="font-medium">{q.status}</span>
                </div>
                <h3 className="mt-1 font-semibold">{q.title}</h3>
              </div>
              <div className="text-xs text-neutral-500">
                {entryCounts.get(q.id) ?? 0} entries · pot {potByQ.get(q.id) ?? 0} {q.currency}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <form action={resolveQuestion} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="questionId" value={q.id} />
                <div className="flex-1 min-w-[100px]">
                  <label className="block text-xs font-medium">Actual value</label>
                  <input
                    name="actualValue"
                    type="number"
                    step="0.5"
                    required
                    className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  />
                </div>
                <input
                  name="admin_password"
                  type="password"
                  placeholder="admin pw"
                  required
                  className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                />
                <button className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white">
                  Resolve
                </button>
              </form>

              {q.status === "open" && (
                <form action={closeQuestion} className="flex items-end justify-end gap-2">
                  <input type="hidden" name="questionId" value={q.id} />
                  <input
                    name="admin_password"
                    type="password"
                    placeholder="admin pw"
                    required
                    className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
                    Close entries
                  </button>
                </form>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function Input({
  name,
  label,
  type = "text",
  required,
  placeholder,
  defaultValue,
  min,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  min?: number;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        min={min}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
    </label>
  );
}

function Select({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium">{label}</span>
      <select
        name={name}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

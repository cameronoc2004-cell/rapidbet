import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, games, questions } from "@/db/schema";
import {
  createGame,
  createQuestion,
  settleQuestionAction,
  voidQuestionAction,
} from "./actions";

const OK: Record<string, string> = {
  game_created: "Game created.",
  question_created: "Question created.",
  settled: "Question settled and pool paid out.",
  voided: "Question voided and all entries refunded.",
};
const ERR: Record<string, string> = {
  unauthorized: "Wrong admin password.",
  invalid_input: "Invalid input.",
  not_found: "Not found.",
  already_settled: "Already settled.",
  already_voided: "Already voided.",
  real_money_disabled: "Real-money mode is disabled; create a virtual question instead.",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;

  const allGames = await db.select().from(games).orderBy(desc(games.startsAt));

  const qList = await db
    .select({
      q: questions,
      g: games,
      entrantCount: sql<number>`coalesce(count(${entries.id}), 0)::int`.as("entrant_count"),
      poolMinor: sql<number>`coalesce(sum(${entries.feePaidMinor}), 0)::bigint`.as("pool_minor"),
    })
    .from(questions)
    .innerJoin(games, eq(questions.gameId, games.id))
    .leftJoin(entries, eq(entries.questionId, questions.id))
    .groupBy(questions.id, games.id)
    .orderBy(desc(questions.createdAt));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Free-to-play mode. Settle inputs the admin&apos;s mock value — real
          money is gated behind <code>REAL_MONEY_ENABLED</code> + a licensed
          data feed.
        </p>
      </header>

      {ok && OK[ok] && <Banner kind="ok" text={OK[ok]} />}
      {error && ERR[error] && <Banner kind="err" text={ERR[error]} />}

      {/* Create game */}
      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">1) Create game</h2>
        <form action={createGame} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input name="league" label="League" placeholder="NFL" required />
          <Input name="awayTeam" label="Away team" placeholder="Jets" required />
          <Input name="homeTeam" label="Home team" placeholder="Patriots" required />
          <Input name="startsAt" label="Starts at" type="datetime-local" required />
          <Input name="admin_password" label="Admin password" type="password" required />
          <div className="sm:col-span-2">
            <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
              Create game
            </button>
          </div>
        </form>
      </section>

      {/* Create question */}
      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">2) Create question against a game</h2>
        {allGames.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Create a game first.</p>
        ) : (
          <form action={createQuestion} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="block text-xs font-medium">Game</span>
              <select
                name="gameId"
                required
                className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              >
                {allGames.map((g) => (
                  <option key={g.id} value={g.id}>
                    #{g.id} · {g.league} · {g.awayTeam} @ {g.homeTeam} ·{" "}
                    {new Date(g.startsAt).toLocaleString()}
                  </option>
                ))}
              </select>
            </label>
            <Input name="title" label="Title" placeholder="Passing yards in Q1" required />
            <Input name="statType" label="Stat type" placeholder="passing_yards" required />
            <Input name="subject" label="Subject" placeholder="Player name / Team" required />
            <Select
              name="window"
              label="Window"
              options={[
                "Q1","Q2","Q3","Q4","OT","P1","P2","P3","I1","I2","I3","I4","I5","I6","I7","I8","I9","H1","H2","GAME",
              ]}
            />
            <Input name="entryFeeUsd" label="Entry fee (USD)" type="number" defaultValue="1.00" min="0.01" step="0.01" required />
            <Input name="minEntrants" label="Min entrants" type="number" defaultValue="2" min="2" required />
            <Input name="locksAt" label="Locks at" type="datetime-local" required />
            <Select name="moneyKind" label="Money kind" options={["virtual", "real"]} />
            <Input name="description" label="Description (optional)" />
            <Input name="admin_password" label="Admin password" type="password" required />
            <div className="sm:col-span-2">
              <button className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
                Create question
              </button>
            </div>
          </form>
        )}
      </section>

      {/* List + settle + void */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">3) Manage questions</h2>
        {qList.length === 0 && (
          <p className="text-sm text-neutral-500">No questions yet.</p>
        )}
        {qList.map(({ q, g, entrantCount, poolMinor }) => (
          <article
            key={q.id}
            className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="text-xs text-neutral-500">
                  #{q.id} · {g.league} · {g.awayTeam} @ {g.homeTeam} · {q.window} ·{" "}
                  <span className="font-medium">{q.status}</span> ·{" "}
                  {q.moneyKind === "virtual" ? "VC" : "$"}
                </div>
                <h3 className="mt-1 font-semibold">{q.title}</h3>
              </div>
              <div className="text-xs text-neutral-500">
                {entrantCount} entries · pool ${(Number(poolMinor) / 100).toFixed(2)}
              </div>
            </div>

            {q.status !== "settled" && q.status !== "voided" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <form
                  action={settleQuestionAction}
                  className="flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="questionId" value={q.id} />
                  <div className="flex-1 min-w-[100px]">
                    <label className="block text-xs font-medium">Official result</label>
                    <input
                      name="officialResult"
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
                    Settle
                  </button>
                </form>

                <form
                  action={voidQuestionAction}
                  className="flex items-end justify-end gap-2"
                >
                  <input type="hidden" name="questionId" value={q.id} />
                  <input
                    name="reason"
                    placeholder="reason"
                    className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <input
                    name="admin_password"
                    type="password"
                    placeholder="admin pw"
                    required
                    className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
                    Void
                  </button>
                </form>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

function Banner({ kind, text }: { kind: "ok" | "err"; text: string }) {
  const ok = kind === "ok";
  return (
    <div
      className={
        ok
          ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
          : "rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
      }
    >
      {text}
    </div>
  );
}

function Input({
  name, label, type = "text", required, placeholder, defaultValue, min, step,
}: {
  name: string; label: string; type?: string; required?: boolean;
  placeholder?: string; defaultValue?: string; min?: string | number; step?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium">{label}</span>
      <input
        name={name} type={type} required={required} placeholder={placeholder}
        defaultValue={defaultValue} min={min} step={step}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
    </label>
  );
}

function Select({ name, label, options }: { name: string; label: string; options: string[] }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium">{label}</span>
      <select
        name={name}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

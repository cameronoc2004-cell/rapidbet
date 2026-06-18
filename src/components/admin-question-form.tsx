"use client";

import { useMemo, useState } from "react";
import { createQuestion } from "@/app/admin/actions";
import { AdminSubmitButton } from "./admin-submit-button";

export interface AdminGame {
  id: number;
  league: string;
  awayTeam: string;
  homeTeam: string;
}

const LEAGUES = ["NFL", "NCAAF", "NBA", "NCAAB", "MLB", "NHL", "MLS", "WNBA"];
const WINDOWS = ["Q1", "Q2", "Q3", "Q4", "OT", "GAME"] as const;

const labelCls =
  "block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]";
const inputCls =
  "mt-1.5 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]";

export function AdminQuestionForm({
  games,
  defaultLocksAt,
}: {
  games: AdminGame[];
  defaultLocksAt: string;
}) {
  const [gameId, setGameId] = useState(
    games[0]?.id?.toString() ?? "new",
  );
  const [quarter, setQuarter] = useState<string>("Q1");
  const [title, setTitle] = useState("");
  const [away, setAway] = useState("");
  const [home, setHome] = useState("");

  const isNew = gameId === "new";

  // The teams in play right now — from the new-game inputs, or the selected
  // existing game. Used for the matchup preview and the question templates.
  const teams = useMemo(() => {
    if (isNew) return { away: away.trim(), home: home.trim() };
    const g = games.find((x) => x.id.toString() === gameId);
    return { away: g?.awayTeam ?? "", home: g?.homeTeam ?? "" };
  }, [isNew, away, home, gameId, games]);

  const homeName = teams.home || "the home team";
  const awayName = teams.away || "the away team";

  const templates = [
    `How many points will ${homeName} score in ${quarter}?`,
    `How many points will ${awayName} score in ${quarter}?`,
    `Total points scored in ${quarter}?`,
    `Total passing yards in ${quarter}?`,
  ];

  return (
    <form action={createQuestion} className="space-y-5">
      {/* Question */}
      <div>
        <label className={labelCls} htmlFor="q-title">
          Question
        </label>
        <textarea
          id="q-title"
          name="title"
          required
          rows={2}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="How many points will the home team score in Q1?"
          className="mt-1.5 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-base text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]/70 focus:border-[var(--primary)]"
        />
        {/* One-tap templates — fill in the current teams + quarter */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {templates.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTitle(t)}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--primary-lo)] hover:text-[var(--text)]"
            >
              {t.replace(/\?$/, "")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block min-w-0">
          <span className={labelCls}>Game</span>
          <select
            name="gameId"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className={inputCls}
          >
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.awayTeam} @ {g.homeTeam}
              </option>
            ))}
            <option value="new">+ New game…</option>
          </select>
        </label>

        <label className="block min-w-0">
          <span className={labelCls}>Quarter</span>
          <select
            name="window"
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className={inputCls}
          >
            {WINDOWS.map((q) => (
              <option key={q} value={q}>
                {q === "GAME" ? "Full game" : q}
              </option>
            ))}
          </select>
        </label>

        <label className="col-span-2 block min-w-0 sm:col-span-1">
          <span className={labelCls}>Locks at</span>
          <input
            type="datetime-local"
            name="locksAt"
            required
            defaultValue={defaultLocksAt}
            className={inputCls}
          />
        </label>

        <label className="col-span-2 block min-w-0 sm:col-span-1">
          <span className={labelCls}>Entry fee</span>
          <div className="mt-1.5 flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] focus-within:border-[var(--primary)]">
            <span className="px-3 text-sm text-[var(--text-muted)]">$</span>
            <input
              type="number"
              name="entryFeeUsd"
              step="0.01"
              min="0.01"
              required
              defaultValue="1.00"
              className="w-full min-w-0 bg-transparent py-2.5 pr-3 text-sm text-[var(--text)] outline-none"
            />
          </div>
        </label>
      </div>

      {/* New-game card — only shown when "+ New game" is picked */}
      {isNew && (
        <div className="space-y-3 rounded-xl border border-[var(--primary-lo)]/40 bg-[var(--surface)] p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--primary)]">
            New game details
          </div>

          <label className="block">
            <span className={labelCls}>League</span>
            <input
              name="newLeague"
              list="leagues"
              required
              placeholder="e.g. NCAAF"
              className={inputCls}
            />
            <datalist id="leagues">
              {LEAGUES.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block min-w-0">
              <span className={labelCls}>Away team</span>
              <input
                name="newAway"
                required
                value={away}
                onChange={(e) => setAway(e.target.value)}
                placeholder="e.g. SMU"
                className={inputCls}
              />
            </label>
            <label className="block min-w-0">
              <span className={labelCls}>Home team</span>
              <input
                name="newHome"
                required
                value={home}
                onChange={(e) => setHome(e.target.value)}
                placeholder="e.g. Baylor"
                className={inputCls}
              />
            </label>
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            {away.trim() && home.trim() ? (
              <>
                Creates:{" "}
                <span className="font-semibold text-[var(--text)]">
                  {away.trim()} @ {home.trim()}
                </span>{" "}
                <span className="text-[var(--text-tertiary)]">(away @ home)</span>
              </>
            ) : (
              <span className="text-[var(--text-tertiary)]">
                Teams are written away @ home.
              </span>
            )}
          </p>
        </div>
      )}

      <AdminSubmitButton>Post question</AdminSubmitButton>
    </form>
  );
}

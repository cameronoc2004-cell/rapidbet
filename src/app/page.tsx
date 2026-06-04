import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, games, questions } from "@/db/schema";
import { EventList, type EventListItem } from "@/components/event-list";
import { RefreshButton } from "@/components/refresh-button";
import { requireOnboarded } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireOnboarded();
  // Find every game that has at least one open question.
  const rows = await db
    .select({
      gameId: games.id,
      league: games.league,
      homeTeam: games.homeTeam,
      awayTeam: games.awayTeam,
      startsAt: games.startsAt,
      gameStatus: games.status,
      openQuestions: sql<number>`count(*) filter (where ${questions.status} = 'open')::int`,
    })
    .from(games)
    .innerJoin(questions, eq(questions.gameId, games.id))
    .where(eq(questions.status, "open"))
    .groupBy(games.id)
    .orderBy(asc(games.startsAt));

  // Players-in count per game = distinct entrants across all its open questions.
  const gameIds = rows.map((r) => r.gameId);
  const playersByGame = new Map<number, number>();
  if (gameIds.length > 0) {
    const counts = await db
      .select({
        gameId: questions.gameId,
        playersIn: sql<number>`count(distinct ${entries.userId})::int`,
      })
      .from(entries)
      .innerJoin(questions, eq(entries.questionId, questions.id))
      .where(inArray(questions.gameId, gameIds))
      .groupBy(questions.gameId);
    for (const c of counts) playersByGame.set(c.gameId, c.playersIn);
  }

  const items: EventListItem[] = rows.map((r) => ({
    gameId: r.gameId,
    league: r.league,
    homeTeam: r.homeTeam,
    awayTeam: r.awayTeam,
    startsAt: r.startsAt.toISOString(),
    status: r.gameStatus as EventListItem["status"],
    liveLabel: r.gameStatus === "in_progress" ? "LIVE" : null,
    openQuestions: Number(r.openQuestions),
    playersIn: playersByGame.get(r.gameId) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <section className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text)]">
            Active events
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            One numeric prediction per question. Closest answer wins the pool.
          </p>
        </div>
        <RefreshButton label="Refresh events" />
      </section>

      <EventList items={items} />
    </div>
  );
}

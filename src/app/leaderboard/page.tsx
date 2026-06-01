import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles, skillScores } from "@/db/schema";
import { requireOnboarded } from "@/lib/session";

// Cumulative skill leaderboards. This page is product (a ladder players climb)
// AND a load-bearing piece of the legal posture: it surfaces repeat-skill
// performance and becomes the evidentiary record of skill predominance over
// chance. Do not remove without reading the project brief.

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  await requireOnboarded();
  const { scope = "season" } = await searchParams;
  const currentSeason = String(new Date().getUTCFullYear());

  // Season scope: only this year. All-time: all rows.
  const conditional = scope === "alltime"
    ? sql`TRUE`
    : sql`${skillScores.season} = ${currentSeason}`;

  const rows = await db
    .select({
      userId: skillScores.userId,
      username: profiles.username,
      totalPoints: sql<number>`coalesce(sum(${skillScores.pointsAwarded}), 0)::int`,
      questionsPlayed: sql<number>`count(${skillScores.id})::int`,
      avgPercentile: sql<number>`coalesce(avg(${skillScores.percentileRank}), 0)::float`,
    })
    .from(skillScores)
    .innerJoin(profiles, sql`${profiles.id} = ${skillScores.userId}`)
    .where(conditional)
    .groupBy(skillScores.userId, profiles.username)
    .orderBy(sql`coalesce(sum(${skillScores.pointsAwarded}), 0) DESC`)
    .limit(100);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Ranked by cumulative skill points across contests. Skill is independent
          of money won — it&apos;s based on how close your predictions are to the
          official result.
        </p>
      </header>

      <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-800">
        <Tab href="/leaderboard" active={scope !== "alltime"}>
          Season {currentSeason}
        </Tab>
        <Tab href="/leaderboard?scope=alltime" active={scope === "alltime"}>
          All-time
        </Tab>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-300 px-4 py-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No skill scores yet. Settle a contest to seed the leaderboard.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Player</th>
              <th className="py-2 pr-2 text-right">Points</th>
              <th className="py-2 pr-2 text-right">Contests</th>
              <th className="py-2 pr-2 text-right">Avg %ile</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.userId} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="py-2 pr-2 font-mono">{i + 1}</td>
                <td className="py-2 pr-2">@{r.username}</td>
                <td className="py-2 pr-2 text-right font-semibold">{r.totalPoints}</td>
                <td className="py-2 pr-2 text-right">{r.questionsPlayed}</td>
                <td className="py-2 pr-2 text-right">
                  {(Number(r.avgPercentile) * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
        active
          ? "border-neutral-900 text-neutral-900 dark:border-white dark:text-white"
          : "border-transparent text-neutral-500"
      }`}
    >
      {children}
    </Link>
  );
}

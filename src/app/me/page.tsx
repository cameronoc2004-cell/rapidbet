import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ledgerEntries, skillScores } from "@/db/schema";
import { getCurrentProfile } from "@/lib/session";
import { getWallet } from "@/db/wallet";
import { REAL_MONEY_ENABLED } from "@/lib/config";

export default async function MePage() {
  const me = await getCurrentProfile();
  if (!me) redirect("/login");

  const { virtualMinor, realMinor } = await getWallet(me.id);

  const ledger = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.userId, me.id))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(50);

  const skill = await db
    .select()
    .from(skillScores)
    .where(eq(skillScores.userId, me.id))
    .orderBy(desc(skillScores.createdAt));

  const totalPoints = skill.reduce((s, r) => s + r.pointsAwarded, 0);
  const avgPctile = skill.length > 0
    ? skill.reduce((s, r) => s + r.percentileRank, 0) / skill.length
    : 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">@{me.username}</h1>
        <p className="mt-1 text-sm text-neutral-500">Your wallet and skill history.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Virtual balance" value={`$${(virtualMinor / 100).toFixed(2)} VC`} />
        {REAL_MONEY_ENABLED ? (
          <Stat label="Real balance" value={`$${(realMinor / 100).toFixed(2)}`} />
        ) : (
          <Stat label="Real money" value="Disabled (Phase 1)" />
        )}
        <Stat label="Skill points" value={String(totalPoints)} />
      </section>

      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">Skill history</h2>
        <p className="mt-1 text-xs text-neutral-500">
          {skill.length} contests · avg percentile {(avgPctile * 100).toFixed(1)}%
        </p>
        {skill.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No settled entries yet.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {skill.slice(0, 20).map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>Q#{s.questionId} · err {s.absError.toFixed(2)}</span>
                <span className="font-mono text-neutral-500">
                  +{s.pointsAwarded} pts · {(s.percentileRank * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-lg font-semibold">Wallet ledger (last 50)</h2>
        {ledger.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No wallet activity yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="py-2 pr-2">When</th>
                <th className="py-2 pr-2">Reason</th>
                <th className="py-2 pr-2">Kind</th>
                <th className="py-2 pr-2 text-right">Δ</th>
                <th className="py-2 pr-2 text-right">After</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e) => (
                <tr key={e.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="py-2 pr-2 text-neutral-500">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-2">{e.reason}</td>
                  <td className="py-2 pr-2 text-neutral-500">{e.moneyKind}</td>
                  <td
                    className={`py-2 pr-2 text-right font-mono ${
                      e.deltaMinor >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-red-700 dark:text-red-400"
                    }`}
                  >
                    {e.deltaMinor >= 0 ? "+" : ""}
                    ${(e.deltaMinor / 100).toFixed(2)}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-neutral-500">
                    ${(e.balanceAfterMinor / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-0.5 text-base font-semibold">{value}</div>
    </div>
  );
}

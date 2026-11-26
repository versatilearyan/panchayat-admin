/**
 * Duo Dash (the two-player couple game): today's numbers, the couple ranking (this week / all time) with a way to
 * take a couple off it, and the latest finished levels. Results come from the Duo Dash game server only.
 * The on/off switch is on the Game modes page.
 */
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { useAdmin } from "../context";
import { Button, Card, Chips, Empty, Loading, PageHeader, fmtDate } from "../components/ui";

const base = "/api/v1/admin/manage/duo";
type Person = { id: string; name: string };
type Couple = { rank: number; a: Person; b: Person; bestLevel: number; levelsDone: number; stars: number; coins: number; coupleMoments: number };
type Result = { id: number; levelNo: number; stars: number; timeMs: number; coins: number; coupleMoments: number; createdAt: string; pair: string; nameA: string; nameB: string };

const time = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

export function DuoDashPage() {
  const { toast } = useAdmin();
  const [ov, setOv] = useState<Record<string, number> | null>(null);
  const [tab, setTab] = useState<"rank" | "results">("rank");
  const [period, setPeriod] = useState<"week" | "all">("week");
  const [rank, setRank] = useState<Couple[] | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);

  const load = useCallback(() => {
    apiRequest<Record<string, number>>(`${base}/overview`).then(setOv).catch(() => undefined);
    apiRequest<Couple[]>(`${base}/leaderboard?period=${period}`).then(setRank).catch(() => setRank([]));
    apiRequest<Result[]>(`${base}/results`).then(setResults).catch(() => setResults([]));
  }, [period]);
  useEffect(() => {
    load();
    const i = window.setInterval(load, 15000);
    return () => window.clearInterval(i);
  }, [load]);

  const remove = async (c: Couple) => {
    if (!window.confirm(`${c.a.name} & ${c.b.name} ko ranking se hatayein? Unki history bhi hat jayegi.`)) return;
    try {
      await apiRequest(`${base}/pairs/${Math.min(Number(c.a.id), Number(c.b.id))}:${Math.max(Number(c.a.id), Number(c.b.id))}`, { method: "DELETE" });
      toast("Couple removed");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't remove", "error");
    }
  };

  return (
    <>
      <PageHeader title="Duo Dash" sub="Couple game: live numbers, couple ranking (furthest level, then stars, then coins) aur latest finished levels. Results sirf game server se aate hain (cheat-proof)." />
      {ov ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            ["Couples (all time)", ov.couples],
            ["Couples today", ov.couplesToday],
            ["Levels done today", ov.levelsToday],
            ["Levels done (all)", ov.levelsAllTime],
            ["Furthest level", ov.furthestLevel],
            ["Couple moments", ov.coupleMoments],
          ].map(([k, v]) => (
            <Card key={String(k)}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</p>
              <p className="mt-1 text-2xl font-black">{String(v ?? 0)}</p>
            </Card>
          ))}
        </div>
      ) : (
        <Loading />
      )}
      <div className="mb-4">
        <Chips label="Section" value={tab} onChange={setTab} options={[{ value: "rank", label: "Couple ranking" }, { value: "results", label: "Latest results" }]} />
      </div>
      {tab === "rank" ? (
        <Card title="Couple ranking" action={<Chips label="Period" value={period} onChange={setPeriod} options={[{ value: "week", label: "This week" }, { value: "all", label: "All time" }]} />}>
          {!rank ? (
            <Loading />
          ) : rank.length === 0 ? (
            <Empty>Abhi koi couple nahi.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted">
                <tr>
                  <th className="py-2">#</th>
                  <th>Couple</th>
                  <th>Furthest level</th>
                  <th>Levels done</th>
                  <th>Stars</th>
                  <th>Coins</th>
                  <th>Moments</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rank.map((c) => (
                  <tr key={`${c.a.id}-${c.b.id}`} className="border-t border-line">
                    <td className="py-2 font-bold">{c.rank}</td>
                    <td>
                      {c.a.name} <span className="text-[#ff3d8b]">♥</span> {c.b.name} <span className="text-muted">#{c.a.id} #{c.b.id}</span>
                    </td>
                    <td className="font-bold">{c.bestLevel}</td>
                    <td>{c.levelsDone}</td>
                    <td>{c.stars}</td>
                    <td>{c.coins}</td>
                    <td>{c.coupleMoments}</td>
                    <td className="text-right">
                      <Button size="sm" variant="danger" onClick={() => void remove(c)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        <Card title="Latest finished levels">
          {!results ? (
            <Loading />
          ) : results.length === 0 ? (
            <Empty>Abhi koi result nahi.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted">
                <tr>
                  <th className="py-2">When</th>
                  <th>Couple</th>
                  <th>Level</th>
                  <th>Stars</th>
                  <th>Time</th>
                  <th>Coins</th>
                  <th>Moments</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="py-2">{fmtDate(new Date(r.createdAt).getTime())}</td>
                    <td>
                      {r.nameA} <span className="text-[#ff3d8b]">♥</span> {r.nameB}
                    </td>
                    <td>{r.levelNo}</td>
                    <td>{r.stars}</td>
                    <td>{time(r.timeMs)}</td>
                    <td>{r.coins}</td>
                    <td>{r.coupleMoments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
      <p className="mt-6 text-xs text-muted">Game ko band/chalu karne ka switch Game modes page par hai (Duo Dash).</p>
    </>
  );
}

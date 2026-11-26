/**
 * Game Modes, live: how many people are playing each game right now, and a switch to turn a game off or on.
 * Reads /api/v1/admin/manage/games/live every few seconds.
 */
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { useAdmin } from "../context";
import { Badge, Button, Card, ErrorNote, Loading, PageHeader } from "../components/ui";

type Row = { id: string; name: string; tables: number | null; players: number | null; inPlay: number | null; bots?: number; enabled: boolean };
type Live = { games: Row[]; updatedAt: number };

const EMOJI: Record<string, string> = { GADDAR: "🛖", RMCS: "👑", LUDO: "🎲", JACKAROO: "🃏", HILL: "🚙", DUO: "💞" };
const base = "/api/v1/admin/manage/games";

export function GamesPage() {
  const { toast } = useAdmin();
  const [data, setData] = useState<Live | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    apiRequest<Live>(`${base}/live`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the games."));
  }, []);
  useEffect(() => {
    load();
    const i = window.setInterval(load, 5000);
    return () => window.clearInterval(i);
  }, [load]);

  const flip = async (g: Row) => {
    setBusy(g.id);
    try {
      await apiRequest(`${base}/${g.id}/enabled`, { method: "PUT", body: { enabled: !g.enabled } });
      toast(`${g.name} ${g.enabled ? "band kar diya" : "chalu kar diya"}`);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't change it.");
    } finally {
      setBusy(null);
    }
  };

  const totalPlayers = (data?.games ?? []).reduce((s, g) => s + (g.players ?? 0), 0);
  return (
    <>
      <PageHeader title="Game modes" sub="Kitne log kaunsa game khel rahe hain, abhi. Har 5 second me badalta hai. Switch se koi bhi game band ya chalu karo." />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Log khel rahe hain (Gaddaar + Raja Mantri)</p>
              <p className="mt-1 text-3xl font-black">{totalPlayers}</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Khule tables / games</p>
              <p className="mt-1 text-3xl font-black">{data.games.reduce((s, g) => s + (g.tables ?? 0), 0)}</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Abhi chal rahe</p>
              <p className="mt-1 text-3xl font-black">{data.games.reduce((s, g) => s + (g.inPlay ?? 0), 0)}</p>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.games.map((g) => (
              <Card key={g.id} className={g.enabled ? "" : "opacity-70"}>
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-2xl" aria-hidden>
                    {EMOJI[g.id] ?? "🎮"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{g.name}</p>
                    <Badge tone={g.enabled ? "ok" : "muted"}>{g.enabled ? "On" : "Off"}</Badge>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <dt className="text-[11px] uppercase text-muted">Players</dt>
                    <dd className="text-xl font-black">{g.players ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-muted">Tables</dt>
                    <dd className="text-xl font-black">{g.tables ?? 0}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-muted">Chal rahe</dt>
                    <dd className="text-xl font-black">{g.inPlay ?? 0}</dd>
                  </div>
                </dl>
                {g.bots !== undefined ? <p className="mt-2 text-xs text-muted">{g.bots} bots table bhar rahe hain</p> : null}
                {g.id === "GADDAR" || g.id === "RMCS" || g.id === "HILL" ? (
                  <Button className="mt-4 w-full" variant={g.enabled ? "soft" : "primary"} busy={busy === g.id} onClick={() => void flip(g)}>
                    {g.enabled ? "Band karo" : "Chalu karo"}
                  </Button>
                ) : (
                  <p className="mt-4 text-xs text-muted">Ye game room ke table me chalta hai.</p>
                )}
              </Card>
            ))}
          </div>
          <HillSettings />
        </>
      )}
    </>
  );
}

type HillCfg = { dailyCap: number; runCap: number; coinBig: number; coinSmall: number };
type HillData = { settings: HillCfg; stats: { runsToday: number; playersToday: number; coinsToday: number; coinsTotal: number } };

/** Pahadi Daud: how many coins a person can take home, and the two coin values on the road. */
function HillSettings() {
  const { toast } = useAdmin();
  const [d, setD] = useState<HillData | null>(null);
  const [f, setF] = useState<HillCfg | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    apiRequest<HillData>(`${base}/hill`)
      .then((r) => {
        setD(r);
        setF(r.settings);
      })
      .catch(() => undefined);
  }, []);
  if (!d || !f) return null;
  const num = (k: keyof HillCfg, v: string) => setF({ ...f, [k]: Number(v) || 0 });
  const save = async () => {
    setBusy(true);
    try {
      const r = await apiRequest<HillData>(`${base}/hill/settings`, { method: "PUT", body: f });
      setD(r);
      setF(r.settings);
      toast("Pahadi Daud save ho gaya");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-5">
      <Card title="🚙 Pahadi Daud (solo game): coins">
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block text-sm font-semibold">
            Roz ki limit (coins)
            <input className="field mt-1" type="number" min={0} value={f.dailyCap} onChange={(e) => num("dailyCap", e.target.value)} />
          </label>
          <label className="block text-sm font-semibold">
            Ek run ki limit
            <input className="field mt-1" type="number" min={0} value={f.runCap} onChange={(e) => num("runCap", e.target.value)} />
          </label>
          <label className="block text-sm font-semibold">
            Bada coin
            <input className="field mt-1" type="number" min={0} value={f.coinBig} onChange={(e) => num("coinBig", e.target.value)} />
          </label>
          <label className="block text-sm font-semibold">
            Chhota coin
            <input className="field mt-1" type="number" min={0} value={f.coinSmall} onChange={(e) => num("coinSmall", e.target.value)} />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">
          Sadak par coin {f.coinBig}, {f.coinSmall}, {f.coinBig}, {f.coinSmall}... ke kram me hain. Jo coins user uthata hai wo run khatam hote hi seedha uske wallet me jata hai (server sach check karta hai). Aaj: {d.stats.playersToday} players, {d.stats.runsToday} runs, {d.stats.coinsToday.toLocaleString("en-IN")} coins diye. Ab tak {d.stats.coinsTotal.toLocaleString("en-IN")} coins.
        </p>
        <Button className="mt-3" variant="primary" busy={busy} onClick={() => void save()}>
          Save
        </Button>
      </Card>
    </div>
  );
}

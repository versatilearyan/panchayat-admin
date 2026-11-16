/**
 * Daily rewards: the daily red packet from Sarpanch and the locked prize (opens after N active days), for every user.
 * Everything is set here and nothing happens until you switch it on. Reads /api/v1/admin/manage/daily-gifts.
 */
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Button, Card, ErrorNote, Loading, PageHeader, Toggle } from "../components/ui";

type Settings = { enabled: boolean; dailyCoins: number; bonusEnabled: boolean; bonusCoins: number; bonusDays: number; bonusActiveMinutes: number };
type Stats = { claimedToday: number; coinsToday: number; claimedTotal: number; coinsTotal: number; activeToday: number; countedToday: number; inProgress: number; unlocked: number; prizeClaimed: number; prizeCoinsPaid: number };
type Data = { settings: Settings; stats: Stats };

const base = "/api/v1/admin/manage/daily-gifts";
const fmt = (n: number) => n.toLocaleString("en-IN");

export function DailyRewardsPage() {
  const { toast } = useAdmin();
  const [data, setData] = useState<Data | null>(null);
  const [f, setF] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiRequest<Data>(base)
      .then((d) => {
        setData(d);
        setF((cur) => cur ?? d.settings);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load."));
  }, []);
  useEffect(() => {
    load();
    const i = window.setInterval(load, 15000);
    return () => window.clearInterval(i);
  }, [load]);

  const save = async (patch?: Partial<Settings>) => {
    if (!f) return;
    const body = { ...f, ...patch };
    setBusy(true);
    try {
      const d = await apiRequest<Data>(`${base}/settings`, { method: "PUT", body });
      setData(d);
      setF(d.settings);
      toast("Save ho gaya");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  if (!data || !f) return error ? <ErrorNote>{error}</ErrorNote> : <Loading />;
  const st = data.stats;
  const num = (k: keyof Settings, v: string) => setF({ ...f, [k]: Number(v) || 0 });
  return (
    <>
      <PageHeader title="Daily rewards" sub="Roz ka red packet (Sarpanch ji ki chat me) aur 7 din ka locked prize. Switch ON karte hi sab users ke liye chalu." />
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="🧧 Daily red packet">
          <Toggle checked={f.enabled} onChange={(v) => void save({ enabled: v })} label="Chalu hai" hint="ON hote hi har user ko din me ek baar Sarpanch ka red packet message milega." />
          <label className="mt-4 block text-sm font-semibold">
            Roz kitne coins
            <input className="field mt-1" type="number" min={0} value={f.dailyCoins} onChange={(e) => num("dailyCoins", e.target.value)} />
          </label>
          <p className="mt-2 text-xs text-muted">Aaj {fmt(st.claimedToday)} logon ne khola ({fmt(st.coinsToday)} coins). Ab tak {fmt(st.claimedTotal)} baar, {fmt(st.coinsTotal)} coins.</p>
        </Card>

        <Card title="🔒 Locked prize (7 din ka inaam)">
          <Toggle checked={f.bonusEnabled} onChange={(v) => void save({ bonusEnabled: v })} label="Chalu hai" hint="ON hote hi sab users ke liye din gine jate hain, aur Sarpanch roz yaad dilata hai." />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <label className="block text-sm font-semibold">
              Prize coins
              <input className="field mt-1" type="number" min={0} value={f.bonusCoins} onChange={(e) => num("bonusCoins", e.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Kitne din
              <input className="field mt-1" type="number" min={1} max={60} value={f.bonusDays} onChange={(e) => num("bonusDays", e.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Roz active (min)
              <input className="field mt-1" type="number" min={1} max={1000} value={f.bonusActiveMinutes} onChange={(e) => num("bonusActiveMinutes", e.target.value)} />
            </label>
          </div>
          <p className="mt-2 text-xs text-muted">
            Din tab ginta hai jab user us din {f.bonusActiveMinutes} minute app me rahe. {f.bonusDays} din poore hone par prize khulta hai (din lagataar hone zaroori nahi). Aaj {fmt(st.countedToday)} logon ka din poora hua, {fmt(st.activeToday)} aaj active hain.
          </p>
          <p className="mt-1 text-xs text-muted">
            Progress me: {fmt(st.inProgress)} · Khul gaya: {fmt(st.unlocked)} · Le liya: {fmt(st.prizeClaimed)} ({fmt(st.prizeCoinsPaid)} coins)
          </p>
        </Card>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button variant="primary" busy={busy} onClick={() => void save()}>
          Save
        </Button>
        <p className="text-xs text-muted">Coins ya din badalne ke baad Save dabao. Switch ka asar turant hota hai.</p>
      </div>
    </>
  );
}

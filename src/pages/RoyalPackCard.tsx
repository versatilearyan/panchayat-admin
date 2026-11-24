/**
 * Royal Pack (live backend), on the Manual top-ups page: a special pack sold ONLY through Munshi ji (manual UPI top-up).
 * Buying it gives the pack's coins, the Royal frame with a name the buyer writes (up to 14 letters) on its plate,
 * the Royal Nawab title, and Panchayat King (male) or Panchayat Queen (female).
 * Here: price, coins, which frame and titles, how many days they last, and the frame's size and plate.
 */
import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Button, Card, ErrorNote, Loading, Toggle, fmtCoins } from "../components/ui";
import { frameSrc } from "./NameFrames";

type RoyalFrame = { id: string; name: string; imageUrl: string; scale: number; y: number; size: number; plateX: number; plateY: number; plateW: number; plateH: number; color: string; stroke: string };
type RoyalTitle = { id: string; name: string; colorFrom: string; colorTo: string; textColor: string };
type Royal = {
  enabled: boolean;
  name: string;
  priceInr: number;
  coins: number;
  frameId: string | null;
  frameDays: number;
  titleDays: number;
  nawabTitleId: string | null;
  kingTitleId: string | null;
  queenTitleId: string | null;
  badge: string;
  frame: RoyalFrame | null;
  nawab: RoyalTitle | null;
  king: RoyalTitle | null;
  queen: RoyalTitle | null;
  sold: number;
};
type FrameOpt = { id: number; name: string };
type TitleOpt = { id: number | string; name: string };
type Form = { enabled: boolean; name: string; priceInr: string; coins: string; frameId: string; frameDays: string; titleDays: string; nawabTitleId: string; kingTitleId: string; queenTitleId: string; badge: string };
type Fit = { frameScale: number; displaySize: number; frameY: number; plateX: number; plateY: number; plateW: number; plateH: number; textColor: string; strokeColor: string };

const base = "/api/v1/admin/manage/manual-topups/royal";
const msg = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);
const crore = (n: number) => (n >= 1e7 ? `${+(n / 1e7).toFixed(2)} crore` : n >= 1e5 ? `${+(n / 1e5).toFixed(2)} lakh` : fmtCoins(n));

const toForm = (r: Royal): Form => ({
  enabled: r.enabled,
  name: r.name,
  priceInr: String(r.priceInr),
  coins: String(r.coins),
  frameId: r.frameId ?? "",
  frameDays: String(r.frameDays),
  titleDays: String(r.titleDays),
  nawabTitleId: r.nawabTitleId ?? "",
  kingTitleId: r.kingTitleId ?? "",
  queenTitleId: r.queenTitleId ?? "",
  badge: r.badge,
});
const toFit = (f: RoyalFrame): Fit => ({ frameScale: f.scale, displaySize: f.size, frameY: f.y, plateX: f.plateX, plateY: f.plateY, plateW: f.plateW, plateH: f.plateH, textColor: f.color, strokeColor: f.stroke });

function Pill({ t }: { t: RoyalTitle | null }) {
  if (!t) return <span className="text-xs text-muted">none</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-white/25" style={{ background: `linear-gradient(90deg, ${t.colorFrom}, ${t.colorTo})`, color: t.textColor }}>
      ★ {t.name}
    </span>
  );
}

/** The frame on a seat-sized avatar and a big one, with a sample name: the same maths the app uses. */
function FramePreview({ url, fit, name }: { url: string; fit: Fit; name: string }) {
  const one = (box: number) => {
    const w = box * fit.displaySize;
    const avatar = Math.round(w / fit.frameScale);
    const pw = (w * fit.plateW) / 100;
    const ph = (w * fit.plateH) / 100;
    const fs = Math.max(6, Math.min(ph * 0.62, (pw / Math.max(3, name.length)) * 1.7));
    const drop = Math.max(0, Math.round(w * (1 - fit.frameY) - box / 2 - box * 0.12));
    return (
      <span className="relative grid place-items-center" style={{ width: box, height: box, marginBottom: drop }}>
        <span className="relative grid place-items-center" style={{ width: avatar, height: avatar }}>
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-[#3a5bd9] to-[#c34d8f]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={frameSrc(url)} alt="" className="pointer-events-none absolute left-1/2 top-1/2 max-w-none" style={{ width: w, height: w, transform: `translate(-50%, -${fit.frameY * 100}%)` }} />
          <span className="pointer-events-none absolute left-1/2 top-1/2" style={{ width: w, height: w, transform: `translate(-50%, -${fit.frameY * 100}%)` }}>
            <span
              className="absolute grid place-items-center overflow-hidden whitespace-nowrap text-center font-black leading-none"
              style={{ left: `${fit.plateX}%`, top: `${fit.plateY}%`, width: `${fit.plateW}%`, height: `${fit.plateH}%`, color: fit.textColor, fontSize: fs, WebkitTextStroke: `${Math.max(0.5, fs * 0.08)}px ${fit.strokeColor}`, paintOrder: "stroke fill" }}
            >
              {name}
            </span>
          </span>
        </span>
      </span>
    );
  };
  return (
    <div className="flex shrink-0 flex-col items-center gap-3 rounded-2xl bg-[radial-gradient(120%_90%_at_50%_0%,#3a1d6e_0%,#1b0f33_55%,#0f0a1c_100%)] px-6 pb-4 pt-10 ring-1 ring-line" style={{ width: 280 }}>
      {one(120)}
      <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted">On a seat (58 px)</p>
      <div className="pt-2">{one(58)}</div>
    </div>
  );
}

export function RoyalPackCard() {
  const { toast } = useAdmin();
  const [saved, setSaved] = useState<Royal | null>(null);
  const [f, setF] = useState<Form | null>(null);
  const [fit, setFit] = useState<Fit | null>(null);
  const [frames, setFrames] = useState<FrameOpt[]>([]);
  const [titles, setTitles] = useState<TitleOpt[]>([]);
  const [sample, setSample] = useState("Bharat Raja");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = (r: Royal) => {
    setSaved(r);
    setF(toForm(r));
    setFit(r.frame ? toFit(r.frame) : null);
  };
  useEffect(() => {
    apiRequest<Royal>(base).then(apply).catch((e) => setError(msg(e, "Couldn't load the Royal Pack.")));
    apiRequest<FrameOpt[]>("/api/v1/admin/name-frames").then(setFrames).catch(() => setFrames([]));
    apiRequest<{ titles: TitleOpt[] }>("/api/v1/admin/titles").then((d) => setTitles(d.titles ?? [])).catch(() => setTitles([]));
  }, []);

  const save = async () => {
    if (!f) return;
    setBusy(true);
    try {
      const r = await apiRequest<Royal>(base, { method: "PUT", body: { ...f, priceInr: f.priceInr.trim(), coins: f.coins.trim() } });
      // The frame's size and plate are the frame's own settings (the same as on the Name frames page)
      if (fit && r.frameId) await apiRequest(`/api/v1/admin/name-frames/${r.frameId}`, { method: "PATCH", body: fit });
      apply(await apiRequest<Royal>(base));
      setError(null);
      toast("Royal Pack saved");
    } catch (e) {
      toast(msg(e, "Couldn't save"), "error");
    } finally {
      setBusy(false);
    }
  };

  if (error && !saved) return <ErrorNote>{error}</ErrorNote>;
  if (!saved || !f) return <Loading />;
  const set = (k: keyof Form, v: string | boolean) => setF((x) => (x ? { ...x, [k]: v } : x));
  const coinsN = Number(f.coins) || 0;
  const titleSelect = (k: "nawabTitleId" | "kingTitleId" | "queenTitleId", label: string, hint: string) => (
    <label className="block text-sm font-semibold">
      {label}
      <select className="field mt-1" value={f[k]} onChange={(e) => set(k, e.target.value)}>
        <option value="">None</option>
        {titles.map((t) => (
          <option key={t.id} value={String(t.id)}>
            {t.name}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>
    </label>
  );
  const fitNum = (k: keyof Fit, label: string, hint?: string) => (
    <label className="text-xs font-semibold">
      {label}
      <input className="field mt-1 h-9 w-full" type="number" step="any" value={String(fit?.[k] ?? "")} onChange={(e) => setFit((x) => (x ? { ...x, [k]: Number(e.target.value) } : x))} />
      {hint ? <span className="mt-0.5 block font-normal text-muted">{hint}</span> : null}
    </label>
  );

  return (
    <Card
      className="mt-5"
      title={
        <span className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-gold" aria-hidden /> Royal Pack · only through {`Munshi ji`}
          <Badge tone="ok">{saved.sold} sold</Badge>
        </span>
      }
    >
      <div className="flex flex-col gap-5 p-4 lg:flex-row">
        <div className="space-y-2">
          {saved.frame && fit ? <FramePreview url={saved.frame.imageUrl} fit={fit} name={Array.from(sample).slice(0, 14).join("") || " "} /> : <p className="text-xs text-muted">Choose a frame to see it.</p>}
          <label className="block text-xs font-semibold">
            Sample name (preview only)
            <input className="field mt-1 h-9" maxLength={14} value={sample} onChange={(e) => setSample(e.target.value)} />
          </label>
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <Toggle checked={f.enabled} onChange={(v) => set("enabled", v)} label="Sell the Royal Pack" hint="Shown highlighted at the top of the wallet's coin box, and in Munshi ji's sheet. Only when Munshi ji's UPI top-up (above) is on too. Never through the payment gateway." />
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-semibold">
              Pack name
              <input className="field mt-1" maxLength={40} value={f.name} onChange={(e) => set("name", e.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Price (₹)
              <input className="field mt-1" inputMode="decimal" value={f.priceInr} onChange={(e) => set("priceInr", e.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Coins
              <input className="field mt-1" inputMode="numeric" value={f.coins} onChange={(e) => set("coins", e.target.value.replace(/[^0-9]/g, ""))} />
              <span className="mt-1 block text-xs font-normal text-muted">= {crore(coinsN)} coins</span>
            </label>
            <label className="block text-sm font-semibold">
              Ribbon on the card
              <input className="field mt-1" maxLength={24} value={f.badge} onChange={(e) => set("badge", e.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Frame
              <select className="field mt-1" value={f.frameId} onChange={(e) => set("frameId", e.target.value)}>
                <option value="">None (pack can't be sold)</option>
                {frames.map((x) => (
                  <option key={x.id} value={String(x.id)}>
                    {x.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-muted">The picture is changed on the Name frames page.</span>
            </label>
            <label className="block text-sm font-semibold">
              Frame lasts (days)
              <input className="field mt-1" inputMode="numeric" value={f.frameDays} onChange={(e) => set("frameDays", e.target.value.replace(/[^0-9]/g, ""))} />
              <span className="mt-1 block text-xs font-normal text-muted">0 = for ever. Buying again adds the time.</span>
            </label>
            {titleSelect("nawabTitleId", "Title for everyone", "Default: Royal Nawab")}
            {titleSelect("kingTitleId", "Title for men", "Default: Panchayat King")}
            {titleSelect("queenTitleId", "Title for women", "Default: Panchayat Queen")}
            <label className="block text-sm font-semibold">
              Titles last (days)
              <input className="field mt-1" inputMode="numeric" value={f.titleDays} onChange={(e) => set("titleDays", e.target.value.replace(/[^0-9]/g, ""))} />
              <span className="mt-1 block text-xs font-normal text-muted">0 = for ever.</span>
            </label>
          </div>
          <p className="text-xs text-muted">
            Now giving: <Pill t={saved.nawab} /> + <Pill t={saved.king} /> or <Pill t={saved.queen} /> (by the buyer&apos;s gender; someone with no gender set picks one).
          </p>
          {fit ? (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Frame size and name plate</p>
              <div className="grid gap-3 sm:grid-cols-4">
                {fitNum("displaySize", "Size on the seat", "Frame width ÷ seat (VIP 1.45)")}
                {fitNum("frameScale", "Frame ÷ avatar", "Bigger = smaller avatar")}
                {fitNum("frameY", "Avatar centre", "0 to 1, down the frame")}
                <span />
                {fitNum("plateX", "Plate left %")}
                {fitNum("plateY", "Plate top %")}
                {fitNum("plateW", "Plate width %")}
                {fitNum("plateH", "Plate height %")}
                <label className="text-xs font-semibold">
                  Name colour
                  <input type="color" className="mt-1 block h-9 w-16" value={fit.textColor} onChange={(e) => setFit({ ...fit, textColor: e.target.value })} />
                </label>
                <label className="text-xs font-semibold">
                  Name outline
                  <input type="color" className="mt-1 block h-9 w-16" value={fit.strokeColor} onChange={(e) => setFit({ ...fit, strokeColor: e.target.value })} />
                </label>
              </div>
            </div>
          ) : null}
          <Button variant="primary" busy={busy} onClick={() => void save()}>
            Save Royal Pack
          </Button>
        </div>
      </div>
    </Card>
  );
}

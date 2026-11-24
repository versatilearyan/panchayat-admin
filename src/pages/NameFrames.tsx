/**
 * Name frames (live backend): an avatar frame with a name plate that shows the wearer's account name.
 * The admin uploads the frame picture (PNG / WEBP with a see-through middle), tunes how it fits the avatar and where the name goes,
 * sets the top-up amount that gives it automatically (with days), or gives it to one person.
 */
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Upload, UserMinus } from "lucide-react";
import { BACKEND_ENABLED, USER_APP_URL } from "../config/api";
import { useAdmin } from "../context";
import { apiRequest, apiUpload } from "../lib/api";
import { Badge, Button, Card, Empty, Loading, PageHeader, Toggle } from "../components/ui";
import { NeedsBackend } from "../components/WalletParts";
import { UserPicker } from "./RoomsLive";

const base = "/api/v1/admin/name-frames";
type Rule = { id: number; kind: "TOPUP_TOTAL" | "TOPUP_ONE"; value: number; days: number; active: boolean };
type Frame = {
  id: number;
  name: string;
  imageUrl: string | null;
  frameScale: number;
  frameY: number;
  displaySize: number;
  plateX: number;
  plateY: number;
  plateW: number;
  plateH: number;
  textColor: string;
  strokeColor: string;
  active: boolean;
  holders: number;
  rules: Rule[];
};
type Holder = { userId: number; publicId?: number; name: string; expiresAt: string | null; equipped: boolean };
/** A picture the website ships (/frames/...) lives on the user app, not here. */
export const frameSrc = (u: string | null) => (u && u.startsWith("/frames/") ? USER_APP_URL + u : u ?? "");
const msg = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);
const KIND: Record<string, string> = { TOPUP_TOTAL: "Total top-up", TOPUP_ONE: "Single top-up" };

export function NameFramesPage() {
  if (!BACKEND_ENABLED) return <NeedsBackend what="Name frames" />;
  return <Live />;
}

function Live() {
  const { toast, can } = useAdmin();
  const canSave = can("users.view");
  const [list, setList] = useState<Frame[] | null>(null);
  const [newName, setNewName] = useState("");
  const load = useCallback(() => {
    apiRequest<Frame[]>(base).then(setList).catch(() => setList([]));
  }, []);
  useEffect(load, [load]);
  const add = async () => {
    try {
      await apiRequest(base, { method: "POST", body: { name: newName } });
      setNewName("");
      toast("Frame added. Now upload its picture.");
      load();
    } catch (e) {
      toast(msg(e, "Couldn't add"), "error");
    }
  };
  return (
    <>
      <PageHeader title="Name frames" sub="An avatar frame with a name plate. The plate shows the wearer's own account name. Give it by top-up amount, or to one person." />
      {canSave ? (
        <Card title="Add a frame" className="mb-4">
          <div className="flex flex-wrap items-end gap-2 p-4">
            <label className="min-w-[220px] flex-1 text-xs font-semibold">
              Name
              <input className="field mt-1 h-10" value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} placeholder="Crown frame" />
            </label>
            <Button variant="gold" disabled={!newName.trim()} onClick={() => void add()}>
              <Plus className="h-4 w-4" /> Add frame
            </Button>
          </div>
        </Card>
      ) : null}
      {!list ? <Loading /> : !list.length ? <Empty>No name frames yet.</Empty> : list.map((f) => <FrameCard key={f.id} f={f} canSave={canSave} onChanged={load} />)}
    </>
  );
}

function Preview({ f }: { f: Frame }) {
  // The frame over a sample avatar, with the plate text, the same way the app draws it
  const size = 200;
  const w = size * f.frameScale;
  return (
    <div className="relative grid shrink-0 place-items-center rounded-2xl bg-ink ring-1 ring-line" style={{ width: 260, height: 300 }}>
      <div className="relative" style={{ width: size, height: size, marginTop: 10 }}>
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-[#3a5bd9] to-[#c34d8f]" />
        {f.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frameSrc(f.imageUrl)} alt="" className="pointer-events-none absolute left-1/2 top-1/2 max-w-none" style={{ width: w, height: w, transform: `translate(-50%, -${f.frameY * 100}%)` }} />
            <span className="pointer-events-none absolute left-1/2 top-1/2" style={{ width: w, height: w, transform: `translate(-50%, -${f.frameY * 100}%)` }}>
              <span
                className="absolute grid place-items-center overflow-hidden whitespace-nowrap text-center font-black leading-none"
                style={{ left: `${f.plateX}%`, top: `${f.plateY}%`, width: `${f.plateW}%`, height: `${f.plateH}%`, color: f.textColor, fontSize: (w * f.plateH) / 100 * 0.6, WebkitTextStroke: `1.2px ${f.strokeColor}`, paintOrder: "stroke fill" }}
              >
                Harshit
              </span>
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function FrameCard({ f, canSave, onChanged }: { f: Frame; canSave: boolean; onChanged: () => void }) {
  const { toast } = useAdmin();
  const [d, setD] = useState(f);
  const [holders, setHolders] = useState<Holder[] | null>(null);
  const [days, setDays] = useState(0);
  const [rk, setRk] = useState<"TOPUP_TOTAL" | "TOPUP_ONE">("TOPUP_TOTAL");
  const [rv, setRv] = useState("");
  const [rd, setRd] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => setD(f), [f]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      onChanged();
    } catch (e) {
      toast(msg(e, "Couldn't do that"), "error");
    } finally {
      setBusy(false);
    }
  };
  const num = (k: keyof Frame, label: string, hint?: string, step = "any") => (
    <label className="text-xs font-semibold">
      {label}
      <input className="field mt-1 h-9 w-full" type="number" step={step} value={String(d[k] ?? "")} onChange={(e) => setD({ ...d, [k]: Number(e.target.value) })} disabled={!canSave} />
      {hint ? <span className="mt-0.5 block font-normal text-muted">{hint}</span> : null}
    </label>
  );
  const save = () =>
    run(
      () =>
        apiRequest(`${base}/${f.id}`, {
          method: "PATCH",
          body: { name: d.name, frameScale: d.frameScale, displaySize: d.displaySize, frameY: d.frameY, plateX: d.plateX, plateY: d.plateY, plateW: d.plateW, plateH: d.plateH, textColor: d.textColor, strokeColor: d.strokeColor },
        }),
      "Saved",
    );
  const loadHolders = () => apiRequest<Holder[]>(`${base}/${f.id}/holders`).then(setHolders).catch(() => setHolders([]));
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await apiUpload(`${base}/${f.id}/image`, form).promise;
      toast("Picture saved");
      onChanged();
    } catch (e) {
      toast(msg(e, "Couldn't upload"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title={`${f.name} · ${f.holders} holder${f.holders === 1 ? "" : "s"}`}
      className="mb-4"
      action={
        canSave ? (
          <span className="flex items-center gap-3">
            <Toggle checked={f.active} onChange={(on) => void run(() => apiRequest(`${base}/${f.id}`, { method: "PATCH", body: { active: on } }), on ? "Switched on" : "Switched off")} label={f.active ? "On" : "Off"} />
            <Button size="sm" variant="danger" onClick={() => window.confirm(`Delete “${f.name}”? If people hold it, it is only switched off.`) && void run(() => apiRequest(`${base}/${f.id}`, { method: "DELETE" }), "Done")} aria-label="Delete frame">
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </span>
        ) : null
      }
    >
      <div className="flex flex-col gap-4 p-4 lg:flex-row">
        <Preview f={d} />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-gold">
              <Upload className="h-4 w-4" aria-hidden /> {f.imageUrl ? "Change picture" : "Upload picture"} (PNG / WEBP, see-through middle)
              <input type="file" accept="image/png,image/webp,image/gif" className="sr-only" disabled={!canSave || busy} onChange={(e) => void upload(e.target.files?.[0])} />
            </label>
            {!f.imageUrl ? <Badge tone="muted">No picture yet</Badge> : null}
          </div>
          {canSave ? (
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="text-xs font-semibold sm:col-span-2">
                Name
                <input className="field mt-1 h-9 w-full" value={d.name} maxLength={40} onChange={(e) => setD({ ...d, name: e.target.value })} />
              </label>
              {num("frameScale", "Frame size", "Frame width ÷ avatar width (about 1.4)")}
              {num("frameY", "Avatar centre", "How far down the frame the avatar sits (0 to 1)")}
              {num("displaySize", "Size on the seat", "How big the frame is drawn around a seat / profile picture (1 to 3; VIP frames 1.45)")}
              {num("plateX", "Plate left %", undefined)}
              {num("plateY", "Plate top %", undefined)}
              {num("plateW", "Plate width %", undefined)}
              {num("plateH", "Plate height %", undefined)}
              <label className="text-xs font-semibold">
                Name colour
                <input type="color" className="mt-1 block h-9 w-16" value={d.textColor} onChange={(e) => setD({ ...d, textColor: e.target.value })} />
              </label>
              <label className="text-xs font-semibold">
                Name outline
                <input type="color" className="mt-1 block h-9 w-16" value={d.strokeColor} onChange={(e) => setD({ ...d, strokeColor: e.target.value })} />
              </label>
              <div className="flex items-end sm:col-span-2">
                <Button variant="gold" busy={busy} onClick={() => void save()}>
                  Save changes
                </Button>
              </div>
            </div>
          ) : null}

          <div>
            <p className="label">Given automatically</p>
            {!f.rules.length ? <p className="mb-2 text-xs text-muted">No rule yet. Add a top-up amount below.</p> : null}
            <ul className="mb-2 divide-y divide-line text-sm">
              {f.rules.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-1.5">
                  <Badge tone="gold">{KIND[r.kind]}</Badge>
                  <span>₹{r.value.toLocaleString("en-IN")} or more</span>
                  <span className="text-xs text-muted">{r.days === 0 ? "never ends" : `${r.days} days, renewed on every top-up`}</span>
                  {canSave ? (
                    <Button size="sm" variant="danger" className="ml-auto" onClick={() => void run(() => apiRequest(`${base}/${f.id}/rules/${r.id}`, { method: "DELETE" }), "Rule removed")}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {canSave ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs font-semibold text-muted">
                  Rule
                  <select className="field mt-1 h-9 w-40 py-1" value={rk} onChange={(e) => setRk(e.target.value as typeof rk)}>
                    <option value="TOPUP_TOTAL">Total top-up (₹)</option>
                    <option value="TOPUP_ONE">Single top-up (₹)</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted">
                  Rupees
                  <input className="field mt-1 h-9 w-28" inputMode="numeric" value={rv} onChange={(e) => setRv(e.target.value.replace(/\D/g, ""))} placeholder="10000" />
                </label>
                <label className="text-xs font-semibold text-muted">
                  Days (0 = never ends)
                  <input className="field mt-1 h-9 w-28" inputMode="numeric" value={rd} onChange={(e) => setRd(Number(e.target.value.replace(/\D/g, "")) || 0)} />
                </label>
                <Button variant="gold" disabled={!rv} onClick={() => void run(async () => { await apiRequest(`${base}/${f.id}/rules`, { method: "POST", body: { kind: rk, value: Number(rv), days: rd } }); setRv(""); }, "Rule added. Everyone who already reached it got the frame.")}>
                  <Plus className="h-4 w-4" aria-hidden /> Add rule
                </Button>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-muted">Top-ups from the payment gateway and manual UPI both count. The frame comes the moment they top up, and goes into their Bag where they wear and take it off.</p>
          </div>

          {canSave ? (
            <div>
              <p className="label">Give it to one person</p>
              <label className="mb-2 block text-xs font-semibold text-muted">
                Days (0 = never ends)
                <input className="field ml-2 h-9 w-24" inputMode="numeric" value={days} onChange={(e) => setDays(Number(e.target.value.replace(/\D/g, "")) || 0)} />
              </label>
              <UserPicker placeholder="Search a user to give it to" onPick={(u) => void run(() => apiRequest(`${base}/${f.id}/grant`, { method: "POST", body: { userId: u.id, days } }), `${u.name} now has ${f.name}`)} />
            </div>
          ) : null}

          <div>
            <Button size="sm" onClick={() => void loadHolders()}>
              {holders ? "Refresh holders" : "Show holders"}
            </Button>
            {holders ? (
              !holders.length ? (
                <p className="mt-2 text-xs text-muted">Nobody holds this frame yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line text-sm">
                  {holders.map((h) => (
                    <li key={h.userId} className="flex flex-wrap items-center gap-3 py-1.5">
                      <span className="font-semibold">{h.name}</span>
                      {h.publicId ? <span className="text-xs text-muted">#{h.publicId}</span> : null}
                      <span className="text-xs text-muted">{h.expiresAt ? `until ${new Date(h.expiresAt).toLocaleDateString("en-IN")}` : "never ends"}</span>
                      {h.equipped ? <Badge tone="ok">wearing</Badge> : null}
                      {canSave ? (
                        <Button size="sm" variant="danger" className="ml-auto" onClick={() => void run(async () => { await apiRequest(`${base}/${f.id}/grant/${h.userId}`, { method: "DELETE" }); await loadHolders(); }, "Taken back")}>
                          <UserMinus className="h-3.5 w-3.5" aria-hidden /> Take back
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Profile titles (live backend): the admin makes coloured name tags like "Shining Star" with a colour pair, a small picture, a price or "free".
 * People own them (free, bought, given here, or won in a Family Treasure chest) and wear a few on their profile.
 */
import { useCallback, useEffect, useState } from "react";
import { Gift as GiftIcon, Trash2, Upload, UserMinus } from "lucide-react";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { apiRequest, apiUpload } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorNote, Loading, PageHeader, Toggle } from "../components/ui";
import { MediaPreview, formatOf } from "../components/MediaParts";
import { NeedsBackend } from "../components/WalletParts";
import { UserPicker } from "./RoomsLive";

const base = "/api/v1/admin/titles";
const RARITIES = ["COMMON", "PREMIUM", "EPIC", "LEGENDARY", "ULTRA_RARE"];
type Title = { id: number; name: string; iconUrl: string | null; colorFrom: string; colorTo: string; textColor: string; rarity: string; priceCoins: number; free: boolean; active: boolean; sortOrder: number; holders: number; wearing: number };
type Holder = { userId: number; name: string; source: string; since: string; expiresAt: string | null; wearing: boolean };
const msg = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);

function Pill({ t, name }: { t: { name: string; iconUrl: string | null; iconFormat?: string; colorFrom: string; colorTo: string; textColor: string }; name?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 text-[13px] font-bold shadow" style={{ background: `linear-gradient(90deg, ${t.colorFrom}, ${t.colorTo})`, color: t.textColor }}>
      {t.iconUrl ? <MediaPreview media={{ url: t.iconUrl, format: t.iconFormat ?? formatOf(t.iconUrl) }} size={22} /> : <span className="text-[14px]">★</span>}
      {name ?? t.name}
    </span>
  );
}

export function ProfileTitlesPage() {
  if (!BACKEND_ENABLED) return <NeedsBackend what="Profile titles" />;
  return <Live />;
}

function Live() {
  const { toast, can } = useAdmin();
  const canSave = can("users.view");
  const [data, setData] = useState<{ maxWorn: number; titles: Title[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maxWorn, setMaxWorn] = useState(3);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiRequest<{ maxWorn: number; titles: Title[] }>(base);
      setData(d);
      setMaxWorn(d.maxWorn);
      setError(null);
    } catch (e) {
      setError(msg(e, "Could not load the titles."));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Profile titles" sub="Make coloured titles. People wear them on their profile. Give them free, sell them for coins, hand them out, or put them in Family Treasure chests." />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!data ? (
        <Loading />
      ) : (
        <>
          <Card title="How many titles a person can wear (0 = no limit)">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <input className="field h-9 w-24 py-1" inputMode="numeric" value={maxWorn} onChange={(e) => setMaxWorn(Number(e.target.value.replace(/\D/g, "")) || 0)} disabled={!canSave} />
              <Button
                variant="gold"
                disabled={!canSave || maxWorn === data.maxWorn}
                onClick={() =>
                  void apiRequest(`${base}/settings`, { method: "PUT", body: { maxWorn } })
                    .then(() => (toast("Saved"), load()))
                    .catch((e) => toast(msg(e, "Could not save"), "error"))
                }
              >
                Save
              </Button>
              <span className="text-xs text-muted">0 = no limit (the default): a person can wear every title they own. Or set a number up to 100.</span>
            </div>
          </Card>

          <Create canSave={canSave} onDone={load} />

          <Card className="mt-4" title="All titles">
            {!data.titles.length ? (
              <Empty>No titles yet.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {data.titles.map((t) => (
                  <li key={t.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Pill t={t} />
                      <span className="font-mono text-xs text-gold">ID {t.id}</span>
                      <span className="flex flex-wrap gap-1.5">
                        <Badge tone="gold">{t.rarity}</Badge>
                        {t.free ? <Badge tone="ok">Free for everyone</Badge> : t.priceCoins > 0 ? <Badge>{t.priceCoins.toLocaleString("en-IN")} coins</Badge> : <Badge>Gift / chest only</Badge>}
                        <Badge>{t.holders} own</Badge>
                        <Badge>{t.wearing} wearing</Badge>
                      </span>
                      <span className="ml-auto flex items-center gap-2">
                        <Toggle
                          checked={t.active}
                          label="On"
                          disabled={!canSave}
                          onChange={(v) =>
                            void apiRequest(`${base}/${t.id}`, { method: "PUT", body: { active: v } })
                              .then(load)
                              .catch((e) => toast(msg(e, "Could not save"), "error"))
                          }
                        />
                        <Button size="sm" onClick={() => setOpen(open === t.id ? null : t.id)}>
                          {open === t.id ? "Close" : "Manage"}
                        </Button>
                      </span>
                    </div>
                    {open === t.id ? <Manage t={t} canSave={canSave} onChanged={load} onDeleted={() => (setOpen(null), void load())} /> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="text-xs font-semibold text-muted">
      {label}
      <span className="mt-1 flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-9 w-12 cursor-pointer rounded border border-line bg-transparent" />
        <input className="field h-9 w-24 py-1 font-mono text-xs" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} maxLength={7} />
      </span>
    </label>
  );
}

function Create({ canSave, onDone }: { canSave: boolean; onDone: () => Promise<void> }) {
  const { toast } = useAdmin();
  const [name, setName] = useState("");
  const [from, setFrom] = useState("#7b5cff");
  const [to, setTo] = useState("#c56bff");
  const [text, setText] = useState("#ffffff");
  const [rarity, setRarity] = useState("COMMON");
  const [price, setPrice] = useState(0);
  const [free, setFree] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = file ? URL.createObjectURL(file) : null;
  const go = async () => {
    setBusy(true);
    try {
      const f = new FormData();
      f.append("name", name.trim());
      f.append("colorFrom", from);
      f.append("colorTo", to);
      f.append("textColor", text);
      f.append("rarity", rarity);
      f.append("priceCoins", String(free ? 0 : price));
      f.append("free", String(free));
      if (file) f.append("file", file);
      await apiUpload(base, f).promise;
      toast("Title added");
      setName("");
      setFile(null);
      await onDone();
    } catch (e) {
      toast(msg(e, "Could not add the title"), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="mt-4" title="Add a title">
      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs font-semibold text-muted">
            Name
            <input className="field mt-1 h-9 w-52 py-1" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} disabled={!canSave} placeholder="Shining Star" />
          </label>
          <ColorField label="Colour from" value={from} onChange={setFrom} disabled={!canSave} />
          <ColorField label="Colour to" value={to} onChange={setTo} disabled={!canSave} />
          <ColorField label="Text" value={text} onChange={setText} disabled={!canSave} />
          <div>
            <p className="text-xs font-semibold text-muted">Preview</p>
            <div className="mt-1">
              <Pill t={{ name: name || "Title name", iconUrl: preview, iconFormat: file ? formatOf(file.name) : undefined, colorFrom: from, colorTo: to, textColor: text }} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs font-semibold text-muted">
            Rarity
            <select className="field mt-1 h-9 w-40 py-1" value={rarity} onChange={(e) => setRarity(e.target.value)} disabled={!canSave}>
              {RARITIES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <Toggle checked={free} onChange={setFree} label="Free for everyone" disabled={!canSave} />
          {!free ? (
            <label className="text-xs font-semibold text-muted">
              Price in coins (0 = not for sale)
              <input className="field mt-1 h-9 w-40 py-1" inputMode="numeric" value={price} onChange={(e) => setPrice(Number(e.target.value.replace(/\D/g, "")) || 0)} disabled={!canSave} />
            </label>
          ) : null}
          <label className="text-xs font-semibold text-muted">
            Picture or animation (optional: PNG, JPG, GIF, WEBP, SVGA, MP4)
            <input type="file" accept=".png,.jpg,.jpeg,.gif,.webp,.svga,.mp4" className="mt-1 block text-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={!canSave} />
          </label>
          <Button variant="gold" busy={busy} disabled={!canSave || !name.trim()} onClick={() => void go()}>
            <Upload className="h-4 w-4" /> Add title
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Manage({ t, canSave, onChanged, onDeleted }: { t: Title; canSave: boolean; onChanged: () => Promise<void>; onDeleted: () => void }) {
  const { toast } = useAdmin();
  const [f, setF] = useState({ name: t.name, colorFrom: t.colorFrom, colorTo: t.colorTo, textColor: t.textColor, rarity: t.rarity, priceCoins: t.priceCoins, free: t.free });
  const [holders, setHolders] = useState<Holder[] | null>(null);
  const [days, setDays] = useState(0);
  const loadHolders = useCallback(() => apiRequest<Holder[]>(`${base}/${t.id}/holders`).then(setHolders).catch(() => setHolders([])), [t.id]);
  useEffect(() => {
    void loadHolders();
  }, [loadHolders]);
  const run = async (f2: () => Promise<unknown>, ok: string) => {
    try {
      await f2();
      toast(ok);
      await onChanged();
      await loadHolders();
    } catch (e) {
      toast(msg(e, "That did not work"), "error");
    }
  };
  return (
    <div className="mt-3 space-y-4 rounded-xl border border-line bg-ink p-3">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs font-semibold text-muted">
          Name
          <input className="field mt-1 h-9 w-48 py-1" maxLength={30} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} disabled={!canSave} />
        </label>
        <ColorField label="From" value={f.colorFrom} onChange={(v) => setF({ ...f, colorFrom: v })} disabled={!canSave} />
        <ColorField label="To" value={f.colorTo} onChange={(v) => setF({ ...f, colorTo: v })} disabled={!canSave} />
        <ColorField label="Text" value={f.textColor} onChange={(v) => setF({ ...f, textColor: v })} disabled={!canSave} />
        <label className="text-xs font-semibold text-muted">
          Rarity
          <select className="field mt-1 h-9 w-36 py-1" value={f.rarity} onChange={(e) => setF({ ...f, rarity: e.target.value })} disabled={!canSave}>
            {RARITIES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <Toggle checked={f.free} onChange={(v) => setF({ ...f, free: v })} label="Free" disabled={!canSave} />
        {!f.free ? (
          <label className="text-xs font-semibold text-muted">
            Price
            <input className="field mt-1 h-9 w-32 py-1" inputMode="numeric" value={f.priceCoins} onChange={(e) => setF({ ...f, priceCoins: Number(e.target.value.replace(/\D/g, "")) || 0 })} disabled={!canSave} />
          </label>
        ) : null}
        <Button variant="gold" disabled={!canSave} onClick={() => void run(() => apiRequest(`${base}/${t.id}`, { method: "PUT", body: { ...f, priceCoins: f.free ? 0 : f.priceCoins } }), "Saved")}>
          Save
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-gold">
          <Upload className="h-4 w-4" /> {t.iconUrl ? "Change picture / animation" : "Add picture / animation"}
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.gif,.webp,.svga,.mp4"
            className="sr-only"
            disabled={!canSave}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const form = new FormData();
              form.append("file", file);
              void run(() => apiUpload(`${base}/${t.id}/icon`, form).promise, "Picture saved");
            }}
          />
        </label>
        {t.iconUrl ? (
          <Button size="sm" disabled={!canSave} onClick={() => void run(() => apiRequest(`${base}/${t.id}/icon`, { method: "DELETE" }), "Picture removed")}>
            Remove picture
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="danger"
          disabled={!canSave}
          onClick={() => {
            if (window.confirm(`Delete "${t.name}"? Everyone who has it loses it.`)) void apiRequest(`${base}/${t.id}`, { method: "DELETE" }).then(onDeleted).catch((e) => toast(msg(e, "Could not delete"), "error"));
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>
      <div>
        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted uppercase">
          <GiftIcon className="h-3.5 w-3.5" /> Give this title to a person
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-muted">
            Days (0 = for ever)
            <input className="field ml-2 h-8 w-20 py-1" inputMode="numeric" value={days} onChange={(e) => setDays(Number(e.target.value.replace(/\D/g, "")) || 0)} disabled={!canSave} />
          </label>
        </div>
        <div className="mt-2 max-w-md">
          <UserPicker placeholder="Search a user to give it to" onPick={(u) => void run(() => apiRequest(`${base}/${t.id}/grant`, { method: "POST", body: { userId: u.id, days } }), `${u.name} now has ${t.name}`)} />
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-bold text-muted uppercase">Who has it</p>
        {!holders ? (
          <Loading />
        ) : !holders.length ? (
          <p className="text-xs text-muted">Nobody has it yet{t.free ? " (a free title shows up for a person once they wear it)" : ""}.</p>
        ) : (
          <ul className="max-h-56 divide-y divide-line overflow-y-auto text-sm">
            {holders.map((h) => (
              <li key={h.userId} className="flex items-center gap-3 py-1.5">
                <span className="font-semibold">{h.name}</span>
                <Badge>{h.source}</Badge>
                {h.wearing ? <Badge tone="ok">wearing</Badge> : null}
                {h.expiresAt ? <span className="text-xs text-muted">until {new Date(h.expiresAt).toLocaleDateString("en-IN")}</span> : null}
                <Button size="sm" variant="danger" className="ml-auto" disabled={!canSave} onClick={() => void run(() => apiRequest(`${base}/${t.id}/grant/${h.userId}`, { method: "DELETE" }), "Taken back")}>
                  <UserMinus className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

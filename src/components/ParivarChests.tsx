/**
 * Family Treasure chests, made easy for moderators (the same feel as the Gifts page):
 * a card for each chest; open it to see what is inside, add gifts from the gift catalogue with one click,
 * upload pictures / animations straight into the chest, and change each reward's chance, limit and amount in its own row.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gift, ImagePlus, Plus, Save, Search, Trash2, Upload } from "lucide-react";
import { giftCatalogService, type ServerGift as GiftItem } from "../services/giftCatalogService";
import { useAdmin } from "../context";
import { apiRequest, apiUpload } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorNote, Loading, Modal, Toggle, fmtCoins } from "./ui";
import { MediaPreview } from "./MediaParts";

const base = "/api/v1/admin/parivar/treasure";
type Tier = { id: number; code: string; name: string; enabled: boolean; weeklyTarget: number; unlockMinutes: number; poolCoins: number; poolDiamonds: number; drawsPerMember: number; eligibleMinHours: number; imageUrl: string | null; rewards: number; live: number };
type Reward = { id: number; kind: string; ref: number; giftId: string | null; amount: number; rarity: string; weight: number; maxPerChest: number; label: string; active: boolean; imageUrl: string | null; format: string | null; giftName: string | null };

const RARITIES = [
  { v: "COMMON", t: "Common" },
  { v: "PREMIUM", t: "Premium" },
  { v: "EPIC", t: "Epic" },
  { v: "LEGENDARY", t: "Legendary" },
  { v: "ULTRA_RARE", t: "Ultra rare" },
];
const RARITY_TONE: Record<string, "muted" | "info" | "gold" | "coral" | "ok"> = { COMMON: "muted", PREMIUM: "info", EPIC: "ok", LEGENDARY: "gold", ULTRA_RARE: "coral" };
const KIND_LABEL: Record<string, string> = { GIFT: "Gift", ITEM: "Frame / bubble / effect", VIP_CARD: "VIP card", TITLE: "Title", BADGE: "Badge", COLLECTIBLE: "Library picture", PROFILE_TITLE: "Profile title" };
const KIND_EMOJI: Record<string, string> = { GIFT: "🎁", ITEM: "🖼️", VIP_CARD: "👑", TITLE: "🏷️", BADGE: "🎖️", COLLECTIBLE: "✨", PROFILE_TITLE: "🏷️" };
const msg = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);
const digits = (s: string) => s.replace(/\D/g, "");

function useChests() {
  const [tiers, setTiers] = useState<Tier[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setTiers(await apiRequest<Tier[]>(`${base}/tiers`));
      setError(null);
    } catch (e) {
      setError(msg(e, "Couldn't load the chests."));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { tiers, error, load };
}

export function ParivarChests({ canSettings, canRewards }: { canSettings: boolean; canRewards: boolean }) {
  const { tiers, error, load } = useChests();
  const [open, setOpen] = useState<number | null>(null);
  const current = tiers?.find((t) => t.id === open) ?? null;
  return (
    <>
      <p className="mt-3 mb-3 text-sm text-muted">A Parivar earns these chests by weekly activity. Open a chest to add gifts, upload pictures or animations and change the chances. Nothing needs a new app release.</p>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!tiers ? (
        <Loading />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiers.map((t) => (
            <button key={t.id} type="button" onClick={() => setOpen(t.id)} className={`flex flex-col rounded-2xl border border-line bg-ink-2 p-3 text-left transition hover:border-line-strong hover:bg-surface ${t.enabled ? "" : "opacity-55"}`}>
              <div className="grid aspect-square place-items-center rounded-xl bg-[radial-gradient(circle_at_50%_40%,#2a2030,#111114_75%)]">
                {t.imageUrl ? <MediaPreview media={{ url: t.imageUrl, format: null }} size={120} /> : <span className="text-5xl">🎁</span>}
              </div>
              <p className="mt-2.5 truncate text-sm font-semibold">{t.name}</p>
              <p className="mt-0.5 text-xs text-muted">Weekly activity {fmtCoins(t.weeklyTarget)}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge tone="info">{t.live} reward{t.live === 1 ? "" : "s"}</Badge>
                {!t.enabled ? <Badge tone="coral">Off</Badge> : null}
              </div>
            </button>
          ))}
        </div>
      )}
      <Modal open={Boolean(current)} onClose={() => setOpen(null)} title={current ? `${current.name}: what's inside` : ""} wide>
        {current ? <ChestModal key={current.id} tier={current} canSettings={canSettings} canRewards={canRewards} onChanged={load} /> : null}
      </Modal>
    </>
  );
}

function Num({ value, onChange, disabled, w = "w-24", label }: { value: string; onChange: (v: string) => void; disabled?: boolean; w?: string; label: string }) {
  return <input className={`field h-9 py-1 text-sm ${w}`} inputMode="numeric" disabled={disabled} value={value} onChange={(e) => onChange(digits(e.target.value))} aria-label={label} />;
}

function ChestModal({ tier, canSettings, canRewards, onChanged }: { tier: Tier; canSettings: boolean; canRewards: boolean; onChanged: () => Promise<void> }) {
  const { toast } = useAdmin();
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"gift" | "upload" | "other" | null>(null);

  const load = useCallback(async () => {
    try {
      setRewards(await apiRequest<Reward[]>(`${base}/${tier.id}/rewards`));
      setError(null);
    } catch (e) {
      setError(msg(e, "Couldn't load the rewards."));
    }
    void onChanged();
  }, [tier.id, onChanged]);
  useEffect(() => {
    void load();
    giftCatalogService.list().then(setGifts).catch(() => setGifts([]));
  }, [load]);

  const giftById = useMemo(() => new Map(gifts.map((g) => [g.id, g])), [gifts]);
  const total = (rewards ?? []).filter((r) => r.active).reduce((a, r) => a + r.weight, 0);

  return (
    <div className="space-y-5">
      <Settings tier={tier} canSettings={canSettings} canPicture={canRewards} onSaved={onChanged} />

      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto font-display text-lg font-bold">Rewards in this chest</h3>
        <Button variant={panel === "gift" ? "gold" : "soft"} disabled={!canRewards} onClick={() => setPanel(panel === "gift" ? null : "gift")}>
          <Gift className="h-4 w-4" /> Add gifts
        </Button>
        <Button variant={panel === "upload" ? "gold" : "soft"} disabled={!canRewards} onClick={() => setPanel(panel === "upload" ? null : "upload")}>
          <ImagePlus className="h-4 w-4" /> Upload pictures / animations
        </Button>
        <Button variant={panel === "other" ? "gold" : "soft"} disabled={!canRewards} onClick={() => setPanel(panel === "other" ? null : "other")}>
          <Plus className="h-4 w-4" /> Other reward
        </Button>
      </div>
      {!canRewards ? <p className="text-xs text-muted">Your role can look but not change the rewards.</p> : null}

      {panel === "gift" ? <AddGifts tierId={tier.id} gifts={gifts} onDone={() => (setPanel(null), load())} /> : null}
      {panel === "upload" ? <UploadRewards tierId={tier.id} onDone={() => (setPanel(null), load())} /> : null}
      {panel === "other" ? <OtherReward tierId={tier.id} onDone={() => (setPanel(null), load())} /> : null}

      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!rewards ? (
        <Loading />
      ) : !rewards.length ? (
        <Card>
          <Empty>Nothing in this chest yet. Add a gift or upload a picture.</Empty>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rewards.map((r) => (
            <RewardRow key={`${r.id}:${r.weight}:${r.rarity}:${r.active}:${r.label}:${r.amount}:${r.maxPerChest}`} r={r} gift={r.giftId ? giftById.get(r.giftId) : undefined} share={r.active && total ? (r.weight / total) * 100 : 0} canEdit={canRewards} onChanged={load} toast={toast} />
          ))}
        </ul>
      )}
      <p className="text-xs leading-snug text-muted">
        Chance: a bigger number comes out more often. The percentage shown is each reward&apos;s share of all rewards that are On. Coins and diamonds are shared out from the pools above, so they are not listed here. Limit = the most times this reward can come out of one chest (0 = no limit).
      </p>
    </div>
  );
}

function Settings({ tier, canSettings, canPicture, onSaved }: { tier: Tier; canSettings: boolean; canPicture: boolean; onSaved: () => Promise<void> }) {
  const { toast } = useAdmin();
  const [f, setF] = useState({
    name: tier.name,
    enabled: tier.enabled,
    weeklyTarget: String(tier.weeklyTarget),
    unlockMinutes: String(tier.unlockMinutes),
    poolCoins: String(tier.poolCoins),
    poolDiamonds: String(tier.poolDiamonds),
    drawsPerMember: String(tier.drawsPerMember),
    eligibleMinHours: String(tier.eligibleMinHours),
  });
  const [busy, setBusy] = useState(false);
  const [pic, setPic] = useState(false);
  const [image, setImage] = useState(tier.imageUrl);
  const input = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const n = (s: string) => Number(s || 0);

  const save = async () => {
    setBusy(true);
    try {
      await apiRequest(`${base}/tiers/${tier.id}`, {
        method: "PUT",
        body: { name: f.name, enabled: f.enabled, weeklyTarget: n(f.weeklyTarget), unlockMinutes: n(f.unlockMinutes), poolCoins: n(f.poolCoins), poolDiamonds: n(f.poolDiamonds), drawsPerMember: n(f.drawsPerMember), eligibleMinHours: n(f.eligibleMinHours) },
      });
      toast("Chest saved");
      await onSaved();
    } catch (e) {
      toast(msg(e, "Couldn't save"), "error");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    setPic(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await apiUpload<{ imageUrl: string }>(`${base}/tiers/${tier.id}/image`, form).promise;
      setImage(r.imageUrl);
      toast("Chest picture changed");
      await onSaved();
    } catch (e) {
      toast(msg(e, "Couldn't upload"), "error");
    } finally {
      setPic(false);
      if (input.current) input.current.value = "";
    }
  };

  const field = (label: string, key: keyof typeof f, hint?: string) => (
    <label className="block text-xs font-semibold text-muted">
      {label}
      <Num label={label} value={String(f[key])} onChange={(v) => set(key, v as never)} disabled={!canSettings} w="w-full" />
      {hint ? <span className="mt-0.5 block font-normal">{hint}</span> : null}
    </label>
  );

  return (
    <Card title="Chest settings">
      <div className="space-y-4 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <MediaPreview media={{ url: image, format: null }} size={84} />
          <div className="space-y-2">
            <input ref={input} type="file" className="hidden" accept=".png,.jpg,.jpeg,.gif,.webp,.svga,.mp4" onChange={(e) => void upload(e.target.files?.[0])} />
            <Button size="sm" busy={pic} disabled={!canPicture} onClick={() => input.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> {image ? "Change chest picture" : "Upload chest picture"}
            </Button>
            <p className="text-xs text-muted">Picture, GIF, SVGA or MP4. Shown to the Parivar for this chest.</p>
          </div>
          <label className="ml-auto block min-w-[200px] flex-1 text-xs font-semibold text-muted sm:max-w-xs">
            Chest name
            <input className="field mt-1 h-9 w-full py-1 text-sm" maxLength={40} value={f.name} onChange={(e) => set("name", e.target.value)} disabled={!canSettings} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {field("Weekly activity needed", "weeklyTarget", "Earned once a week")}
          {field("Unlock time (minutes)", "unlockMinutes", "Between claim and send")}
          {field("Coin pool", "poolCoins", "Shared by luck")}
          {field("Diamond pool", "poolDiamonds", "Shared by luck")}
          {field("Draws per member", "drawsPerMember", "Item draws each")}
          {field("Eligible after (hours)", "eligibleMinHours", "Time in the Parivar")}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Toggle checked={f.enabled} onChange={(v) => set("enabled", v)} label="Chest is On" hint="Off = Parivars stop earning it (chests already earned stay)." disabled={!canSettings} />
          <Button variant="primary" busy={busy} disabled={!canSettings} onClick={() => void save()} className="ml-auto">
            <Save className="h-4 w-4" /> Save chest settings
          </Button>
        </div>
        {!canSettings ? <p className="text-xs text-muted">The chest numbers (target, pools) can only be saved by a Super Admin. You can still add and change rewards.</p> : null}
      </div>
    </Card>
  );
}

function Pic({ r, gift }: { r: Reward; gift?: GiftItem }) {
  if (r.kind === "GIFT" && gift?.imageUrl) return <MediaPreview media={{ url: gift.imageUrl, format: null }} size={56} />;
  if (r.imageUrl) return <MediaPreview media={{ url: r.imageUrl, format: r.format }} size={56} />;
  return <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-ink text-2xl ring-1 ring-line">{KIND_EMOJI[r.kind] ?? "🎁"}</span>;
}

function RewardRow({ r, gift, share, canEdit, onChanged, toast }: { r: Reward; gift?: GiftItem; share: number; canEdit: boolean; onChanged: () => Promise<void>; toast: (m: string, t?: "error") => void }) {
  const [label, setLabel] = useState(r.label);
  const [rarity, setRarity] = useState(r.rarity);
  const [weight, setWeight] = useState(String(r.weight));
  const [max, setMax] = useState(String(r.maxPerChest));
  const [amount, setAmount] = useState(String(r.amount));
  const [active, setActive] = useState(r.active);
  const [busy, setBusy] = useState(false);
  const dirty = label !== r.label || rarity !== r.rarity || Number(weight || 0) !== r.weight || Number(max || 0) !== r.maxPerChest || Number(amount || 0) !== r.amount || active !== r.active;

  const run = async (f: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await f();
      toast(done);
      await onChanged();
    } catch (e) {
      toast(msg(e, "That didn't work"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-ink-2 p-3 ${r.active ? "" : "opacity-60"}`}>
      <Pic r={r} gift={gift} />
      <div className="min-w-[170px] flex-1 space-y-1.5">
        <input className="field h-8 w-full py-1 text-sm font-semibold" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} disabled={!canEdit} aria-label="Name" />
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge>{KIND_LABEL[r.kind] ?? r.kind}</Badge>
          <select className="field h-7 py-0 text-xs" value={rarity} onChange={(e) => setRarity(e.target.value)} disabled={!canEdit} aria-label="Rarity">
            {RARITIES.map((x) => (
              <option key={x.v} value={x.v}>
                {x.t}
              </option>
            ))}
          </select>
          <Badge tone={RARITY_TONE[rarity] ?? "muted"}>{share ? `${share < 1 ? share.toFixed(2) : share.toFixed(1)}%` : "off"}</Badge>
        </div>
      </div>
      <label className="text-[11px] font-semibold text-muted">
        Chance
        <Num label="Chance" value={weight} onChange={setWeight} disabled={!canEdit} w="w-20" />
      </label>
      <label className="text-[11px] font-semibold text-muted">
        {r.kind === "VIP_CARD" ? "Days" : "Amount"}
        <Num label="Amount" value={amount} onChange={setAmount} disabled={!canEdit} w="w-20" />
      </label>
      <label className="text-[11px] font-semibold text-muted">
        Limit
        <Num label="Limit per chest" value={max} onChange={setMax} disabled={!canEdit} w="w-20" />
      </label>
      <Toggle checked={active} onChange={setActive} label="On" disabled={!canEdit} />
      {dirty ? (
        <Button size="sm" variant="gold" busy={busy} disabled={!canEdit} onClick={() => void run(() => apiRequest(`${base}/rewards/${r.id}`, { method: "PUT", body: { label, rarity, weight: Number(weight || 1), maxPerChest: Number(max || 0), amount: Number(amount || 0), active } }), "Saved")}>
          <Save className="h-3.5 w-3.5" /> Save
        </Button>
      ) : null}
      <Button size="sm" variant="danger" disabled={!canEdit || busy} aria-label={`Remove ${r.label}`} onClick={() => window.confirm(`Remove "${r.label}" from this chest? People who already won it keep it.`) && void run(() => apiRequest(`${base}/rewards/${r.id}`, { method: "DELETE" }), "Removed")}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

/** The shared "how often, how rare" boxes under the add panels. */
function Common({ rarity, setRarity, weight, setWeight, max, setMax }: { rarity: string; setRarity: (v: string) => void; weight: string; setWeight: (v: string) => void; max: string; setMax: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-xs font-semibold text-muted">
        Rarity
        <select className="field mt-1 h-9 py-1" value={rarity} onChange={(e) => setRarity(e.target.value)}>
          {RARITIES.map((x) => (
            <option key={x.v} value={x.v}>
              {x.t}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-muted">
        Chance (bigger = more often)
        <div className="mt-1">
          <Num label="Chance" value={weight} onChange={setWeight} />
        </div>
      </label>
      <label className="text-xs font-semibold text-muted">
        Limit per chest (0 = none)
        <div className="mt-1">
          <Num label="Limit per chest" value={max} onChange={setMax} />
        </div>
      </label>
    </div>
  );
}

function AddGifts({ tierId, gifts, onDone }: { tierId: number; gifts: GiftItem[]; onDone: () => void }) {
  const { toast } = useAdmin();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [amount, setAmount] = useState("1");
  const [rarity, setRarity] = useState("COMMON");
  const [weight, setWeight] = useState("10");
  const [max, setMax] = useState("0");
  const [busy, setBusy] = useState(false);
  const list = gifts.filter((g) => !q.trim() || g.name.toLowerCase().includes(q.trim().toLowerCase()));

  const add = async () => {
    setBusy(true);
    try {
      for (const id of picked) await apiRequest(`${base}/${tierId}/rewards`, { method: "POST", body: { kind: "GIFT", giftId: id, amount: Number(amount || 1), rarity, weight: Number(weight || 1), maxPerChest: Number(max || 0) } });
      toast(picked.length === 1 ? "Gift added to the chest" : `${picked.length} gifts added to the chest`);
      onDone();
    } catch (e) {
      toast(msg(e, "Couldn't add"), "error");
      setBusy(false);
    }
  };

  return (
    <Card title="Add gifts from the gift catalogue">
      <div className="space-y-3 px-4 py-3">
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input className="field pl-9" placeholder="Search gifts" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search gifts" />
        </div>
        <div className="scroll-thin grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 lg:grid-cols-6">
          {list.map((g) => {
            const on = picked.includes(g.id);
            return (
              <button key={g.id} type="button" aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== g.id) : [...p, g.id]))} className={`flex flex-col items-center rounded-xl border p-2 text-center text-xs transition ${on ? "border-gold bg-gold/10" : "border-line bg-ink hover:border-line-strong"}`}>
                <MediaPreview media={{ url: g.imageUrl, format: null }} size={48} />
                <span className="mt-1 w-full truncate font-semibold">{g.name}</span>
                <span className="text-gold">{fmtCoins(g.price)}</span>
              </button>
            );
          })}
          {!list.length ? <p className="col-span-full py-6 text-center text-sm text-muted">No gifts match.</p> : null}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-muted">
            How many (each win)
            <div className="mt-1">
              <Num label="Amount" value={amount} onChange={setAmount} />
            </div>
          </label>
          <Common rarity={rarity} setRarity={setRarity} weight={weight} setWeight={setWeight} max={max} setMax={setMax} />
        </div>
        <Button variant="gold" busy={busy} disabled={!picked.length} onClick={() => void add()}>
          <Plus className="h-4 w-4" /> Add {picked.length ? picked.length : ""} gift{picked.length === 1 ? "" : "s"} to the chest
        </Button>
      </div>
    </Card>
  );
}

function UploadRewards({ tierId, onDone }: { tierId: number; onDone: () => void }) {
  const { toast } = useAdmin();
  const [files, setFiles] = useState<File[]>([]);
  const [label, setLabel] = useState("");
  const [rarity, setRarity] = useState("COMMON");
  const [weight, setWeight] = useState("10");
  const [max, setMax] = useState("0");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    try {
      const form = new FormData();
      for (const f of files) form.append("file", f);
      if (files.length === 1 && label.trim()) form.append("label", label.trim());
      form.append("rarity", rarity);
      form.append("weight", weight || "1");
      form.append("maxPerChest", max || "0");
      await apiUpload(`${base}/${tierId}/rewards/upload`, form).promise;
      toast(files.length === 1 ? "Added to the chest" : `${files.length} rewards added to the chest`);
      onDone();
    } catch (e) {
      toast(msg(e, "Couldn't upload"), "error");
      setBusy(false);
    }
  };

  return (
    <Card title="Upload pictures or animations into this chest">
      <div className="space-y-3 px-4 py-3">
        <p className="text-xs text-muted">Choose one or many files (PNG, JPG, GIF, WEBP, SVGA, MP4). Each becomes a reward of this chest, named after its file, and is also saved in the Parivar library under &quot;Chest rewards&quot;.</p>
        <input type="file" multiple accept=".png,.jpg,.jpeg,.gif,.webp,.svga,.mp4" disabled={busy} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="text-xs" />
        {files.length === 1 ? (
          <label className="block max-w-sm text-xs font-semibold text-muted">
            Name (optional)
            <input className="field mt-1 h-9 w-full py-1" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
        ) : null}
        <Common rarity={rarity} setRarity={setRarity} weight={weight} setWeight={setWeight} max={max} setMax={setMax} />
        <Button variant="gold" busy={busy} disabled={!files.length} onClick={() => void go()}>
          <Upload className="h-4 w-4" /> Upload {files.length > 1 ? `${files.length} files` : "and add"}
        </Button>
      </div>
    </Card>
  );
}

const OTHER_KINDS: { v: string; t: string; id?: string; hint: string }[] = [
  { v: "VIP_CARD", t: "VIP card", hint: "Amount = number of VIP days." },
  { v: "ITEM", t: "Frame / chat bubble / entry effect", id: "Item ID (from Spend rewards)", hint: "Amount = days it lasts (0 = its own length)." },
  { v: "PROFILE_TITLE", t: "Profile title", id: "Title ID (from Profile titles)", hint: "Amount = days it lasts (0 = the title's own time)." },
  { v: "COLLECTIBLE", t: "Picture from the Parivar library", id: "Library item ID", hint: "Its name and picture come from the library." },
  { v: "BADGE", t: "Plain text badge", hint: "Shows in the profile collection with the name you type." },
  { v: "TITLE", t: "Plain text title", hint: "Shows in the profile collection with the name you type." },
];

function OtherReward({ tierId, onDone }: { tierId: number; onDone: () => void }) {
  const { toast } = useAdmin();
  const [kind, setKind] = useState("VIP_CARD");
  const [ref, setRef] = useState("");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("1");
  const [rarity, setRarity] = useState("COMMON");
  const [weight, setWeight] = useState("10");
  const [max, setMax] = useState("0");
  const [busy, setBusy] = useState(false);
  const k = OTHER_KINDS.find((x) => x.v === kind)!;

  const add = async () => {
    setBusy(true);
    try {
      await apiRequest(`${base}/${tierId}/rewards`, { method: "POST", body: { kind, ref: Number(ref || 0), label, amount: Number(amount || 0), rarity, weight: Number(weight || 1), maxPerChest: Number(max || 0) } });
      toast("Reward added");
      onDone();
    } catch (e) {
      toast(msg(e, "Couldn't add"), "error");
      setBusy(false);
    }
  };

  return (
    <Card title="Add another kind of reward">
      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-muted">
            Kind
            <select className="field mt-1 h-9 py-1" value={kind} onChange={(e) => setKind(e.target.value)}>
              {OTHER_KINDS.map((x) => (
                <option key={x.v} value={x.v}>
                  {x.t}
                </option>
              ))}
            </select>
          </label>
          {k.id ? (
            <label className="text-xs font-semibold text-muted">
              {k.id}
              <div className="mt-1">
                <Num label={k.id} value={ref} onChange={setRef} />
              </div>
            </label>
          ) : null}
          <label className="text-xs font-semibold text-muted">
            Name shown to people
            <input className="field mt-1 h-9 w-56 py-1" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. VIP card (3 days)" />
          </label>
          <label className="text-xs font-semibold text-muted">
            Amount
            <div className="mt-1">
              <Num label="Amount" value={amount} onChange={setAmount} />
            </div>
          </label>
        </div>
        <p className="text-xs text-muted">{k.hint}</p>
        <Common rarity={rarity} setRarity={setRarity} weight={weight} setWeight={setWeight} max={max} setMax={setMax} />
        <Button variant="gold" busy={busy} disabled={!label.trim()} onClick={() => void add()}>
          <Plus className="h-4 w-4" /> Add to the chest
        </Button>
      </div>
    </Card>
  );
}

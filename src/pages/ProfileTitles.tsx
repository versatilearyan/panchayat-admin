/**
 * Profile titles (live backend): the admin makes coloured name tags like "Shining Star" with a colour pair, a small picture, a price or "free".
 * People own them (free, bought, given here, or won in a Family Treasure chest) and wear a few on their profile.
 */
import { useCallback, useEffect, useState } from "react";
import { Gift as GiftIcon, Plus, Trash2, Upload, UserMinus } from "lucide-react";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { apiRequest, apiUpload } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorNote, Loading, PageHeader, Toggle } from "../components/ui";
import { MediaPreview, formatOf } from "../components/MediaParts";
import { NeedsBackend } from "../components/WalletParts";
import { UserPicker } from "./RoomsLive";

const base = "/api/v1/admin/titles";
const RARITIES = ["COMMON", "PREMIUM", "EPIC", "LEGENDARY", "ULTRA_RARE"];
type Title = { id: number; name: string; iconUrl: string | null; colorFrom: string; colorTo: string; textColor: string; rarity: string; priceCoins: number; free: boolean; active: boolean; sortOrder: number; durationDays: number; forSale: boolean; saleFrom: string | null; saleUntil: string | null; minVipLevel: number; parivarOnly: boolean; holders: number; wearing: number; rules: number };
type Holder = { userId: number; publicId?: number; name: string; source: string; since: string; expiresAt: string | null; wearing: boolean };
const msg = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);

function Pill({ t, name }: { t: { name: string; iconUrl: string | null; iconFormat?: string; colorFrom: string; colorTo: string; textColor: string }; name?: string }) {
  // A title is its uploaded artwork (WEBP, SVGA or MP4); an old title without one still shows as a coloured tag
  if (t.iconUrl) return <MediaPreview media={{ url: t.iconUrl, format: t.iconFormat ?? formatOf(t.iconUrl) }} size={44} />;
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
                        {t.free ? <Badge tone="ok">Free for everyone</Badge> : t.forSale && t.priceCoins > 0 ? <Badge>{t.priceCoins.toLocaleString("en-IN")} coins</Badge> : <Badge>Not sold</Badge>}
                        {t.durationDays > 0 ? <Badge>{t.durationDays} days</Badge> : <Badge>For ever</Badge>}
                        {t.rules > 0 ? <Badge tone="info">{t.rules} auto rule(s)</Badge> : null}
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

function Create({ canSave, onDone }: { canSave: boolean; onDone: () => Promise<void> }) {
  const { toast } = useAdmin();
  const [name, setName] = useState("");
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
          <div>
            <p className="text-xs font-semibold text-muted">Preview</p>
            <div className="mt-1 flex h-14 min-w-[120px] items-center">
              {preview ? <MediaPreview media={{ url: preview, format: file ? formatOf(file.name) : null }} size={52} /> : <span className="text-xs text-muted">Choose a file</span>}
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
            Title artwork (required: WEBP, SVGA or MP4 only)
            <input type="file" accept=".webp,.svga,.mp4" className="mt-1 block text-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={!canSave} />
          </label>
          <Button variant="gold" busy={busy} disabled={!canSave || !name.trim() || !file} onClick={() => void go()}>
            <Upload className="h-4 w-4" /> Add title
          </Button>
        </div>
      </div>
    </Card>
  );
}

type Rule = { id: number; kind: string; value: string; days: number; active: boolean; matched: number; lastRun: string | null };
const RULE_HELP: Record<string, string> = {
  IDS: "A list of 7 digit user IDs (the rare people, the team ...). Paste them separated by commas, spaces or new lines.",
  VIP_LEVEL: "Everyone who has this VIP level or a higher one.",
  PARIVAR_ROLE: "Everyone who holds this role in any Parivar.",
  TOPUP_TOTAL: "Everyone whose total top-ups (payment gateway and manual UPI together) reach this many rupees. The title comes the moment they top up.",
  TOPUP_ONE: "Everyone who makes a single top-up of at least this many rupees (gateway or manual UPI). The title comes the moment they top up.",
  GIFT_SENT: "Everyone who has sent gifts worth this many coins in total (room gifts and personal gifts). The title comes as they send.",
  GIFT_RECEIVED: "Everyone who has received gifts worth this many coins in total (room gifts and personal gifts).",
};
const KIND_LABEL: Record<string, string> = { IDS: "ID list", VIP_LEVEL: "VIP level", PARIVAR_ROLE: "Parivar role", TOPUP_TOTAL: "Total top-up", TOPUP_ONE: "Single top-up", GIFT_SENT: "Gifts sent", GIFT_RECEIVED: "Gifts received" };
const MONEY_KINDS = ["TOPUP_TOTAL", "TOPUP_ONE", "GIFT_SENT", "GIFT_RECEIVED"];
const dateOf = (s: string | null) => (s ? s.slice(0, 10) : "");

function Manage({ t, canSave, onChanged, onDeleted }: { t: Title; canSave: boolean; onChanged: () => Promise<void>; onDeleted: () => void }) {
  const { toast } = useAdmin();
  const [f, setF] = useState({
    name: t.name,
    colorFrom: t.colorFrom,
    colorTo: t.colorTo,
    textColor: t.textColor,
    rarity: t.rarity,
    priceCoins: t.priceCoins,
    free: t.free,
    durationDays: t.durationDays,
    forSale: t.forSale,
    minVipLevel: t.minVipLevel,
    parivarOnly: t.parivarOnly,
    saleFrom: dateOf(t.saleFrom),
    saleUntil: dateOf(t.saleUntil),
  });
  const [holders, setHolders] = useState<Holder[] | null>(null);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [days, setDays] = useState(0);
  const [ids, setIds] = useState("");
  const [rk, setRk] = useState("IDS");
  const [rv, setRv] = useState("");
  const [rd, setRd] = useState(0);
  const loadHolders = useCallback(() => apiRequest<Holder[]>(`${base}/${t.id}/holders`).then(setHolders).catch(() => setHolders([])), [t.id]);
  const loadRules = useCallback(() => apiRequest<Rule[]>(`${base}/${t.id}/rules`).then(setRules).catch(() => setRules([])), [t.id]);
  useEffect(() => {
    void loadHolders();
    void loadRules();
  }, [loadHolders, loadRules]);
  const run = async (f2: () => Promise<unknown>, ok: string) => {
    try {
      await f2();
      toast(ok);
      await onChanged();
      await loadHolders();
      await loadRules();
    } catch (e) {
      toast(msg(e, "That did not work"), "error");
    }
  };
  const save = () =>
    run(
      () =>
        apiRequest(`${base}/${t.id}`, {
          method: "PUT",
          body: {
            name: f.name,
            rarity: f.rarity,
            priceCoins: f.free ? 0 : f.priceCoins,
            free: f.free,
            durationDays: f.durationDays,
            forSale: f.forSale,
            minVipLevel: f.minVipLevel,
            parivarOnly: f.parivarOnly,
            saleFrom: f.saleFrom || undefined,
            saleUntil: f.saleUntil || undefined,
            clearSaleWindow: !f.saleFrom && !f.saleUntil,
          },
        }),
      "Saved",
    );
  return (
    <div className="mt-3 space-y-5 rounded-xl border border-line bg-ink p-3">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs font-semibold text-muted">
          Name
          <input className="field mt-1 h-9 w-48 py-1" maxLength={30} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} disabled={!canSave} />
        </label>
        <label className="text-xs font-semibold text-muted">
          Rarity
          <select className="field mt-1 h-9 w-36 py-1" value={f.rarity} onChange={(e) => setF({ ...f, rarity: e.target.value })} disabled={!canSave}>
            {RARITIES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-line p-3">
        <p className="mb-2 text-xs font-bold text-muted uppercase">Who gets it and for how long</p>
        <div className="flex flex-wrap items-end gap-4">
          <Toggle checked={f.free} onChange={(v) => setF({ ...f, free: v })} label="Free for everyone" disabled={!canSave} />
          {!f.free ? <Toggle checked={f.forSale} onChange={(v) => setF({ ...f, forSale: v })} label="Sell in the store" hint="Off = nobody can buy it; only chests, rules and you give it." disabled={!canSave} /> : null}
          {!f.free && f.forSale ? (
            <>
              <label className="text-xs font-semibold text-muted">
                Price (coins)
                <input className="field mt-1 h-9 w-28 py-1" inputMode="numeric" value={f.priceCoins} onChange={(e) => setF({ ...f, priceCoins: Number(e.target.value.replace(/\D/g, "")) || 0 })} disabled={!canSave} />
              </label>
              <label className="text-xs font-semibold text-muted">
                Only VIP level
                <input className="field mt-1 h-9 w-20 py-1" inputMode="numeric" value={f.minVipLevel} onChange={(e) => setF({ ...f, minVipLevel: Number(e.target.value.replace(/\D/g, "")) || 0 })} disabled={!canSave} />
              </label>
              <Toggle checked={f.parivarOnly} onChange={(v) => setF({ ...f, parivarOnly: v })} label="Parivar members only" disabled={!canSave} />
              <label className="text-xs font-semibold text-muted">
                On sale from
                <input type="date" className="field mt-1 h-9 py-1" value={f.saleFrom} onChange={(e) => setF({ ...f, saleFrom: e.target.value })} disabled={!canSave} />
              </label>
              <label className="text-xs font-semibold text-muted">
                On sale until
                <input type="date" className="field mt-1 h-9 py-1" value={f.saleUntil} onChange={(e) => setF({ ...f, saleUntil: e.target.value })} disabled={!canSave} />
              </label>
            </>
          ) : null}
          <label className="text-xs font-semibold text-muted">
            Lasts (days, 0 = for ever)
            <input className="field mt-1 h-9 w-28 py-1" inputMode="numeric" value={f.durationDays} onChange={(e) => setF({ ...f, durationDays: Number(e.target.value.replace(/\D/g, "")) || 0 })} disabled={!canSave} />
          </label>
          <Button variant="gold" disabled={!canSave} onClick={() => void save()}>
            Save
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">
          &quot;Lasts&quot; counts from the day someone buys it, wins it in a chest or gets it from you. Buying again before it ends adds more days. Clear both dates for a title that is always on sale.
        </p>
      </div>

      <div className="rounded-xl border border-line p-3">
        <p className="mb-2 text-xs font-bold text-muted uppercase">Automatic rules (give it to the right people on its own)</p>
        {!rules ? (
          <Loading />
        ) : !rules.length ? (
          <p className="mb-2 text-xs text-muted">No rule yet.</p>
        ) : (
          <ul className="mb-3 divide-y divide-line text-sm">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-1.5">
                <Badge tone="gold">{KIND_LABEL[r.kind] ?? r.kind}</Badge>
                <span className="max-w-[320px] truncate font-mono text-xs" title={r.value}>
                  {r.kind === "IDS" ? `${r.value.split(",").length} IDs` : r.kind === "VIP_LEVEL" ? `${r.value} or higher` : r.kind.startsWith("TOPUP") ? `₹${Number(r.value).toLocaleString("en-IN")} or more` : r.kind.startsWith("GIFT") ? `${Number(r.value).toLocaleString("en-IN")} coins or more` : r.value}
                </span>
                <span className="text-xs text-muted">{r.days === 0 ? (MONEY_KINDS.includes(r.kind) ? "title's own validity, renewed on every top-up / gift" : "while they qualify") : MONEY_KINDS.includes(r.kind) ? `${r.days} days, renewed on every top-up / gift` : `${r.days} days, once`}</span>
                <span className="text-xs text-muted">{r.matched} people{r.lastRun ? ` · ran ${new Date(r.lastRun).toLocaleTimeString("en-IN")}` : ""}</span>
                <span className="ml-auto flex items-center gap-2">
                  <Toggle checked={r.active} label="On" disabled={!canSave} onChange={(v) => void run(() => apiRequest(`${base}/rules/${r.id}`, { method: "PUT", body: { active: v } }), v ? "Rule on" : "Rule off")} />
                  <Button size="sm" variant="danger" disabled={!canSave} onClick={() => window.confirm("Delete this rule? People it gave the title to while they qualified lose it.") && void run(() => apiRequest(`${base}/rules/${r.id}`, { method: "DELETE" }), "Rule deleted")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-start gap-3">
          <label className="text-xs font-semibold text-muted">
            Rule
            <select className="field mt-1 h-9 w-40 py-1" value={rk} onChange={(e) => (setRk(e.target.value), setRv(""))} disabled={!canSave}>
              <option value="IDS">List of user IDs</option>
              <option value="VIP_LEVEL">VIP level</option>
              <option value="PARIVAR_ROLE">Parivar role</option>
              <option value="TOPUP_TOTAL">Total top-up (₹)</option>
              <option value="TOPUP_ONE">Single top-up (₹)</option>
              <option value="GIFT_SENT">Gifts sent (coins)</option>
              <option value="GIFT_RECEIVED">Gifts received (coins)</option>
            </select>
          </label>
          <label className="min-w-[220px] flex-1 text-xs font-semibold text-muted">
            {rk === "IDS" ? "User IDs" : rk === "VIP_LEVEL" ? "Lowest VIP level" : rk.startsWith("TOPUP") ? "Rupees (₹)" : rk.startsWith("GIFT") ? "Coins" : "Role"}
            {rk === "IDS" ? (
              <textarea className="field mt-1 h-20 w-full py-1 font-mono text-xs" value={rv} onChange={(e) => setRv(e.target.value)} placeholder="4000123, 4000456, 4000789" disabled={!canSave} />
            ) : rk === "PARIVAR_ROLE" ? (
              <select className="field mt-1 h-9 w-full py-1" value={rv} onChange={(e) => setRv(e.target.value)} disabled={!canSave}>
                <option value="">Choose…</option>
                {["LEADER", "DEPUTY", "ADMIN", "MEMBER"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            ) : (
              <input className="field mt-1 h-9 w-full py-1" inputMode="numeric" value={rv} onChange={(e) => setRv(e.target.value.replace(/\D/g, ""))} placeholder={MONEY_KINDS.includes(rk) ? "500" : "3"} disabled={!canSave} />
            )}
          </label>
          <label className="text-xs font-semibold text-muted">
            {MONEY_KINDS.includes(rk) ? "Days (0 = the title's own validity)" : "Days (0 = while they qualify)"}
            <input className="field mt-1 h-9 w-28 py-1" inputMode="numeric" value={rd} onChange={(e) => setRd(Number(e.target.value.replace(/\D/g, "")) || 0)} disabled={!canSave} />
          </label>
          <Button className="mt-5" variant="gold" disabled={!canSave || !rv.trim()} onClick={() => void run(async () => { await apiRequest(`${base}/${t.id}/rules`, { method: "POST", body: { kind: rk, value: rv, days: rd } }); setRv(""); }, "Rule added and run")}>
            <Plus className="h-4 w-4" /> Add rule
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">{RULE_HELP[rk]} Rules run when you add them and then every 5 minutes. Top-up and gift rules also run the moment someone tops up or sends a gift, and each one renews the title's validity (set on the title itself, or Days here).</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-gold">
          <Upload className="h-4 w-4" /> {t.iconUrl ? "Change artwork (WEBP, SVGA or MP4)" : "Add artwork (WEBP, SVGA or MP4)"}
          <input
            type="file"
            accept=".webp,.svga,.mp4"
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
          <GiftIcon className="h-3.5 w-3.5" /> Give it now
        </p>
        <label className="text-xs text-muted">
          Days (0 = this title&apos;s own time)
          <input className="field mb-2 ml-2 h-8 w-20 py-1" inputMode="numeric" value={days} onChange={(e) => setDays(Number(e.target.value.replace(/\D/g, "")) || 0)} disabled={!canSave} />
        </label>
        <div className="max-w-md">
          <UserPicker placeholder="Search one user to give it to" onPick={(u) => void run(() => apiRequest(`${base}/${t.id}/grant`, { method: "POST", body: { userId: u.id, days } }), `${u.name} now has ${t.name}`)} />
        </div>
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <textarea className="field h-16 w-72 py-1 font-mono text-xs" placeholder="Or paste many user IDs: 4000123, 4000456 ..." value={ids} onChange={(e) => setIds(e.target.value)} disabled={!canSave} />
          <Button
            disabled={!canSave || !ids.trim()}
            onClick={() =>
              void run(async () => {
                const r = await apiRequest<{ given: number; notFound: string[] }>(`${base}/${t.id}/grant-ids`, { method: "POST", body: { ids, days } });
                if (r.notFound.length) toast(`Given to ${r.given}. Not found: ${r.notFound.join(", ")}`, "error");
                setIds("");
              }, "Given to the list")
            }
          >
            Give to these IDs
          </Button>
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
                {h.publicId ? <span className="font-mono text-xs text-muted">{h.publicId}</span> : null}
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

/**
 * Coin packs, live from the backend (/api/v1/admin/coin-packs). Super admins can list every
 * pack (inactive too), add and edit packs, upload or replace a pack's image, and turn packs
 * on or off. Nothing here is demo data: without VITE_API_BASE_URL the page asks for the backend.
 */
import { useEffect, useMemo, useState, type InputHTMLAttributes } from "react";
import { apiRequest } from "../lib/api";
import { Coins, ImageUp, Pencil, Plus, Power, PowerOff } from "lucide-react";
import { ImageUploadForm } from "../components/ImageUploadForm";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { Badge, Button, Card, Empty, ErrorNote, fmtCoins, Loading, Modal, PageHeader } from "../components/ui";
import {
  ActiveBadge,
  ConfirmDialog,
  Field,
  fmtInr,
  ListProblem,
  NeedsBackend,
  Pager,
  percent,
  ProductImage,
  rupees,
  SearchBox,
  updatedAgo,
  useList,
  useSearchPages,
  wholeNumber,
} from "../components/WalletParts";
import { coinPackService, type CoinPack, type CoinPackInput, type CoinPackPatch } from "../services/coinPackService";

type Dialog = { kind: "form"; pack: CoinPack | null } | { kind: "image"; pack: CoinPack; justCreated?: boolean } | { kind: "deactivate"; pack: CoinPack } | null;

const byOrder = (a: CoinPack, b: CoinPack) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || Number(a.priceInRupees) - Number(b.priceInRupees);

export function CoinPacksPage() {
  if (!BACKEND_ENABLED)
    return (
      <>
        <PageHeader title="Coin packs" sub="The coin packs people buy in the app's wallet." />
        <NeedsBackend what="coin packs" />
      </>
    );
  return <CoinPacksLive />;
}

function CoinPacksLive() {
  const { version } = useAdmin();
  const list = useList(() => coinPackService.list(), version);
  const [dialog, setDialog] = useState<Dialog>(null);
  const sorted = useMemo(() => [...(list.data ?? [])].sort(byOrder), [list.data]);
  const s = useSearchPages(sorted, (p) => `${p.name} ${p.badge ?? ""} ${p.coins}`);
  const close = () => setDialog(null);

  return (
    <>
      <PageHeader
        title="Coin packs"
        sub="Live from the server. Add packs, edit them, upload their images, or turn them off."
        right={
          <Button variant="primary" onClick={() => setDialog({ kind: "form", pack: null })}>
            <Plus className="h-4 w-4" /> Add coin pack
          </Button>
        }
      />
      {list.error && list.error.kind !== "forbidden" ? <ListProblem error={list.error} onRetry={list.retry} /> : null}
      {list.error?.kind === "forbidden" ? (
        <ListProblem error={list.error} onRetry={list.retry} />
      ) : (
        <Card
          title={list.data ? `${list.data.length} pack${list.data.length === 1 ? "" : "s"} · ${list.data.filter((p) => p.active).length} active` : "Coin packs"}
          action={list.data?.length ? <SearchBox value={s.q} onChange={s.setQ} label="Search packs" /> : null}
        >
          {list.loading && !list.data ? (
            <Loading />
          ) : !list.data ? (
            <Empty>Couldn't load coin packs.</Empty>
          ) : !list.data.length ? (
            <Empty>
              No coin packs yet. Add the first one.
              <span className="mt-3 flex justify-center">
                <Button variant="primary" onClick={() => setDialog({ kind: "form", pack: null })}>
                  <Plus className="h-4 w-4" /> Add coin pack
                </Button>
              </span>
            </Empty>
          ) : !s.shown.length ? (
            <Empty>No packs match “{s.q}”.</Empty>
          ) : (
            <>
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-[11px] tracking-wide text-muted uppercase">
                    <tr className="border-b border-line">
                      <th className="px-4 py-2.5 font-bold">Pack</th>
                      <th className="px-2 py-2.5 text-right font-bold">Coins</th>
                      <th className="px-2 py-2.5 text-right font-bold">Price</th>
                      <th className="px-2 py-2.5 text-right font-bold">Bonus</th>
                      <th className="px-2 py-2.5 text-right font-bold">Order</th>
                      <th className="px-2 py-2.5 font-bold">Status</th>
                      <th className="px-2 py-2.5 font-bold">Updated</th>
                      <th className="px-4 py-2.5 text-right font-bold">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {s.shown.map((p) => (
                      <PackRow key={p.id} pack={p} onEdit={() => setDialog({ kind: "form", pack: p })} onImage={() => setDialog({ kind: "image", pack: p })} onDeactivate={() => setDialog({ kind: "deactivate", pack: p })} />
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={s.page} pages={s.pages} total={s.total} onPage={s.setPage} />
            </>
          )}
        </Card>
      )}

      <Modal open={dialog?.kind === "form"} onClose={close} title={dialog?.kind === "form" && dialog.pack ? `Edit ${dialog.pack.name}` : "Add a coin pack"} wide>
        {dialog?.kind === "form" ? (
          <PackForm
            key={dialog.pack ? String(dialog.pack.id) : "new"}
            pack={dialog.pack}
            onClose={close}
            onCreated={(pack) => setDialog({ kind: "image", pack, justCreated: true })}
          />
        ) : null}
      </Modal>
      <Modal open={dialog?.kind === "image"} onClose={close} title={dialog?.kind === "image" ? (dialog.pack.imageUrl ? `Replace image · ${dialog.pack.name}` : `Add image · ${dialog.pack.name}`) : ""}>
        {dialog?.kind === "image" ? <ImageForm key={String(dialog.pack.id)} pack={dialog.pack} justCreated={dialog.justCreated} onClose={close} /> : null}
      </Modal>
      {dialog?.kind === "deactivate" ? <DeactivateDialog pack={dialog.pack} onClose={close} /> : null}
      <PlayProductsCard />
    </>
  );
}

function PackRow({ pack: p, onEdit, onImage, onDeactivate }: { pack: CoinPack; onEdit: () => void; onImage: () => void; onDeactivate: () => void }) {
  const { changed, toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  const activate = async () => {
    setBusy(true);
    try {
      await coinPackService.setActive(p.id, true);
      toast(`${p.name} is active again`);
      changed();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't turn it on", "error");
    } finally {
      setBusy(false);
    }
  };
  const bonus = [p.bonusCoins ? `+${fmtCoins(p.bonusCoins)}` : null, p.bonusPercentage ? `${p.bonusPercentage}%` : null].filter(Boolean).join(" · ");
  return (
    <tr className={p.active ? "" : "bg-cream/[0.015]"}>
      <td className="px-4 py-3">
        <div className={`flex items-center gap-3 ${p.active ? "" : "opacity-60"}`}>
          <ProductImage url={p.imageUrl} name={p.name} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 font-semibold">
              <span className="truncate">{p.name}</span>
              {p.badge ? <Badge tone="gold">{p.badge}</Badge> : null}
            </p>
            <p className="text-xs text-muted">ID {p.id}</p>
          </div>
        </div>
      </td>
      <td className="px-2 py-3 text-right font-semibold whitespace-nowrap text-gold tabular-nums">
        <Coins className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
        {fmtCoins(p.coins)}
      </td>
      <td className="px-2 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{fmtInr(p.priceInRupees)}</td>
      <td className="px-2 py-3 text-right whitespace-nowrap text-muted tabular-nums">{bonus || "—"}</td>
      <td className="px-2 py-3 text-right text-muted tabular-nums">{p.sortOrder ?? "—"}</td>
      <td className="px-2 py-3">
        <ActiveBadge active={p.active} />
      </td>
      <td className="px-2 py-3 whitespace-nowrap text-xs text-muted">{updatedAgo(p.updatedAt)}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${p.name}`}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={onImage} aria-label={`${p.imageUrl ? "Replace" : "Upload"} image for ${p.name}`}>
            <ImageUp className="h-3.5 w-3.5" /> {p.imageUrl ? "Replace" : "Image"}
          </Button>
          {p.active ? (
            <Button size="sm" variant="danger" onClick={onDeactivate} aria-label={`Deactivate ${p.name}`}>
              <PowerOff className="h-3.5 w-3.5" /> Deactivate
            </Button>
          ) : (
            <Button size="sm" variant="ok" busy={busy} onClick={activate} aria-label={`Activate ${p.name}`}>
              {busy ? null : <Power className="h-3.5 w-3.5" />} Activate
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function DeactivateDialog({ pack, onClose }: { pack: CoinPack; onClose: () => void }) {
  const { changed, toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await coinPackService.setActive(pack.id, false);
      toast(`${pack.name} deactivated`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't deactivate it");
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog open title={`Deactivate ${pack.name}?`} confirmLabel="Deactivate" busy={busy} error={error} onConfirm={confirm} onClose={onClose}>
      <p>
        People won't be able to buy this pack ({fmtCoins(pack.coins)} coins for {fmtInr(pack.priceInRupees)}) until you activate it again. Coins already bought aren't affected.
      </p>
    </ConfirmDialog>
  );
}

/* ---------------- create / edit ---------------- */

type FormState = { name: string; coins: string; priceInRupees: string; bonusCoins: string; bonusPercentage: string; badge: string; sortOrder: string };
type Errors = Partial<Record<keyof FormState, string>>;

const toForm = (p: CoinPack | null): FormState => ({
  name: p?.name ?? "",
  coins: p ? String(p.coins) : "",
  priceInRupees: p ? String(p.priceInRupees) : "",
  bonusCoins: String(p?.bonusCoins ?? 0),
  bonusPercentage: String(p?.bonusPercentage ?? 0),
  badge: p?.badge ?? "",
  sortOrder: String(p?.sortOrder ?? 0),
});

function validate(f: FormState): { body: CoinPackInput | null; errors: Errors } {
  const errors: Errors = {};
  const name = f.name.trim();
  if (!name) errors.name = "Give the pack a name.";
  else if (name.length > 100) errors.name = "Keep the name under 100 characters.";
  const coins = wholeNumber(f.coins, { min: 1, name: "the coins" });
  if (typeof coins !== "number") errors.coins = coins ?? "Enter the coins.";
  const price = rupees(f.priceInRupees, { name: "the price" });
  if (typeof price !== "number") errors.priceInRupees = price;
  const bonusCoins = wholeNumber(f.bonusCoins, { min: 0, required: false, name: "bonus coins" });
  if (typeof bonusCoins === "string") errors.bonusCoins = bonusCoins;
  const bonusPercentage = percent(f.bonusPercentage, "bonus percentage");
  if (typeof bonusPercentage === "string") errors.bonusPercentage = bonusPercentage;
  const sortOrder = wholeNumber(f.sortOrder, { min: 0, required: false, name: "sort order" });
  if (typeof sortOrder === "string") errors.sortOrder = sortOrder;
  const badge = f.badge.trim();
  if (badge.length > 30) errors.badge = "Keep the badge under 30 characters.";
  if (Object.keys(errors).length) return { body: null, errors };
  return {
    body: {
      name,
      coins: coins as number,
      priceInRupees: price as number,
      bonusCoins: (bonusCoins as number | null) ?? 0,
      bonusPercentage: bonusPercentage as number,
      badge: badge || null,
      sortOrder: (sortOrder as number | null) ?? 0,
    },
    errors,
  };
}

/** Only what changed, for PATCH. */
function patchFor(pack: CoinPack, body: CoinPackInput): CoinPackPatch {
  const patch: CoinPackPatch = {};
  if (body.name !== pack.name) patch.name = body.name;
  if (body.coins !== Number(pack.coins)) patch.coins = body.coins;
  if (body.priceInRupees !== Number(pack.priceInRupees)) patch.priceInRupees = body.priceInRupees;
  if (body.bonusCoins !== Number(pack.bonusCoins ?? 0)) patch.bonusCoins = body.bonusCoins;
  if (body.bonusPercentage !== Number(pack.bonusPercentage ?? 0)) patch.bonusPercentage = body.bonusPercentage;
  // A cleared badge is sent as "" so the server clears it (null would mean "leave as is" in a PATCH)
  if ((body.badge ?? "") !== (pack.badge ?? "")) patch.badge = body.badge ?? "";
  if (body.sortOrder !== Number(pack.sortOrder ?? 0)) patch.sortOrder = body.sortOrder;
  return patch;
}

function PackForm({ pack, onClose, onCreated }: { pack: CoinPack | null; onClose: () => void; onCreated: (p: CoinPack) => void }) {
  const { changed, toast } = useAdmin();
  const [f, setF] = useState<FormState>(() => toForm(pack));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof FormState, v: string) => setF((x) => ({ ...x, [k]: v }));
  const { body, errors } = validate(f);
  const patch = pack && body ? patchFor(pack, body) : null;
  const unchanged = Boolean(patch && !Object.keys(patch).length);
  const show = (k: keyof FormState) => (touched ? errors[k] : null);

  const save = async () => {
    setTouched(true);
    if (busy || !body || unchanged) return;
    setBusy(true);
    setError(null);
    try {
      if (pack) {
        await coinPackService.update(pack.id, patch!);
        toast(`${body.name} saved`);
        changed();
        onClose();
      } else {
        const created = await coinPackService.create(body);
        toast(`${body.name} added`);
        changed();
        if (created && created.id !== undefined) onCreated(created);
        else onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  };

  const input = (k: keyof FormState, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input id={`cp-${k}`} className="field" value={f[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={Boolean(show(k))} aria-describedby={show(k) ? `cp-${k}-err` : undefined} {...props} />
  );

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <Field id="cp-name" label="Pack name" error={show("name")}>
          {input("name", { maxLength: 100, autoFocus: !pack, placeholder: "Starter pack" })}
        </Field>
        <Field id="cp-badge" label="Badge" hint="Optional, e.g. Popular" error={show("badge")}>
          {input("badge", { maxLength: 30, placeholder: "Popular" })}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="cp-coins" label="Coins" error={show("coins")}>
          {input("coins", { inputMode: "numeric", placeholder: "6000" })}
        </Field>
        <Field id="cp-priceInRupees" label="Price (₹)" error={show("priceInRupees")}>
          {input("priceInRupees", { inputMode: "decimal", placeholder: "449" })}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="cp-bonusCoins" label="Bonus coins" error={show("bonusCoins")}>
          {input("bonusCoins", { inputMode: "numeric" })}
        </Field>
        <Field id="cp-bonusPercentage" label="Bonus %" error={show("bonusPercentage")}>
          {input("bonusPercentage", { inputMode: "decimal" })}
        </Field>
        <Field id="cp-sortOrder" label="Sort order" hint="Lower shows first" error={show("sortOrder")}>
          {input("sortOrder", { inputMode: "numeric" })}
        </Field>
      </div>
      {!pack ? <p className="text-xs text-muted">You can add the pack's image right after saving. New packs start the way the server sets them.</p> : null}
      {pack ? <p className="text-xs text-muted">ID {pack.id} · updated {updatedAgo(pack.updatedAt)}. To change the image, use Replace in the list.</p> : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onClose} className="flex-1" disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={busy} disabled={unchanged || (touched && !body)} className="flex-[1.4]">
          {pack ? (unchanged ? "No changes" : "Save changes") : "Create pack"}
        </Button>
      </div>
    </form>
  );
}

/* ---------------- image ---------------- */

function ImageForm({ pack, justCreated, onClose }: { pack: CoinPack; justCreated?: boolean; onClose: () => void }) {
  return <ImageUploadForm item={pack} justCreated={justCreated} onClose={onClose} inputId="cp-image" upload={(file, onProgress) => coinPackService.uploadImage(pack.id, file, onProgress)} />;
}

type PlayRow = { purpose: "COIN_PACK" | "VIP" | "RED_PACKET"; productId: number; name: string; priceInRupees: number; active: boolean; playProductId: string | null };
const PURPOSE_LABEL = { COIN_PACK: "Coin pack", VIP: "VIP plan", RED_PACKET: "Red packet" } as const;

/**
 * Google Play products for the Android app. Google requires coins, VIP and red packets bought in the app to go through
 * Google Play Billing. For each item, create an in-app product in the Play Console (a "consumable", with the same price)
 * and write its Product ID here. An item with no Product ID can't be bought in the Android app.
 */
function PlayProductsCard() {
  const { toast } = useAdmin();
  const [rows, setRows] = useState<PlayRow[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const key = (r: PlayRow) => `${r.purpose}:${r.productId}`;
  const load = () => {
    apiRequest<PlayRow[]>("/api/v1/admin/play-products").then(setRows).catch(() => setRows([]));
  };
  useEffect(load, []);
  if (!rows) return null;
  const save = async (r: PlayRow) => {
    const v = (draft[key(r)] ?? r.playProductId ?? "").trim();
    try {
      await apiRequest("/api/v1/admin/play-products", { method: "PUT", body: { purpose: r.purpose, productId: r.productId, playProductId: v } });
      toast(v ? "Play product saved" : "Play product removed");
      setDraft((d) => {
        const n = { ...d };
        delete n[key(r)];
        return n;
      });
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    }
  };
  return (
    <Card title="Google Play products (Android app)" className="mt-4">
      <div className="p-4">
        <p className="text-sm text-muted">Coins, VIP and red packets bought in the Android app are paid through Google Play. In the Play Console create an in-app product (consumable, same price) for each item and write its Product ID here (for example coins_500). Items without one are not on sale in the Android app. The website keeps using PayU.</p>
        <div className="scroll-thin mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-[11px] tracking-wide text-muted uppercase">
              <tr>
                <th className="py-2 text-left font-bold">Item</th>
                <th className="py-2 text-left font-bold">Price</th>
                <th className="py-2 text-left font-bold">Play Product ID</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={key(r)} className="border-t border-line">
                  <td className="py-2 pr-2">
                    <span className="font-semibold">{r.name}</span>
                    <span className="block text-xs text-muted">
                      {PURPOSE_LABEL[r.purpose]}
                      {r.active ? "" : " · off sale"}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-xs">₹{r.priceInRupees}</td>
                  <td className="py-2 pr-2">
                    <input className="field h-9 w-52 py-1" placeholder="not set" value={draft[key(r)] ?? r.playProductId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [key(r)]: e.target.value }))} aria-label={`Play product ID for ${r.name}`} />
                  </td>
                  <td className="py-2 text-right">
                    <Button size="sm" onClick={() => void save(r)} disabled={(draft[key(r)] ?? r.playProductId ?? "") === (r.playProductId ?? "")}>
                      Save
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

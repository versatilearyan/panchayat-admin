import { useMemo, useState } from "react";
import { Coins, Crown, Plus, Trash2, X } from "lucide-react";
import { adminApi, PRODUCT_KINDS, type Product, type ProductInput, type ProductKind, type ProductPrice } from "../api";
import { useAdmin } from "../context";
import { BACKEND_ENABLED } from "../config/api";
import { ShopBackendPage } from "./ShopBackend";
import { FileField, FileImage } from "../components/media";
import { Badge, Button, Card, Chips, Empty, ErrorNote, fmtCoins, Loading, Modal, NumberField, PageHeader, timeAgo, Toggle, useLoad } from "../components/ui";

export const KIND_LABEL: Record<ProductKind, string> = {
  bubble: "Chat bubbles",
  ring: "Rings",
  frame: "Frames",
  entry: "Entry effects",
  badge: "Badges",
  theme: "Room themes",
};
export const KIND_ONE: Record<ProductKind, string> = { bubble: "chat bubble", ring: "ring", frame: "frame", entry: "entry effect", badge: "badge", theme: "room theme" };

/** Which files each kind of product uses. */
const KIND_FILES: Record<ProductKind, { svga: boolean; image: boolean; colors: boolean }> = {
  bubble: { svga: false, image: true, colors: true },
  ring: { svga: true, image: true, colors: false },
  frame: { svga: true, image: true, colors: false },
  entry: { svga: true, image: true, colors: false },
  badge: { svga: false, image: true, colors: false },
  theme: { svga: true, image: true, colors: false },
};

const DEFAULT_PRICES: Record<ProductKind, ProductPrice[]> = {
  bubble: [{ days: 2, coins: NaN }, { days: 6, coins: NaN }],
  ring: [{ days: null, coins: NaN }],
  frame: [{ days: 7, coins: NaN }, { days: 30, coins: NaN }],
  entry: [{ days: 7, coins: NaN }, { days: 30, coins: NaN }],
  badge: [{ days: 30, coins: NaN }],
  theme: [{ days: 30, coins: NaN }],
};

export const priceText = (p: ProductPrice) => `${fmtCoins(p.coins)} / ${p.days === null ? "forever" : `${p.days} day${p.days === 1 ? "" : "s"}`}`;

export function ProductPreview({ p, size = 48 }: { p: Pick<Product, "kind" | "name" | "image" | "colors">; size?: number }) {
  if (p.image) return <FileImage fileRef={p.image} className="shrink-0" alt="" />;
  if (p.kind === "bubble" && p.colors)
    return (
      <span className="shrink-0 rounded-2xl rounded-bl-md px-2.5 py-1.5 text-[11px] font-semibold text-white" style={{ background: `linear-gradient(90deg, ${p.colors[0]}, ${p.colors[1]})` }}>
        Namaste!
      </span>
    );
  return (
    <span className="grid shrink-0 place-items-center rounded-xl bg-cream/[0.06] font-display font-bold text-cream/80" style={{ width: size, height: size }}>
      {p.name.slice(0, 1)}
    </span>
  );
}

export function ShopPage() {
  return BACKEND_ENABLED ? <ShopBackendPage /> : <DemoShopPage />;
}

function DemoShopPage() {
  const { version } = useAdmin();
  const { data, error, loading } = useLoad(() => adminApi.listProducts(), [version]);
  const [kind, setKind] = useState<ProductKind>("bubble");
  const [edit, setEdit] = useState<Product | "new" | null>(null);
  const list = useMemo(() => (data ?? []).filter((p) => p.kind === kind), [data, kind]);

  return (
    <>
      <PageHeader
        title="Shop items"
        sub="Everything people buy in the app's Shop. Add new items, upload their SVGA or image, or take them off sale."
        right={
          <Button variant="primary" onClick={() => setEdit("new")}>
            <Plus className="h-4 w-4" /> Add {KIND_ONE[kind]}
          </Button>
        }
      />
      <div className="mb-4">
        <Chips label="Kind" value={kind} onChange={setKind} options={PRODUCT_KINDS.map((k) => ({ value: k, label: `${KIND_LABEL[k]} (${(data ?? []).filter((p) => p.kind === k).length})` }))} />
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Card>
        {loading && !data ? (
          <Loading />
        ) : list.length ? (
          <ul className="divide-y divide-line">
            {list.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setEdit(p)} className={`flex w-full items-center gap-3.5 px-4 py-3 text-left hover:bg-cream/[0.03] ${p.active ? "" : "opacity-55"}`}>
                  <div className="grid h-14 w-20 shrink-0 place-items-center [&_img]:h-12 [&_img]:w-12">
                    <ProductPreview p={p} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{p.name}</span>
                      {p.rarity ? <Badge tone={p.rarity === "Legendary" ? "gold" : p.rarity === "Epic" ? "coral" : p.rarity === "Rare" ? "info" : "muted"}>{p.rarity}</Badge> : null}
                      {p.svga ? <Badge tone="coral">SVGA</Badge> : null}
                      {p.minVip ? (
                        <Badge tone="gold">
                          <Crown className="h-3 w-3" /> VIP {p.minVip}+
                        </Badge>
                      ) : null}
                      {!p.active ? <Badge>Off sale</Badge> : null}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-gold">
                      {p.prices.map((x) => (
                        <span key={String(x.days)} className="inline-flex items-center gap-1">
                          <Coins className="h-3.5 w-3.5" aria-hidden /> {priceText(x)}
                        </span>
                      ))}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No {KIND_LABEL[kind].toLowerCase()} yet. Add the first one.</Empty>
        )}
      </Card>
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === "new" ? `Add a ${KIND_ONE[kind]}` : edit ? `Edit ${edit.name}` : ""} wide>
        {edit ? <ProductForm key={edit === "new" ? `new-${kind}` : edit.id} product={edit === "new" ? null : edit} kind={kind} onClose={() => setEdit(null)} /> : null}
      </Modal>
    </>
  );
}

function ProductForm({ product, kind, onClose }: { product: Product | null; kind: ProductKind; onClose: () => void }) {
  const { can, changed, toast } = useAdmin();
  const [f, setF] = useState<ProductInput>(product ?? { kind, name: "", prices: DEFAULT_PRICES[kind], active: true, colors: kind === "bubble" ? ["#f4515b", "#e7bc72"] : undefined });
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const files = KIND_FILES[f.kind];
  const priceLocked = Boolean(product) && !can("pricing.edit");

  const setPrice = (i: number, patch: Partial<ProductPrice>) => set("prices", f.prices.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      const saved = await adminApi.saveProduct({ ...f, prices: f.prices.map((p) => ({ ...p, coins: Number.isFinite(p.coins) ? p.coins : -1 })) });
      toast(product ? `${saved.name} saved` : `${saved.name} added to the Shop`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!product) return;
    setBusy("delete");
    try {
      await adminApi.deleteProduct(product.id);
      toast(`${product.name} deleted`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete");
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_170px]">
        <div>
          <label className="label" htmlFor="p-name">
            Name
          </label>
          <input id="p-name" className="field" value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus={!product} />
        </div>
        <div>
          <label className="label" htmlFor="p-rarity">
            Rarity
          </label>
          <select id="p-rarity" className="field" value={f.rarity ?? ""} onChange={(e) => set("rarity", (e.target.value || undefined) as Product["rarity"])}>
            <option value="">None</option>
            <option>Common</option>
            <option>Rare</option>
            <option>Epic</option>
            <option>Legendary</option>
          </select>
        </div>
      </div>

      <div>
        <span className="label">Prices</span>
        <ul className="space-y-2">
          {f.prices.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <select
                aria-label="How long"
                className="field w-36"
                disabled={priceLocked}
                value={p.days === null ? "forever" : "days"}
                onChange={(e) => setPrice(i, { days: e.target.value === "forever" ? null : 7 })}
              >
                <option value="days">Rent for</option>
                <option value="forever">Keep forever</option>
              </select>
              {p.days !== null ? (
                <div className="w-28">
                  <NumberField value={p.days} onChange={(n) => setPrice(i, { days: n })} disabled={priceLocked} suffix="days" />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <NumberField value={p.coins} onChange={(n) => setPrice(i, { coins: n })} disabled={priceLocked} suffix="coins" />
              </div>
              {f.prices.length > 1 && !priceLocked ? (
                <button type="button" aria-label="Remove price" onClick={() => set("prices", f.prices.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-cream/5 hover:text-cream">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {priceLocked ? (
          <p className="mt-2 text-xs text-muted">Prices of existing items are view only for you.</p>
        ) : (
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => set("prices", [...f.prices, { days: 30, coins: NaN }])}>
            <Plus className="h-3.5 w-3.5" /> Add a price
          </Button>
        )}
      </div>

      {files.colors ? (
        <div>
          <span className="label">Bubble colours</span>
          <div className="flex items-center gap-3">
            {[0, 1].map((i) => (
              <input
                key={i}
                type="color"
                aria-label={i ? "End colour" : "Start colour"}
                className="h-10 w-14 cursor-pointer rounded-lg border border-line-strong bg-ink"
                value={f.colors?.[i] ?? "#ffffff"}
                onChange={(e) => {
                  const c: [string, string] = [...(f.colors ?? ["#f4515b", "#e7bc72"])] as [string, string];
                  c[i] = e.target.value;
                  set("colors", c);
                }}
              />
            ))}
            <ProductPreview p={{ ...f, image: undefined }} />
          </div>
        </div>
      ) : null}

      {files.svga ? <FileField kind="svga" label="Animation (SVGA)" value={f.svga} onChange={(v) => set("svga", v)} hint="Animated version shown in the app. Up to 15 MB." /> : null}
      {files.image ? (
        <FileField kind="image" label={f.kind === "bubble" ? "Bubble image (optional)" : "Picture"} value={f.image} onChange={(v) => set("image", v)} hint="Square PNG with a transparent background, shown in the Shop and Bag." />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[150px_1fr] sm:items-start">
        <div>
          <label className="label" htmlFor="p-vip">
            Needs VIP
          </label>
          <select id="p-vip" className="field" value={f.minVip ?? 0} onChange={(e) => set("minVip", Number(e.target.value) || undefined)}>
            <option value={0}>Anyone</option>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                VIP {i + 1}+
              </option>
            ))}
          </select>
        </div>
        <div className="sm:pt-6">
          <Toggle checked={f.active} onChange={(v) => set("active", v)} label="On sale in the Shop" hint="Turn off to stop selling it. People who own it keep it." />
        </div>
      </div>

      {product ? (
        <p className="text-xs text-muted">
          Last changed by {product.updatedBy} · {timeAgo(product.updatedAt)}
          {product.builtIn ? " · Built into the app" : ""}
        </p>
      ) : null}

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="flex flex-wrap gap-2 pt-1">
        {product && can("store.delete") && !product.builtIn ? (
          confirmDelete ? (
            <Button variant="danger" busy={busy === "delete"} onClick={remove}>
              <Trash2 className="h-4 w-4" /> Yes, delete
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )
        ) : null}
        <div className="flex flex-1 gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" busy={busy === "save"} onClick={save} disabled={!f.name.trim() || f.prices.some((p) => !Number.isFinite(p.coins))} className="flex-[1.4]">
            {product ? "Save" : "Add to Shop"}
          </Button>
        </div>
      </div>
    </div>
  );
}

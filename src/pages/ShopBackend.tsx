/**
 * Shop items when the panel is connected to the Spring Boot backend:
 * categories and products from /api/v1/admin/shop/*. The demo Shop (Shop.tsx) is used otherwise.
 */
import { useMemo, useState } from "react";
import { Coins, FolderOpen, FolderPlus, ImageOff, Plus } from "lucide-react";
import { useAdmin } from "../context";
import { AssetMedia, AssetUpload, useAsset, type AssetUploadState } from "../components/AssetUpload";
import { isSvgaRef } from "../services/shopAssetService";
import { Badge, Button, Card, Chips, Empty, ErrorNote, fmtCoins, Loading, Modal, PageHeader, timeAgo, Toggle, useLoad } from "../components/ui";
import { shopCategoryService, type CategoryInput, type ShopCategory } from "../services/shopCategoryService";
import { shopProductService, type ProductInput, type ShopProduct } from "../services/shopProductService";

type View = "products" | "categories";

const RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY"];
const RARITY_TONE: Record<string, "gold" | "coral" | "info" | "muted"> = { LEGENDARY: "gold", EPIC: "coral", RARE: "info" };
const pretty = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

const isSvga = isSvgaRef;
const updatedText = (at?: string) => {
  const t = at ? Date.parse(at) : NaN;
  return Number.isFinite(t) ? `Updated ${timeAgo(t)}` : null;
};

/** Empty or a full http(s) link. */
function urlProblem(v: string) {
  if (!v.trim()) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? null : "Use a link that starts with https://";
  } catch {
    return "That isn't a full link. It should start with https://";
  }
}

function Thumb({ url, name, size = 48 }: { url?: string | null; name: string; size?: number }) {
  const asset = useAsset(url);
  const [failed, setFailed] = useState(false);
  if (asset.url && !failed) return <AssetMedia key={asset.url} src={asset.url} svga={isSvga(url)} size={size} onFail={() => setFailed(true)} />;
  const broken = Boolean(url && (asset.error || failed));
  return (
    <span className="grid shrink-0 place-items-center rounded-xl bg-cream/[0.06] font-display font-bold text-cream/80" style={{ width: size, height: size }} title={asset.error ?? undefined}>
      {broken ? <ImageOff className="h-4 w-4 text-muted" aria-label="Picture didn't load" /> : asset.loading ? null : name.slice(0, 1).toUpperCase()}
    </span>
  );
}

type Editing = { kind: "product"; item: ShopProduct | null } | { kind: "category"; item: ShopCategory | null } | null;

export function ShopBackendPage() {
  const { version } = useAdmin();
  const [view, setView] = useState<View>("products");
  const [edit, setEdit] = useState<Editing>(null);
  const categories = useLoad(() => shopCategoryService.list(), [version]);
  const addCategory = () => setEdit({ kind: "category", item: null });

  return (
    <>
      <PageHeader
        title="Shop items"
        sub="Live from the server. Add categories and products, edit them, or take them off sale."
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant={view === "categories" ? "primary" : "ghost"} onClick={addCategory}>
              <FolderPlus className="h-4 w-4" /> Add category
            </Button>
            {view === "products" ? (
              <Button variant="primary" onClick={() => setEdit({ kind: "product", item: null })}>
                <Plus className="h-4 w-4" /> Add product
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="mb-4">
        <Chips
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { value: "products", label: "Products" },
            { value: "categories", label: `Categories${categories.data ? ` (${categories.data.length})` : ""}` },
          ]}
        />
      </div>
      {view === "products" ? (
        <Products categories={categories.data} onEdit={(item) => setEdit({ kind: "product", item })} onAddCategory={addCategory} />
      ) : (
        <Categories data={categories.data} error={categories.error} loading={categories.loading} onEdit={(item) => setEdit({ kind: "category", item })} onAdd={addCategory} />
      )}
      <Modal
        open={edit !== null}
        onClose={() => setEdit(null)}
        title={!edit ? "" : edit.item ? `Edit ${edit.item.name}` : edit.kind === "product" ? "Add a product" : "Add a category"}
        wide={edit?.kind === "product"}
      >
        {!edit ? null : edit.kind === "product" ? (
          <ProductForm key={edit.item ? String(edit.item.id) : "new"} product={edit.item} categories={categories.data ?? []} onClose={() => setEdit(null)} onAddCategory={addCategory} />
        ) : (
          <CategoryForm key={edit.item ? String(edit.item.id) : "new"} category={edit.item} onClose={() => setEdit(null)} />
        )}
      </Modal>
    </>
  );
}

/* ---------------- products ---------------- */

function Products({ categories, onEdit, onAddCategory }: { categories: ShopCategory[] | null; onEdit: (p: ShopProduct) => void; onAddCategory: () => void }) {
  const { version } = useAdmin();
  const [cat, setCat] = useState<string>("all");
  const { data, error, loading } = useLoad(() => (cat === "all" ? shopProductService.list() : shopProductService.listByCategory(cat)), [version, cat]);
  const sorted = useMemo(() => [...(data ?? [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name)), [data]);
  const catName = (p: ShopProduct) => p.categoryName ?? categories?.find((c) => String(c.id) === String(p.categoryId))?.name ?? null;

  return (
    <>
      {categories?.length ? (
        <div className="mb-4">
          <Chips label="Category" value={cat} onChange={setCat} options={[{ value: "all", label: "All" }, ...categories.map((c) => ({ value: String(c.id), label: c.active ? c.name : `${c.name} (off)` }))]} />
        </div>
      ) : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Card>
        {loading && !data ? (
          <Loading />
        ) : sorted.length ? (
          <ul className="divide-y divide-line">
            {sorted.map((p) => (
              <li key={p.id} className={`flex items-center gap-3 px-4 py-3 ${p.active ? "" : "opacity-55"}`}>
                <button type="button" onClick={() => onEdit(p)} className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
                  <Thumb url={p.assetUrl} name={p.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{p.name}</span>
                      {p.rarity ? <Badge tone={RARITY_TONE[p.rarity.toUpperCase()] ?? "muted"}>{pretty(p.rarity)}</Badge> : null}
                      {isSvga(p.assetUrl) ? <Badge tone="coral">SVGA</Badge> : null}
                      {!p.active ? <Badge>Off sale</Badge> : null}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm">
                      <span className="inline-flex items-center gap-1 text-gold">
                        <Coins className="h-3.5 w-3.5" aria-hidden /> {fmtCoins(Number(p.price))}
                      </span>
                      {catName(p) ? <span className="text-xs text-muted">{catName(p)}</span> : null}
                    </span>
                  </span>
                </button>
                <StatusToggle kind="product" item={p} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            {categories && !categories.length ? (
              <>
                Products go inside a category. Start by adding one.
                <span className="mt-3 flex justify-center">
                  <Button variant="primary" onClick={onAddCategory}>
                    <FolderPlus className="h-4 w-4" /> Add category
                  </Button>
                </span>
              </>
            ) : cat === "all" ? (
              "No products yet. Add the first one."
            ) : (
              "No products in this category yet."
            )}
          </Empty>
        )}
      </Card>
    </>
  );
}

/** On sale / visible switch in a list row. PATCH …/{id}/status. */
function StatusToggle({ kind, item }: { kind: "product" | "category"; item: ShopProduct | ShopCategory }) {
  const { changed, toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  const flip = async (active: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await (kind === "product" ? shopProductService.setActive(item.id, active) : shopCategoryService.setActive(item.id, active));
      toast(active ? `${item.name} is ${kind === "product" ? "on sale" : "visible"} again` : `${item.name} ${kind === "product" ? "taken off sale" : "hidden"}`);
      changed();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't change it", "error");
    } finally {
      setBusy(false);
    }
  };
  return <Toggle checked={item.active} onChange={flip} disabled={busy} hideLabel label={kind === "product" ? `${item.name} on sale` : `${item.name} visible in the Shop`} />;
}

function ProductForm({ product, categories, onClose, onAddCategory }: { product: ShopProduct | null; categories: ShopCategory[]; onClose: () => void; onAddCategory: () => void }) {
  const { changed, toast } = useAdmin();
  const [f, setF] = useState({
    categoryId: product ? String(product.categoryId) : (categories.find((c) => c.active)?.id.toString() ?? ""),
    name: product?.name ?? "",
    description: product?.description ?? "",
    price: product ? String(product.price) : "",
    rarity: product?.rarity ?? "COMMON",
    assetUrl: product?.assetUrl ?? "",
    displayOrder: String(product?.displayOrder ?? 0),
    active: product?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState<AssetUploadState>("idle");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  // New products need an active category; an existing one keeps showing its current category
  const choices = categories.filter((c) => c.active || String(c.id) === f.categoryId);
  const price = Number(f.price);
  const order = Number(f.displayOrder);
  const problem = upload === "uploading"
    ? "Wait for the image to finish uploading."
    : upload === "failed"
      ? "The image didn't upload. Try again, or remove it."
      : !f.categoryId
    ? categories.some((c) => c.active)
      ? "Pick a category."
      : "Add an active category first, on the Categories tab."
    : !f.name.trim()
      ? "Give it a name."
      : f.price.trim() === ""
        ? "Enter the price in coins."
        : !Number.isFinite(price) || price < 0
          ? "The price can't be below 0."
        : !Number.isInteger(order) || order < 0
          ? "Display order must be a whole number, 0 or more."
          : null;
  const rarities = RARITIES.includes(f.rarity.toUpperCase()) ? RARITIES : [f.rarity, ...RARITIES];

  const save = async () => {
    if (busy || problem) return;
    setBusy(true);
    setError(null);
    const cat = categories.find((c) => String(c.id) === f.categoryId);
    const body: ProductInput = {
      categoryId: cat ? cat.id : f.categoryId,
      name: f.name.trim(),
      description: f.description.trim(),
      price,
      rarity: f.rarity,
      assetUrl: f.assetUrl.trim(),
      displayOrder: order,
    };
    try {
      const saved = product ? await shopProductService.update(product.id, body) : await shopProductService.create(body);
      const id = saved?.id ?? product?.id;
      if (product && f.active !== product.active && id !== undefined) await shopProductService.setActive(id, f.active);
      toast(product ? `${body.name} saved` : `${body.name} added to the Shop`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="bp-name">
            Name
          </label>
          <input id="bp-name" className="field" required maxLength={120} value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus={!product} />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label className="label" htmlFor="bp-cat">
              Category
            </label>
            <button type="button" onClick={onAddCategory} className="mb-1.5 text-xs font-semibold text-gold hover:underline">
              + New category
            </button>
          </div>
          <select id="bp-cat" className="field" required value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">Pick a category…</option>
            {choices.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.active ? c.name : `${c.name} (hidden)`}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="bp-desc">
          Description
        </label>
        <textarea id="bp-desc" rows={2} maxLength={500} className="field resize-none" value={f.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="bp-price">
            Price (coins)
          </label>
          <input id="bp-price" className="field" type="number" inputMode="decimal" min={0} step="any" required value={f.price} onChange={(e) => set("price", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="bp-rarity">
            Rarity
          </label>
          <select id="bp-rarity" className="field" value={f.rarity} onChange={(e) => set("rarity", e.target.value)}>
            {rarities.map((r) => (
              <option key={r} value={r}>
                {pretty(r)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="bp-order">
            Display order
          </label>
          <input id="bp-order" className="field" type="number" inputMode="numeric" min={0} step={1} value={f.displayOrder} onChange={(e) => set("displayOrder", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="bp-asset">
          Image or SVGA <span className="normal-case tracking-normal text-muted/70">(shown in the app's Shop)</span>
        </label>
        <AssetUpload id="bp-asset" value={f.assetUrl} onChange={(ref) => set("assetUrl", ref)} onStateChange={setUpload} />
      </div>
      {product ? <Toggle checked={f.active} onChange={(v) => set("active", v)} label="On sale in the Shop" hint="Turn off to stop selling it." /> : null}
      {product ? <p className="text-xs text-muted">{[`ID ${product.id}`, updatedText(product.updatedAt)].filter(Boolean).join(" · ")}</p> : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button variant="primary" busy={busy} onClick={save} disabled={Boolean(problem)} title={problem ?? undefined} className="flex-[1.4]">
          {product ? "Save" : "Add to Shop"}
        </Button>
      </div>
      {problem && (f.name || f.price || product) ? <p className="-mt-2 text-right text-xs text-muted">{problem}</p> : null}
    </div>
  );
}

/* ---------------- categories ---------------- */

function Categories({ data, error, loading, onEdit, onAdd }: { data: ShopCategory[] | null; error: string | null; loading: boolean; onEdit: (c: ShopCategory) => void; onAdd: () => void }) {
  const sorted = useMemo(() => [...(data ?? [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name)), [data]);
  return (
    <>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Card>
        {loading && !data ? (
          <Loading />
        ) : sorted.length ? (
          <ul className="divide-y divide-line">
            {sorted.map((c) => (
              <li key={c.id} className={`flex items-center gap-3 px-4 py-3 ${c.active ? "" : "opacity-55"}`}>
                <button type="button" onClick={() => onEdit(c)} className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
                  {c.imageUrl ? <Thumb url={c.imageUrl} name={c.name} /> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cream/[0.06]"><FolderOpen className="h-5 w-5 text-muted" aria-hidden /></span>}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{c.name}</span>
                      {!c.active ? <Badge>Hidden</Badge> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{[`Order ${c.displayOrder ?? 0}`, c.description].filter(Boolean).join(" · ")}</span>
                  </span>
                </button>
                <StatusToggle kind="category" item={c} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            No categories yet. Add one, then add products to it.
            <span className="mt-3 flex justify-center">
              <Button variant="primary" onClick={onAdd}>
                <FolderPlus className="h-4 w-4" /> Add category
              </Button>
            </span>
          </Empty>
        )}
      </Card>
    </>
  );
}

function CategoryForm({ category, onClose }: { category: ShopCategory | null; onClose: () => void }) {
  const { changed, toast } = useAdmin();
  const [f, setF] = useState({
    name: category?.name ?? "",
    description: category?.description ?? "",
    imageUrl: category?.imageUrl ?? "",
    displayOrder: String(category?.displayOrder ?? 0),
    active: category?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const order = Number(f.displayOrder);
  const urlErr = urlProblem(f.imageUrl);
  const problem = !f.name.trim() ? "Give it a name." : !Number.isInteger(order) || order < 0 ? "Display order must be a whole number, 0 or more." : urlErr;

  const save = async () => {
    if (busy || problem) return;
    setBusy(true);
    setError(null);
    const body: CategoryInput = { name: f.name.trim(), description: f.description.trim(), imageUrl: f.imageUrl.trim(), displayOrder: order };
    try {
      const saved = category ? await shopCategoryService.update(category.id, body) : await shopCategoryService.create(body);
      const id = saved?.id ?? category?.id;
      if (category && f.active !== category.active && id !== undefined) await shopCategoryService.setActive(id, f.active);
      toast(category ? `${body.name} saved` : `${body.name} category added`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <div>
          <label className="label" htmlFor="bc-name">
            Name
          </label>
          <input id="bc-name" className="field" required maxLength={100} value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus={!category} />
        </div>
        <div>
          <label className="label" htmlFor="bc-order">
            Display order
          </label>
          <input id="bc-order" className="field" type="number" inputMode="numeric" min={0} step={1} value={f.displayOrder} onChange={(e) => set("displayOrder", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="bc-desc">
          Description
        </label>
        <textarea id="bc-desc" rows={2} maxLength={500} className="field resize-none" value={f.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="bc-image">
          Image link
        </label>
        <div className="flex items-center gap-3">
          <input id="bc-image" className="field" type="url" inputMode="url" placeholder="https://…" value={f.imageUrl} aria-invalid={Boolean(urlErr)} onChange={(e) => set("imageUrl", e.target.value)} />
          {f.imageUrl && !urlErr ? <Thumb key={f.imageUrl} url={f.imageUrl.trim()} name={f.name || "?"} size={40} /> : null}
        </div>
      </div>
      {category ? <Toggle checked={f.active} onChange={(v) => set("active", v)} label="Visible in the Shop" hint="Hidden categories can't get new products." /> : null}
      {category ? <p className="text-xs text-muted">{[`ID ${category.id}`, updatedText(category.updatedAt)].filter(Boolean).join(" · ")}</p> : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button variant="primary" busy={busy} onClick={save} disabled={Boolean(problem)} title={problem ?? undefined} className="flex-[1.4]">
          {category ? "Save" : "Add category"}
        </Button>
      </div>
      {problem && (f.name || category) ? <p className="-mt-2 text-right text-xs text-muted">{problem}</p> : null}
    </div>
  );
}

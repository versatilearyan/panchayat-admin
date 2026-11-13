/**
 * Parivar library: the admin makes categories (Badges, Chest art, Gifts ...) and uploads pictures and animations into them, one or many at once.
 * An item's ID is used as a COLLECTIBLE reward in Family Treasure chests, and its file link goes into any "Image URL" box of the Parivar settings.
 */
import { useCallback, useEffect, useState } from "react";
import { Copy, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useAdmin } from "../context";
import { apiRequest, apiUpload } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorNote, Loading, Toggle } from "./ui";
import { MediaPreview } from "./MediaParts";

const base = "/api/v1/admin/parivar/library";
type Cat = { id: number; name: string; sortOrder: number; active: boolean; items: number };
type Item = { id: number; categoryId: number | null; category: string | null; name: string; description: string | null; mediaUrl: string; path: string; format: string; rarity: string; active: boolean; usedInRewards: number };
const RARITIES = ["COMMON", "PREMIUM", "EPIC", "LEGENDARY", "ULTRA_RARE"];
const msg = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);

function useLibrary() {
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [c, i] = await Promise.all([apiRequest<Cat[]>(`${base}/categories`), apiRequest<Item[]>(base)]);
      setCats(c);
      setItems(i);
      setError(null);
    } catch (e) {
      setError(msg(e, "Could not load the library."));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { cats, items, error, load };
}

export function ParivarLibrary({ canSave }: { canSave: boolean }) {
  const { toast } = useAdmin();
  const { cats, items, error, load } = useLibrary();
  const [filter, setFilter] = useState<number | "all">("all");
  const [newCat, setNewCat] = useState("");
  const [catId, setCatId] = useState<number | "">("");
  const [rarity, setRarity] = useState("COMMON");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cats?.length && catId === "") setCatId(cats[0].id);
  }, [cats, catId]);

  const run = async (f: () => Promise<unknown>, ok?: string) => {
    try {
      await f();
      if (ok) toast(ok);
      await load();
    } catch (e) {
      toast(msg(e, "That did not work"), "error");
    }
  };

  const upload = async () => {
    if (!files.length || catId === "") return toast("Choose a category and at least one file", "error");
    setBusy(true);
    try {
      const form = new FormData();
      for (const f of files) form.append("file", f);
      form.append("categoryId", String(catId));
      form.append("rarity", rarity);
      if (files.length === 1 && name.trim()) form.append("name", name.trim());
      if (desc.trim()) form.append("description", desc.trim());
      await apiUpload(base, form).promise;
      toast(files.length === 1 ? "Added to the library" : `${files.length} items added`);
      setName("");
      setDesc("");
      setFiles([]);
      await load();
    } catch (e) {
      toast(msg(e, "Could not upload"), "error");
    } finally {
      setBusy(false);
    }
  };

  const shown = (items ?? []).filter((i) => filter === "all" || i.categoryId === filter);

  return (
    <>
      <Card title="Categories">
        <div className="space-y-3 px-4 py-3">
          <p className="text-xs text-muted">Make your own categories (for example Badges, Chest art, Gift art, Parivar logos). Every upload goes into one. People see the category name on what they win.</p>
          <div className="flex flex-wrap gap-2">
            {(cats ?? []).map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink px-3 py-1 text-xs font-semibold">
                {c.name} <span className="text-muted">{c.items}</span>
                <button
                  type="button"
                  disabled={!canSave}
                  className="text-muted hover:text-gold"
                  aria-label={`Rename ${c.name}`}
                  onClick={() => {
                    const n = window.prompt("Category name", c.name);
                    if (n && n.trim() && n.trim() !== c.name) void run(() => apiRequest(`${base}/categories/${c.id}`, { method: "PUT", body: { name: n.trim() } }), "Renamed");
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button type="button" disabled={!canSave} className="text-muted hover:text-coral" aria-label={`Delete ${c.name}`} onClick={() => window.confirm(`Delete the category "${c.name}"?`) && void run(() => apiRequest(`${base}/categories/${c.id}`, { method: "DELETE" }), "Deleted")}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input className="field h-9 w-64 py-1" maxLength={40} placeholder="New category name" value={newCat} onChange={(e) => setNewCat(e.target.value)} disabled={!canSave} />
            <Button
              size="sm"
              variant="gold"
              disabled={!canSave || !newCat.trim()}
              onClick={() =>
                void run(async () => {
                  await apiRequest(`${base}/categories`, { method: "POST", body: { name: newCat.trim() } });
                  setNewCat("");
                }, "Category added")
              }
            >
              <Plus className="h-4 w-4" /> Add category
            </Button>
          </div>
        </div>
      </Card>

      <Card className="mt-4" title="Upload to the library">
        <div className="space-y-3 px-4 py-3">
          <p className="text-xs text-muted">
            Pictures (PNG, JPG, GIF, WEBP) and animations (SVGA, MP4). Choose many files at once and each becomes an item named after its file. To use one: copy its <b>link</b> into any &quot;Image URL&quot; box (chests, shop, gifts, Parivar art), or
            use its <b>ID</b> as a <b>COLLECTIBLE</b> reward in the Family Treasure tab.
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-xs font-semibold text-muted">
              Category
              <select className="field mt-1 h-9 w-full py-1" value={catId} onChange={(e) => setCatId(Number(e.target.value))} disabled={!canSave}>
                {(cats ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Rarity
              <select className="field mt-1 h-9 w-full py-1" value={rarity} onChange={(e) => setRarity(e.target.value)} disabled={!canSave}>
                {RARITIES.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Name (for one file; with many files each is named after its file)
              <input className="field mt-1 h-9 w-full py-1" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} disabled={!canSave || files.length > 1} />
            </label>
          </div>
          <label className="block text-xs font-semibold text-muted">
            Short note (optional)
            <input className="field mt-1 h-9 w-full py-1" maxLength={200} value={desc} onChange={(e) => setDesc(e.target.value)} disabled={!canSave} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" multiple accept=".png,.jpg,.jpeg,.gif,.webp,.svga,.mp4" disabled={!canSave || busy} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="text-xs" />
            <Button variant="gold" busy={busy} disabled={!canSave || !files.length || catId === ""} onClick={() => void upload()}>
              <Upload className="h-4 w-4" /> Upload {files.length > 1 ? `${files.length} files` : ""}
            </Button>
          </div>
        </div>
      </Card>

      <Card
        className="mt-4"
        title="Library"
        action={
          <select className="field h-8 py-0 text-xs" value={filter} onChange={(e) => setFilter(e.target.value === "all" ? "all" : Number(e.target.value))} aria-label="Category">
            <option value="all">All categories</option>
            {(cats ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        }
      >
        {error ? (
          <ErrorNote>{error}</ErrorNote>
        ) : !items ? (
          <Loading />
        ) : !shown.length ? (
          <Empty>Nothing here yet.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <MediaPreview media={{ url: i.mediaUrl, format: i.format }} size={56} />
                <div className="min-w-[170px] flex-1">
                  <p className="text-sm font-bold text-cream">
                    {i.name} <span className="font-mono text-xs text-gold">ID {i.id}</span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <select className="field h-7 py-0 text-xs" value={i.categoryId ?? ""} disabled={!canSave} onChange={(e) => void run(() => apiRequest(`${base}/${i.id}`, { method: "PUT", body: { categoryId: Number(e.target.value) } }))} aria-label="Category">
                      {(cats ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select className="field h-7 py-0 text-xs" value={i.rarity} disabled={!canSave} onChange={(e) => void run(() => apiRequest(`${base}/${i.id}`, { method: "PUT", body: { rarity: e.target.value } }))} aria-label="Rarity">
                      {RARITIES.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    <Badge>{i.format}</Badge>
                    {i.usedInRewards > 0 ? <Badge tone="ok">in {i.usedInRewards} chest reward(s)</Badge> : null}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(i.path).then(() => toast("File link copied. Paste it in any Image URL box."));
                  }}
                >
                  <Copy className="h-4 w-4" /> Copy link
                </Button>
                <Toggle checked={i.active} onChange={(v) => void run(() => apiRequest(`${base}/${i.id}`, { method: "PUT", body: { active: v } }))} label="On" disabled={!canSave} />
                <Button
                  size="sm"
                  variant="danger"
                  disabled={!canSave}
                  onClick={() => window.confirm(`Delete "${i.name}"? People who already won it keep it.`) && void run(() => apiRequest(`${base}/${i.id}`, { method: "DELETE" }), "Deleted")}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

/** A small list of library items with their IDs, shown next to the chest rewards so the admin does not need to switch tabs. */
export function LibraryIds() {
  const { toast } = useAdmin();
  const { cats, items } = useLibrary();
  if (!items?.length) return null;
  const groups = (cats ?? []).map((c) => ({ c, list: items.filter((i) => i.categoryId === c.id && i.active) })).filter((g) => g.list.length);
  return (
    <Card className="mt-4" title="Library items you can use (click to copy the ID)">
      <div className="space-y-3 px-4 py-3">
        {groups.map(({ c, list }) => (
          <div key={c.id}>
            <p className="mb-1 text-[11px] font-bold tracking-wide text-muted uppercase">{c.name}</p>
            <div className="flex flex-wrap gap-2">
              {list.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  title={`${i.name} (${i.rarity})`}
                  className="flex items-center gap-2 rounded-xl border border-line bg-ink px-2 py-1 text-left text-xs hover:border-gold"
                  onClick={() => void navigator.clipboard?.writeText(String(i.id)).then(() => toast(`ID ${i.id} copied. Use it as the Item ID of a COLLECTIBLE reward.`))}
                >
                  <MediaPreview media={{ url: i.mediaUrl, format: i.format }} size={28} />
                  <span>
                    <span className="block max-w-[140px] truncate font-semibold">{i.name}</span>
                    <span className="font-mono text-gold">ID {i.id}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

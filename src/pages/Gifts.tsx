import { useMemo, useState } from "react";
import { Clock, Coins, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { adminApi, GIFT_CATEGORIES, type GiftCategory, type GiftInput, type GiftItem } from "../api";
import { useAdmin } from "../context";
import { FileField, FileImage } from "../components/media";
import { Badge, Button, Card, Chips, Empty, ErrorNote, fmtCoins, Loading, Modal, NumberField, PageHeader, timeAgo, Toggle, useLoad } from "../components/ui";

type Filter = "all" | "legendary" | "animated" | "soon" | "hidden";

export function GiftsPage() {
  const { version, changed, toast } = useAdmin();
  const { data, error, loading } = useLoad(() => adminApi.listGifts(), [version]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [edit, setEdit] = useState<GiftItem | "new" | null>(null);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter(
      (g) =>
        (!term || g.name.toLowerCase().includes(term) || g.id.includes(term)) &&
        (filter === "all" || (filter === "legendary" ? g.tier === "legendary" : filter === "animated" ? Boolean(g.svga) : filter === "soon" ? Boolean(g.comingSoon) : !g.active)),
    );
  }, [data, q, filter]);

  // Bulk "coming soon" works on the gifts shown right now (after search and filter)
  const shownSoon = list.filter((g) => g.comingSoon).length;
  const bulk = async (comingSoon: boolean) => {
    const n = comingSoon ? list.length - shownSoon : shownSoon;
    if (!window.confirm(comingSoon ? `Mark ${n} gift${n === 1 ? "" : "s"} as coming soon? People can see but not send them.` : `Release ${n} gift${n === 1 ? "" : "s"}? People can send them right away.`)) return;
    setBulkBusy(true);
    try {
      const changedCount = await adminApi.setGiftsComingSoon(
        list.map((g) => g.id),
        comingSoon,
      );
      toast(comingSoon ? `${changedCount} gifts marked coming soon` : `${changedCount} gifts released`);
      changed();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Gifts"
        sub="Gifts people send in rooms. Upload an SVGA animation for the full-screen effect."
        right={
          <Button variant="primary" onClick={() => setEdit("new")}>
            <Plus className="h-4 w-4" /> Add gift
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input className="field pl-9" placeholder="Search gifts" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search gifts" />
        </div>
        <Chips
          label="Filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All${data ? ` (${data.length})` : ""}` },
            { value: "legendary", label: "Legendary" },
            { value: "animated", label: "With SVGA" },
            { value: "soon", label: `Coming soon${data ? ` (${data.filter((g) => g.comingSoon).length})` : ""}` },
            { value: "hidden", label: "Hidden" },
          ]}
        />
      </div>
      {list.length ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-ink-2 px-3.5 py-2.5">
          <Clock className="h-4 w-4 text-info" aria-hidden />
          <p className="mr-auto text-sm text-muted">
            {shownSoon} of {list.length} {filter === "all" && !q.trim() ? "gifts" : "shown gifts"} are coming soon
          </p>
          <Button size="sm" variant="soft" busy={bulkBusy} disabled={shownSoon === list.length} onClick={() => bulk(true)}>
            Mark {filter === "all" && !q.trim() ? "all" : "shown"} as coming soon
          </Button>
          <Button size="sm" variant="ghost" busy={bulkBusy} disabled={shownSoon === 0} onClick={() => bulk(false)}>
            Release {filter === "all" && !q.trim() ? "all" : "shown"}
          </Button>
        </div>
      ) : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {loading && !data ? (
        <Loading />
      ) : list.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setEdit(g)}
              className={`group flex flex-col rounded-2xl border border-line bg-ink-2 p-3 text-left transition hover:border-line-strong hover:bg-surface ${g.active ? "" : "opacity-55"}`}
            >
              <div className="relative grid aspect-square place-items-center rounded-xl bg-[radial-gradient(circle_at_50%_40%,#2a2030,#111114_75%)]">
                {g.icon ? <FileImage fileRef={g.icon} className="h-3/4 w-3/4" /> : <GiftGlyph name={g.name} legendary={g.tier === "legendary"} />}
                {g.svga ? (
                  <span className="absolute top-1.5 right-1.5 rounded-md bg-coral/90 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-white">SVGA</span>
                ) : null}
              </div>
              <p className="mt-2.5 truncate text-sm font-semibold">{g.name}</p>
              <p className="mt-0.5 flex items-center gap-1 font-display text-[15px] font-bold text-gold">
                <Coins className="h-3.5 w-3.5" aria-hidden /> {fmtCoins(g.cost)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {g.tier === "legendary" ? <Badge tone="gold">Legendary</Badge> : null}
                {g.comingSoon ? (
                  <Badge tone="info">
                    <Clock className="h-3 w-3" /> Coming soon
                  </Badge>
                ) : null}
                {g.packageOnly ? <Badge tone="info">Package</Badge> : null}
                {!g.active ? <Badge tone="coral">Hidden</Badge> : null}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Card>
          <Empty>{data?.length ? "No gifts match." : "No gifts yet."}</Empty>
        </Card>
      )}
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === "new" ? "Add a gift" : edit ? `Edit ${edit.name}` : ""} wide>
        {edit ? <GiftForm key={edit === "new" ? "new" : edit.id} gift={edit === "new" ? null : edit} nextSort={(data?.length ?? 0) + 1} onClose={() => setEdit(null)} /> : null}
      </Modal>
    </>
  );
}

function GiftGlyph({ name, legendary }: { name: string; legendary: boolean }) {
  return (
    <span className={`grid h-14 w-14 place-items-center rounded-full font-display text-xl font-extrabold ${legendary ? "bg-gold/15 text-gold" : "bg-cream/[0.06] text-cream/80"}`}>
      {legendary ? <Sparkles className="h-6 w-6" aria-hidden /> : name.slice(0, 1)}
    </span>
  );
}

function GiftForm({ gift, nextSort, onClose }: { gift: GiftItem | null; nextSort: number; onClose: () => void }) {
  const { can, changed, toast } = useAdmin();
  const [f, setF] = useState<GiftInput>(
    gift ?? { name: "", cost: NaN, categories: ["Popular"], tier: "ordinary", active: true, sort: nextSort, blurb: "" },
  );
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof GiftInput>(k: K, v: GiftInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const priceLocked = Boolean(gift) && !can("pricing.edit");

  const toggleCat = (c: GiftCategory) => set("categories", f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c]);

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      const saved = await adminApi.saveGift({ ...f, cost: Number.isFinite(f.cost) ? f.cost : 0 });
      toast(gift ? `${saved.name} saved` : `${saved.name} added to the gift panel`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!gift) return;
    setBusy("delete");
    try {
      await adminApi.deleteGift(gift.id);
      toast(`${gift.name} deleted`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete");
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <div>
          <label className="label" htmlFor="g-name">
            Name
          </label>
          <input id="g-name" className="field" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Diwali Diya" autoFocus={!gift} />
        </div>
        <div>
          <label className="label" htmlFor="g-cost">
            Price
          </label>
          <NumberField id="g-cost" value={f.cost} onChange={(n) => set("cost", n)} disabled={priceLocked} suffix="coins" />
        </div>
      </div>
      {priceLocked ? <p className="-mt-3 text-xs text-muted">The price of an existing gift is view only for you.</p> : null}

      <FileField
        kind="svga"
        label="Animation (SVGA)"
        value={f.svga}
        onChange={(v) => set("svga", v)}
        hint="Plays full screen when someone sends this gift. Up to 15 MB. It's test-played before upload, so you'll see it here."
      />
      <FileField kind="image" label="Icon" value={f.icon} onChange={(v) => set("icon", v)} hint="Square PNG with a transparent background, shown in the gift panel. Up to 2 MB." />

      <div>
        <span className="label">Type</span>
        <Chips
          label="Type"
          value={f.tier}
          onChange={(v) => set("tier", v)}
          options={[
            { value: "ordinary", label: "Ordinary" },
            { value: "legendary", label: "Legendary (big animation + room banner)" },
          ]}
        />
      </div>

      <div>
        <span className="label">Gift panel tabs</span>
        <div className="flex flex-wrap gap-1.5">
          {GIFT_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={f.categories.includes(c)}
              onClick={() => toggleCat(c)}
              className={`h-8 rounded-full px-3 text-xs font-semibold ring-1 transition ${f.categories.includes(c) ? "bg-cream text-ink ring-cream" : "text-cream ring-line-strong hover:bg-cream/5"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="g-blurb">
          One-liner <span className="normal-case tracking-normal text-muted/70">(optional, shown in room chat)</span>
        </label>
        <input id="g-blurb" className="field" value={f.blurb ?? ""} onChange={(e) => set("blurb", e.target.value)} placeholder="e.g. Light up the room for Diwali" />
      </div>

      <div className="grid gap-4 sm:grid-cols-[120px_1fr] sm:items-start">
        <div>
          <label className="label" htmlFor="g-sort">
            Order
          </label>
          <NumberField id="g-sort" value={f.sort} onChange={(n) => set("sort", Number.isFinite(n) ? n : 0)} />
        </div>
        <div className="space-y-3 sm:pt-6">
          <Toggle checked={f.active} onChange={(v) => set("active", v)} label="Show in the gift panel" hint="Turn off to hide it without deleting it." />
          <Toggle checked={Boolean(f.comingSoon)} onChange={(v) => set("comingSoon", v)} label="Coming soon" hint="People see it with a “Coming soon” tag but can't send it yet." />
          <Toggle checked={Boolean(f.packageOnly)} onChange={(v) => set("packageOnly", v)} label="Package only" hint="Only given as a reward in people's Bag, never sold." />
        </div>
      </div>

      {gift ? (
        <p className="text-xs text-muted">
          Last changed by {gift.updatedBy} · {timeAgo(gift.updatedAt)}
          {gift.builtIn ? " · Built into the app" : ""}
        </p>
      ) : null}

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="flex flex-wrap gap-2 pt-1">
        {gift && can("gifts.delete") && !gift.builtIn ? (
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
          <Button variant="primary" busy={busy === "save"} onClick={save} disabled={!f.name.trim() || !(f.cost > 0)} className="flex-[1.4]">
            {gift ? "Save" : "Add gift"}
          </Button>
        </div>
      </div>
    </div>
  );
}


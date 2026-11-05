/**
 * Gifts, live from the backend (/api/v1/admin/manage/gifts).
 *
 * Add a gift with its name, price in coins, category and order, then its files:
 * a picture (PNG, JPG or JPEG), an animation (SVGA or MP4) and a sound (MP3).
 * A gift goes on sale once it has a picture. Super Admins, Admins and
 * Moderators manage gifts; only Super Admins can delete one.
 */
import { useEffect, useMemo, useState } from "react";
import { Coins, Pencil, Plus, Trash2 } from "lucide-react";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Button, Card, Chips, Empty, fmtCoins, Loading, Modal, NumberField, PageHeader, Toggle } from "../components/ui";
import { ConfirmDialog, Field, ListProblem, SearchBox, useList } from "../components/WalletParts";
import { mediaHref, MediaPreview, UploadSlot } from "../components/MediaParts";
import { GIFT_CATEGORIES, giftCatalogService, type ServerGift } from "../services/giftCatalogService";

type Dialog = { kind: "add" } | { kind: "edit"; id: string } | { kind: "delete"; gift: ServerGift } | null;

export function GiftsLivePage() {
  const { version, can } = useAdmin();
  const list = useList(() => giftCatalogService.list(), version);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");
  /** Edits made in the dialog show at once, before the list reloads. */
  const [local, setLocal] = useState<Record<string, ServerGift>>({});
  const gifts = useMemo(() => (list.data ?? []).map((g) => local[g.id] ?? g), [list.data, local]);
  const shown = gifts.filter((g) => (!cat || g.category === cat) && (!q || `${g.name} ${g.id}`.toLowerCase().includes(q.toLowerCase())));
  const editing = dialog?.kind === "edit" ? (gifts.find((g) => g.id === dialog.id) ?? null) : null;
  const put = (g: ServerGift) => setLocal((m) => ({ ...m, [g.id]: g }));
  // Which gifts send a server-wide notification (only these, whatever the count)
  const [announced, setAnnounced] = useState<Set<string>>(new Set());
  const { toast } = useAdmin();
  useEffect(() => {
    apiRequest<string[]>("/api/v1/admin/manage/gifts/announce")
      .then((ids) => setAnnounced(new Set(ids)))
      .catch(() => undefined);
  }, [version]);
  const setAnnounce = async (id: string, on: boolean) => {
    setAnnounced((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
    try {
      await apiRequest(`/api/v1/admin/manage/gifts/${encodeURIComponent(id)}/announce`, { method: "PUT", body: { announce: on } });
      toast(on ? "Server notification on for this gift" : "Server notification off");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save");
    }
  };

  return (
    <>
      <PageHeader
        title="Gifts"
        sub="Live from the server. Add gifts with a picture, an SVGA or MP4 animation and an MP3 sound, set prices, and choose what's on sale."
        right={
          <Button variant="primary" onClick={() => setDialog({ kind: "add" })}>
            <Plus className="h-4 w-4" /> Add gift
          </Button>
        }
      />
      {list.error ? <ListProblem error={list.error} onRetry={list.retry} /> : null}
      <Card
        title={list.data ? `${gifts.length} gifts · ${gifts.filter((g) => g.active).length} on sale` : "Gifts"}
        action={<SearchBox value={q} onChange={setQ} label="Search gifts" />}
      >
        <div className="border-b border-line px-4 py-3">
          <Chips label="Category" value={cat} onChange={setCat} options={[{ value: null, label: "All" }, ...GIFT_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
        </div>
        {list.loading && !list.data ? (
          <Loading />
        ) : !shown.length ? (
          <Empty>{gifts.length ? "No gifts match." : "No gifts yet. Add the first one."}</Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((g) => (
              <li key={g.id} className={`flex gap-3 rounded-2xl border border-line bg-ink/40 p-3 ${g.active ? "" : "opacity-70"}`}>
                <MediaPreview media={{ url: g.imageUrl, format: null }} size={64} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{g.name}</p>
                  <p className="flex items-center gap-1 text-sm text-gold">
                    <Coins className="h-3.5 w-3.5" aria-hidden /> {fmtCoins(g.price)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge tone={g.active ? "ok" : "muted"}>{g.active ? "On sale" : "Off"}</Badge>
                    <Badge>{g.category}</Badge>
                    {g.animationFormat ? <Badge tone="info">{g.animationFormat}</Badge> : null}
                    {g.soundUrl ? <Badge tone="gold">MP3</Badge> : null}
                  </div>
                  <div className="mt-2">
                    <Toggle checked={announced.has(g.id)} onChange={(v) => void setAnnounce(g.id, v)} label="Server notification" hint="Everyone sees a banner when someone sends it" />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Button size="sm" onClick={() => setDialog({ kind: "edit", id: g.id })} aria-label={`Edit ${g.name}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {can("catalog.delete") ? (
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "delete", gift: g })} aria-label={`Delete ${g.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={dialog?.kind === "add"} onClose={() => setDialog(null)} title="Add a gift" wide>
        {dialog?.kind === "add" ? (
          <GiftDetails
            gift={null}
            onSaved={(g) => {
              put(g);
              setDialog({ kind: "edit", id: g.id });
            }}
          />
        ) : null}
      </Modal>
      <Modal open={Boolean(editing)} onClose={() => setDialog(null)} title={editing ? `Edit ${editing.name}` : ""} wide>
        {editing ? <GiftEditor key={editing.id} gift={editing} onChange={put} onClose={() => setDialog(null)} /> : null}
      </Modal>
      {dialog?.kind === "delete" ? <DeleteGift gift={dialog.gift} onClose={() => setDialog(null)} /> : null}
    </>
  );
}

/** Name, price, category, order. New gifts start off sale until they have a picture. */
function GiftDetails({ gift, onSaved }: { gift: ServerGift | null; onSaved: (g: ServerGift) => void }) {
  const { toast, changed } = useAdmin();
  const [name, setName] = useState(gift?.name ?? "");
  const [price, setPrice] = useState(gift?.price ?? 1000);
  const [category, setCategory] = useState(gift?.category ?? "Popular");
  const [order, setOrder] = useState(gift?.sortOrder ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = !gift || name !== gift.name || price !== gift.price || category !== gift.category || order !== gift.sortOrder;

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError("Give the gift a name.");
    if (!(price >= 1)) return setError("Set a price of at least 1 coin.");
    setBusy(true);
    try {
      const body = { name: name.trim(), price, category, sortOrder: order };
      const g = gift ? await giftCatalogService.update(gift.id, body) : await giftCatalogService.create({ ...body, sortOrder: order || undefined, active: false });
      toast(gift ? "Gift saved" : "Gift added. Now upload its picture.");
      changed();
      onSaved(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the gift.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Field id="gift-name" label="Gift name">
        <input id="gift-name" className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Golden Lotus" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="gift-price" label="Price (coins)">
          <NumberField id="gift-price" value={price} onChange={setPrice} suffix="coins" />
        </Field>
        <Field id="gift-order" label="Order" hint={gift ? undefined : "0 = at the end"}>
          <NumberField id="gift-order" value={order} onChange={setOrder} />
        </Field>
      </div>
      <Field id="gift-cat" label="Category">
        <select id="gift-cat" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
          {GIFT_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-[#ff9095]">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button variant="primary" busy={busy} disabled={!dirty} onClick={save}>
          {gift ? "Save details" : "Add gift"}
        </Button>
      </div>
    </div>
  );
}

function GiftEditor({ gift, onChange, onClose }: { gift: ServerGift; onChange: (g: ServerGift) => void; onClose: () => void }) {
  const { toast, changed } = useAdmin();
  const [busy, setBusy] = useState(false);
  const done = (g: ServerGift, msg: string) => {
    onChange(g);
    changed();
    toast(msg);
  };
  const err = (m: string) => toast(m, "error");
  const setActive = async (active: boolean) => {
    setBusy(true);
    try {
      done(await giftCatalogService.update(gift.id, { active }), active ? "On sale in the app" : "Taken off sale");
    } catch (e) {
      err(e instanceof Error ? e.message : "Couldn't change it.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <GiftDetails gift={gift} onSaved={onChange} />
      <div className="space-y-2.5 border-t border-line pt-4">
        <p className="label">Files</p>
        <UploadSlot
          label="Picture (required)"
          hint="PNG, JPG or JPEG · up to 10 MB · shown in the gift panel"
          exts={["png", "jpg", "jpeg"]}
          current={{ url: gift.imageUrl, format: null }}
          upload={(f, p) => giftCatalogService.upload(gift.id, "image", f, p)}
          onDone={(g) => done(g, "Picture uploaded")}
          onError={err}
        />
        <UploadSlot
          label="Animation"
          hint="SVGA or MP4 · up to 100 MB · plays when the gift is sent"
          exts={["svga", "mp4"]}
          current={{ url: gift.animationUrl, format: gift.animationFormat }}
          upload={(f, p) => giftCatalogService.upload(gift.id, "animation", f, p)}
          onDone={(g) => done(g, "Animation uploaded")}
          onRemove={async () => done(await giftCatalogService.removeFile(gift.id, "animation"), "Animation removed")}
          onError={err}
        />
        <UploadSlot
          label="Sound"
          hint="MP3 · up to 20 MB · plays with the animation"
          exts={["mp3"]}
          current={{ url: gift.soundUrl, format: gift.soundUrl ? "MP3" : null }}
          upload={(f, p) => giftCatalogService.upload(gift.id, "sound", f, p)}
          onDone={(g) => done(g, "Sound uploaded")}
          onRemove={async () => done(await giftCatalogService.removeFile(gift.id, "sound"), "Sound removed")}
          onError={err}
        />
        {gift.soundUrl ? <audio src={mediaHref(gift.soundUrl) ?? undefined} controls className="w-full" /> : null}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <Toggle
          checked={gift.active}
          disabled={busy || (!gift.active && !gift.imageUrl)}
          onChange={setActive}
          label="On sale"
          hint={gift.imageUrl ? "People can send it in the app" : "Upload a picture first"}
        />
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

function DeleteGift({ gift, onClose }: { gift: ServerGift; onClose: () => void }) {
  const { toast, changed } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await giftCatalogService.remove(gift.id);
      toast(`${gift.name} deleted`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete it.");
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog open title={`Delete ${gift.name}?`} confirmLabel="Delete gift" busy={busy} error={error} onConfirm={go} onClose={onClose}>
      It's removed from the app and its files are deleted. Gifts already sent stay in people's history. To hide it for now, turn off “On sale” instead.
    </ConfirmDialog>
  );
}

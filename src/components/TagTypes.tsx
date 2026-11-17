import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAdmin } from "../context";
import { apiRequest, apiUpload } from "../lib/api";
import { Badge, Button, Card, Loading, Toggle } from "./ui";
import { MediaPreview, UploadSlot } from "./MediaParts";

type TagType = { id: string; label: string; one: string; emoji: string; tint: string; deep: string; imageUrl?: string | null; animationUrl?: string | null; sortOrder: number; active: boolean };

const base = "/api/v1/admin/tags/types";
const msg = (e: unknown, d: string) => (e instanceof Error ? e.message : d);

/** Admin > Gifts: the relationship tags shown on mic seats. Change the name, colours, picture or animation, switch one off, or add a new one. */
export function TagTypesCard({ canSave }: { canSave: boolean }) {
  const { toast } = useAdmin();
  const [list, setList] = useState<TagType[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [nw, setNw] = useState({ id: "", label: "", one: "", emoji: "🏷️", tint: "#ffb3cf", deep: "#b0245a" });
  const load = useCallback(() => {
    apiRequest<TagType[]>(base).then(setList).catch(() => setList([]));
  }, []);
  useEffect(load, [load]);

  const add = async () => {
    try {
      await apiRequest(base, { method: "POST", body: { ...nw, sortOrder: (list?.length ?? 0) + 1 } });
      toast("Tag added");
      setAdding(false);
      setNw({ id: "", label: "", one: "", emoji: "🏷️", tint: "#ffb3cf", deep: "#b0245a" });
      load();
    } catch (e) {
      toast(msg(e, "Couldn't add"), "error");
    }
  };

  return (
    <Card
      title="Mic seat tags"
      className="mb-4"
      action={
        canSave ? (
          <Button size="sm" onClick={() => setAdding((a) => !a)}>
            <Plus className="h-4 w-4" aria-hidden /> Add tag
          </Button>
        ) : undefined
      }
    >
      <div className="p-4">
        <p className="text-sm text-muted">
          These are the tags that show between two mic seats and on profiles. Change the name, colours, picture or animation (PNG, JPG, GIF, WEBP, SVGA, MP4). If you add no picture, the drawn badge or the emoji is shown. An animation wins over a picture.
        </p>
        {adding ? (
          <div className="mt-3 grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-3">
            <label className="text-xs font-semibold">
              ID (small letters, no spaces)
              <input className="field mt-1 h-9" value={nw.id} maxLength={20} onChange={(e) => setNw({ ...nw, id: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "") })} />
            </label>
            <label className="text-xs font-semibold">
              Name
              <input className="field mt-1 h-9" value={nw.label} maxLength={40} onChange={(e) => setNw({ ...nw, label: e.target.value })} />
            </label>
            <label className="text-xs font-semibold">
              Short name (“Aryan's ___”)
              <input className="field mt-1 h-9" value={nw.one} maxLength={30} onChange={(e) => setNw({ ...nw, one: e.target.value })} />
            </label>
            <label className="text-xs font-semibold">
              Emoji
              <input className="field mt-1 h-9 w-24" value={nw.emoji} maxLength={8} onChange={(e) => setNw({ ...nw, emoji: e.target.value })} />
            </label>
            <label className="text-xs font-semibold">
              Light colour
              <input type="color" className="mt-1 block h-9 w-16" value={nw.tint} onChange={(e) => setNw({ ...nw, tint: e.target.value })} />
            </label>
            <label className="text-xs font-semibold">
              Deep colour
              <input type="color" className="mt-1 block h-9 w-16" value={nw.deep} onChange={(e) => setNw({ ...nw, deep: e.target.value })} />
            </label>
            <div className="sm:col-span-3">
              <Button variant="gold" size="sm" disabled={!nw.id || !nw.label} onClick={() => void add()}>
                Create tag
              </Button>
              <span className="ml-2 text-xs text-muted">After it is created, upload its picture or animation below.</span>
            </div>
          </div>
        ) : null}
        {!list ? (
          <Loading />
        ) : (
          <ul className="mt-4 space-y-3">
            {list.map((t) => (
              <TagRow key={t.id} t={t} canSave={canSave} onChanged={load} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function TagRow({ t, canSave, onChanged }: { t: TagType; canSave: boolean; onChanged: () => void }) {
  const { toast } = useAdmin();
  const [f, setF] = useState(t);
  useEffect(() => setF(t), [t]);
  const dirty = f.label !== t.label || f.one !== t.one || f.emoji !== t.emoji || f.tint !== t.tint || f.deep !== t.deep || f.sortOrder !== t.sortOrder;

  const patch = async (body: Partial<TagType>, ok: string) => {
    try {
      await apiRequest(`${base}/${t.id}`, { method: "PATCH", body });
      toast(ok);
      onChanged();
    } catch (e) {
      toast(msg(e, "Couldn't save"), "error");
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete the “${t.label}” tag? If people already hold it, it is only switched off.`)) return;
    try {
      const r = await apiRequest<{ deleted: boolean; inUse?: number }>(`${base}/${t.id}`, { method: "DELETE" });
      toast(r.deleted ? "Deleted" : `In use by ${r.inUse} tags, so it was switched off`);
      onChanged();
    } catch (e) {
      toast(msg(e, "Couldn't delete"), "error");
    }
  };
  const slot = (kind: "image" | "animation", label: string, exts: string[], url?: string | null) => (
    <UploadSlot<unknown>
      label={label}
      exts={exts}
      current={{ url: url ?? null, format: null }}
      upload={(file, onProgress) => {
        const form = new FormData();
        form.append("file", file);
        return apiUpload<unknown>(`${base}/${t.id}/upload/${kind}`, form, onProgress);
      }}
      onDone={() => {
        toast(`${label} saved`);
        onChanged();
      }}
      onRemove={
        url
          ? async () => {
              await apiRequest(`${base}/${t.id}/${kind}`, { method: "DELETE" });
              onChanged();
            }
          : undefined
      }
      onError={(m) => toast(m, "error")}
    />
  );

  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-ink ring-1 ring-line" style={{ background: `linear-gradient(135deg, ${t.tint}, ${t.deep})` }}>
          {t.animationUrl || t.imageUrl ? <MediaPreview media={{ url: t.animationUrl || t.imageUrl || null, format: null }} size={48} /> : <span className="text-2xl">{t.emoji}</span>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {t.label} <span className="text-xs font-normal text-muted">#{t.id}</span>
          </p>
          <Badge tone={t.active ? "ok" : "muted"}>{t.active ? "On" : "Off"}</Badge>
        </div>
        {canSave ? (
          <>
            <Toggle checked={t.active} onChange={(on) => void patch({ active: on }, on ? "Switched on" : "Switched off")} label={t.active ? "On" : "Off"} />
            <Button size="sm" variant="danger" onClick={() => void remove()} aria-label={`Delete ${t.label}`}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </>
        ) : null}
      </div>
      {canSave ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <label className="text-xs font-semibold">
            Name
            <input className="field mt-1 h-9" value={f.label} maxLength={40} onChange={(e) => setF({ ...f, label: e.target.value })} />
          </label>
          <label className="text-xs font-semibold">
            Short name
            <input className="field mt-1 h-9" value={f.one} maxLength={30} onChange={(e) => setF({ ...f, one: e.target.value })} />
          </label>
          <label className="text-xs font-semibold">
            Emoji
            <input className="field mt-1 h-9" value={f.emoji} maxLength={8} onChange={(e) => setF({ ...f, emoji: e.target.value })} />
          </label>
          <label className="text-xs font-semibold">
            Order
            <input className="field mt-1 h-9" inputMode="numeric" value={String(f.sortOrder)} onChange={(e) => setF({ ...f, sortOrder: Number(e.target.value.replace(/\D/g, "")) })} />
          </label>
          <label className="text-xs font-semibold">
            Light colour
            <input type="color" className="mt-1 block h-9 w-16" value={f.tint} onChange={(e) => setF({ ...f, tint: e.target.value })} />
          </label>
          <label className="text-xs font-semibold">
            Deep colour
            <input type="color" className="mt-1 block h-9 w-16" value={f.deep} onChange={(e) => setF({ ...f, deep: e.target.value })} />
          </label>
          <div className="flex items-end sm:col-span-2">
            <Button variant="gold" size="sm" disabled={!dirty} onClick={() => void patch({ label: f.label, one: f.one, emoji: f.emoji, tint: f.tint, deep: f.deep, sortOrder: f.sortOrder }, "Saved")}>
              Save changes
            </Button>
          </div>
          <div className="sm:col-span-2">{slot("image", "Picture", ["PNG", "JPG", "GIF", "WEBP"], t.imageUrl)}</div>
          <div className="sm:col-span-2">{slot("animation", "Animation", ["SVGA", "MP4"], t.animationUrl)}</div>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Special events: the cards on the app's Discover screen. Add, change, switch off, reorder or delete them,
 * and set when each one shows (start and end are optional). Reads /api/v1/admin/manage/events.
 */
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorNote, Loading, Modal, PageHeader, Toggle } from "../components/ui";
import { AssetUpload, type AssetUploadState } from "../components/AssetUpload";

type Ev = {
  id: number;
  title: string;
  whenText: string;
  body: string;
  theme: string;
  motif: string;
  active: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  imageUrl: string | null;
  section: string | null;
  tag: string | null;
  tagColor: string | null;
  link: string | null;
};
type Form = { title: string; whenText: string; body: string; theme: string; motif: string; active: boolean; sortOrder: number; startsAt: string; endsAt: string; imageUrl: string; section: string; tag: string; tagColor: string; link: string };

/** Where an event goes when tapped in the app's Event Center. */
const LINKS: { value: string; label: string }[] = [
  { value: "", label: "Nothing (just the banner)" },
  { value: "shop", label: "Shop" },
  { value: "pk", label: "PK Coins & PK ranking" },
  { value: "ranking", label: "Rankings" },
  { value: "recharge", label: "Recharge (add coins)" },
  { value: "parivar", label: "Parivar (family)" },
  { value: "games", label: "Games" },
  { value: "vip", label: "VIP" },
  { value: "tasks", label: "Daily tasks" },
  { value: "room", label: "A room (room ID)" },
  { value: "web", label: "A web page (https://)" },
];
const SECTIONS = ["Bonus", "Recommend", "PK", "Family", "Festival"];

const THEMES = ["gold", "ember", "night", "dusk", "rose", "monsoon"];
const MOTIFS = ["lanterns", "kites", "river", "banyan", "temple", "huts"];
const base = "/api/v1/admin/manage/events";
const EMPTY: Form = { title: "", whenText: "", body: "", theme: "gold", motif: "lanterns", active: true, sortOrder: 0, startsAt: "", endsAt: "", imageUrl: "", section: "Recommend", tag: "", tagColor: "#2f6bf0", link: "" };

/** The link the server stores, from the form's choice (room:<id>, https://…, or a page name). */
const linkOut = (f: Form) => {
  const l = f.link.trim();
  // A room or page picked but not filled in yet: no link
  if (!l || l === "room:" || l === "https://") return null;
  return l;
};
const linkKind = (l: string) => (l.startsWith("room:") ? "room" : l.startsWith("https://") ? "web" : l);
const formOf = (ev: Ev): Form => ({
  title: ev.title,
  whenText: ev.whenText,
  body: ev.body,
  theme: ev.theme,
  motif: ev.motif,
  active: ev.active,
  sortOrder: ev.sortOrder,
  startsAt: toLocal(ev.startsAt),
  endsAt: toLocal(ev.endsAt),
  imageUrl: ev.imageUrl ?? "",
  section: ev.section ?? "Recommend",
  tag: ev.tag ?? "",
  tagColor: ev.tagColor ?? "#2f6bf0",
  link: ev.link ?? "",
});
const bodyOf = (f: Form) => ({
  title: f.title,
  whenText: f.whenText,
  body: f.body,
  theme: f.theme,
  motif: f.motif,
  active: f.active,
  sortOrder: Number(f.sortOrder) || 0,
  startsAt: toIso(f.startsAt),
  endsAt: toIso(f.endsAt),
  imageUrl: f.imageUrl.trim() || null,
  section: f.section.trim() || "Recommend",
  tag: f.tag.trim() || null,
  tagColor: f.tag.trim() ? f.tagColor : null,
  link: linkOut(f),
});

// <input type="datetime-local"> works in local time; the server wants an exact moment
function toLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

export function EventsPage() {
  const { toast } = useAdmin();
  const [rows, setRows] = useState<Ev[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: number | null; form: Form } | null>(null);
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<AssetUploadState>("idle");
  // The Event Center button on the app's home screen: on or off
  const [center, setCenter] = useState<boolean | null>(null);
  useEffect(() => {
    apiRequest<{ enabled: boolean }>("/api/v1/events/center")
      .then((r) => setCenter(r.enabled))
      .catch(() => setCenter(false));
  }, []);
  const flipCenter = async (on: boolean) => {
    const was = center;
    setCenter(on);
    try {
      await apiRequest(`${base}/center`, { method: "PUT", body: { enabled: on } });
      toast(on ? "Event Center home screen par chalu" : "Event Center band");
    } catch (e) {
      setCenter(was);
      toast(e instanceof Error ? e.message : "Couldn't change it.");
    }
  };

  const load = useCallback(() => {
    apiRequest<Ev[]>(base)
      .then((r) => {
        setRows(r);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the events."));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    if (!editing) return;
    const f = editing.form;
    setBusy(true);
    try {
      const body = bodyOf(f);
      if (editing.id === null) await apiRequest(base, { method: "POST", body });
      else await apiRequest(`${base}/${editing.id}`, { method: "PUT", body });
      toast(editing.id === null ? "Event add ho gaya" : "Event badal diya");
      setEditing(null);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  const flip = async (ev: Ev) => {
    try {
      await apiRequest(`${base}/${ev.id}`, { method: "PUT", body: { ...bodyOf(formOf(ev)), active: !ev.active } });
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't change it.");
    }
  };

  const remove = async (ev: Ev) => {
    if (!window.confirm(`"${ev.title}" hata dein?`)) return;
    try {
      await apiRequest(`${base}/${ev.id}`, { method: "DELETE" });
      toast("Event hata diya");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't delete.");
    }
  };

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));

  return (
    <>
      <PageHeader
        title="Events & Event Center"
        sub="Home screen ke Event Center (aur Discover) me dikhne wale events. Banner, section (Bonus / Recommend …), corner tag (PK, Recharge …) aur tap karne par kya khule, sab yahin se."
        right={
          <Button variant="primary" onClick={() => setEditing({ id: null, form: { ...EMPTY, sortOrder: (rows?.length ?? 0) + 1 } })}>
            <Plus className="h-4 w-4" aria-hidden /> Naya event
          </Button>
        }
      />
      <Card className="mb-3 p-4">
        {center === null ? (
          <Loading />
        ) : (
          <Toggle
            checked={center}
            onChange={(v) => void flipCenter(v)}
            label="Event Center on the home screen"
            hint="On: home screen par 'Events' button dikhega jo Event Center kholta hai. Off: button chhup jata hai (events Discover me dikhte rahenge)."
          />
        )}
      </Card>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Card>
          <Empty>Koi event nahi hai. "Naya event" se pehla jodo.</Empty>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((ev) => (
            <Card key={ev.id}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-sm font-black text-muted">{ev.sortOrder}</span>
                {ev.imageUrl ? <img src={ev.imageUrl} alt="" className="h-12 w-20 rounded-lg object-cover" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{ev.title}</p>
                  <p className="truncate text-xs text-muted">
                    {ev.section ?? "Recommend"}
                    {ev.tag ? ` · tag ${ev.tag}` : ""}
                    {ev.link ? ` · opens ${ev.link}` : ""} · {ev.whenText || "—"}
                    {ev.startsAt ? ` · se ${new Date(ev.startsAt).toLocaleString()}` : ""}
                    {ev.endsAt ? ` · tak ${new Date(ev.endsAt).toLocaleString()}` : ""}
                  </p>
                </div>
                <Badge tone={ev.active ? "ok" : "muted"}>{ev.active ? "On" : "Off"}</Badge>
                <Button size="sm" onClick={() => void flip(ev)}>
                  {ev.active ? "Band karo" : "Chalu karo"}
                </Button>
                <Button size="sm" onClick={() => setEditing({ id: ev.id, form: formOf(ev) })}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden /> Badlo
                </Button>
                <Button size="sm" variant="danger" onClick={() => void remove(ev)} aria-label={`Delete ${ev.title}`}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
              {ev.body ? <p className="mt-2 text-sm text-muted">{ev.body}</p> : null}
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id === null ? "Naya event" : "Event badlo"}>
        {editing ? (
          <div className="space-y-3">
            <label className="block text-sm font-semibold">
              Title
              <input className="field mt-1" value={editing.form.title} maxLength={80} onChange={(e) => set("title", e.target.value)} placeholder="Diwali Mehfil Week" autoFocus />
            </label>
            <label className="block text-sm font-semibold">
              Kab (jaisa card par dikhe)
              <input className="field mt-1" value={editing.form.whenText} maxLength={80} onChange={(e) => set("whenText", e.target.value)} placeholder="Starts in 3 days / Live now / Every Saturday, 9 PM" />
            </label>
            <label className="block text-sm font-semibold">
              Description
              <textarea className="field mt-1 min-h-[72px]" value={editing.form.body} maxLength={240} onChange={(e) => set("body", e.target.value)} />
            </label>
            <div>
              <p className="text-sm font-semibold">Banner (Event Center card)</p>
              <AssetUpload id="ev-banner" value={editing.form.imageUrl} onChange={(ref) => set("imageUrl", ref)} onStateChange={setUpload} />
              <p className="mt-1 text-xs text-muted">Wide picture, about 2:1 (e.g. 660×330). Bina banner ke card theme ke rang me banega.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold">
                Section
                <input className="field mt-1" list="ev-sections" maxLength={30} value={editing.form.section} onChange={(e) => set("section", e.target.value)} placeholder="Recommend" />
                <datalist id="ev-sections">
                  {SECTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <label className="block text-sm font-semibold">
                Corner tag (optional)
                <span className="mt-1 flex gap-2">
                  <input className="field" maxLength={20} value={editing.form.tag} onChange={(e) => set("tag", e.target.value)} placeholder="PK / Recharge / Family" />
                  <input type="color" className="h-10 w-12 shrink-0 cursor-pointer rounded-lg bg-transparent" value={editing.form.tagColor} onChange={(e) => set("tagColor", e.target.value)} aria-label="Tag colour" />
                </span>
              </label>
              <label className="col-span-2 block text-sm font-semibold">
                Tap karne par kya khule
                <span className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <select
                    className="field"
                    value={linkKind(editing.form.link)}
                    onChange={(e) => set("link", e.target.value === "room" ? "room:" : e.target.value === "web" ? "https://" : e.target.value)}
                  >
                    {LINKS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  {linkKind(editing.form.link) === "room" ? (
                    <input className="field" inputMode="numeric" value={editing.form.link.slice(5)} onChange={(e) => set("link", `room:${e.target.value.replace(/\D/g, "")}`)} placeholder="Room ID" />
                  ) : linkKind(editing.form.link) === "web" ? (
                    <input className="field" type="url" value={editing.form.link} onChange={(e) => set("link", e.target.value)} placeholder="https://panchayat.world/…" />
                  ) : null}
                </span>
              </label>
              <label className="block text-sm font-semibold">
                Rang (theme)
                <select className="field mt-1" value={editing.form.theme} onChange={(e) => set("theme", e.target.value)}>
                  {THEMES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Tasveer (motif)
                <select className="field mt-1" value={editing.form.motif} onChange={(e) => set("motif", e.target.value)}>
                  {MOTIFS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Shuru (optional)
                <input className="field mt-1" type="datetime-local" value={editing.form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
              </label>
              <label className="block text-sm font-semibold">
                Khatam (optional)
                <input className="field mt-1" type="datetime-local" value={editing.form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
              </label>
              <label className="block text-sm font-semibold">
                Number (order)
                <input className="field mt-1" type="number" value={editing.form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} />
              </label>
            </div>
            <Toggle checked={editing.form.active} onChange={(v) => set("active", v)} label="App me dikhao" hint="Band karoge to card app se hat jayega, par yahan bacha rahega." />
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="primary" busy={busy} disabled={!editing.form.title.trim() || upload !== "idle"} onClick={() => void save()}>
                Save
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

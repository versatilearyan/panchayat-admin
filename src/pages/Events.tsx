/**
 * Special events: the cards on the app's Discover screen. Add, change, switch off, reorder or delete them,
 * and set when each one shows (start and end are optional). Reads /api/v1/admin/manage/events.
 */
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorNote, Loading, Modal, PageHeader, Toggle } from "../components/ui";

type Ev = { id: number; title: string; whenText: string; body: string; theme: string; motif: string; active: boolean; sortOrder: number; startsAt: string | null; endsAt: string | null };
type Form = { title: string; whenText: string; body: string; theme: string; motif: string; active: boolean; sortOrder: number; startsAt: string; endsAt: string };

const THEMES = ["gold", "ember", "night", "dusk", "rose", "monsoon"];
const MOTIFS = ["lanterns", "kites", "river", "banyan", "temple", "huts"];
const base = "/api/v1/admin/manage/events";
const EMPTY: Form = { title: "", whenText: "", body: "", theme: "gold", motif: "lanterns", active: true, sortOrder: 0, startsAt: "", endsAt: "" };

// <input type="datetime-local"> works in local time; the server wants an exact moment
const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);

export function EventsPage() {
  const { toast } = useAdmin();
  const [rows, setRows] = useState<Ev[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: number | null; form: Form } | null>(null);
  const [busy, setBusy] = useState(false);

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
      const body = { title: f.title, whenText: f.whenText, body: f.body, theme: f.theme, motif: f.motif, active: f.active, sortOrder: Number(f.sortOrder) || 0, startsAt: toIso(f.startsAt), endsAt: toIso(f.endsAt) };
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
      await apiRequest(`${base}/${ev.id}`, { method: "PUT", body: { ...ev, active: !ev.active } });
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
        title="Special events"
        sub="App ke Discover screen par dikhne wale event cards. Yahin se badlo, band karo ya naye jodo."
        right={
          <Button variant="primary" onClick={() => setEditing({ id: null, form: { ...EMPTY, sortOrder: (rows?.length ?? 0) + 1 } })}>
            <Plus className="h-4 w-4" aria-hidden /> Naya event
          </Button>
        }
      />
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
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{ev.title}</p>
                  <p className="truncate text-xs text-muted">
                    {ev.whenText || "—"} · {ev.theme}/{ev.motif}
                    {ev.startsAt ? ` · se ${new Date(ev.startsAt).toLocaleString()}` : ""}
                    {ev.endsAt ? ` · tak ${new Date(ev.endsAt).toLocaleString()}` : ""}
                  </p>
                </div>
                <Badge tone={ev.active ? "ok" : "muted"}>{ev.active ? "On" : "Off"}</Badge>
                <Button size="sm" onClick={() => void flip(ev)}>
                  {ev.active ? "Band karo" : "Chalu karo"}
                </Button>
                <Button size="sm" onClick={() => setEditing({ id: ev.id, form: { title: ev.title, whenText: ev.whenText, body: ev.body, theme: ev.theme, motif: ev.motif, active: ev.active, sortOrder: ev.sortOrder, startsAt: toLocal(ev.startsAt), endsAt: toLocal(ev.endsAt) } })}>
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
            <div className="grid grid-cols-2 gap-3">
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
              <Button variant="primary" busy={busy} disabled={!editing.form.title.trim()} onClick={() => void save()}>
                Save
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

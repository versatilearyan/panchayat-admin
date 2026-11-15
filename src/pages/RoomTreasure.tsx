/**
 * Room treasure ("Daily Task" in a voice room), live backend:
 *  - Boxes open as a person spends time in voice rooms today (India time). Each box has the minutes it needs, its coins, and can be VIP only.
 *  - Following a room, sending a gift and sending a message each take a few minutes off the wait (once a day). 0 hides that task.
 */
import { useCallback, useEffect, useState } from "react";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorNote, Loading, NumberField, PageHeader, Toggle } from "../components/ui";
import { NeedsBackend } from "../components/WalletParts";

type Box = { id: string; minutes: number; coins: number; vipOnly: boolean; active: boolean };
type Settings = { enabled: boolean; bonusFollow: number; bonusGift: number; bonusMessage: number };
type All = { settings: Settings; boxes: Box[] };
const base = "/api/v1/admin/manage/room-treasure";

export function RoomTreasurePage() {
  if (!BACKEND_ENABLED) return <NeedsBackend what="Room treasure" />;
  return <Live />;
}

function Live() {
  const { toast, version } = useAdmin();
  const [data, setData] = useState<All | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await apiRequest<All>(base));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load Room treasure.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, version]);

  return (
    <>
      <PageHeader title="Room treasure" sub="The Daily Task button inside a voice room: treasure boxes that open as people spend time in rooms." />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!data ? (
        <Loading />
      ) : (
        <div className="space-y-5">
          <SettingsCard key={JSON.stringify(data.settings)} settings={data.settings} onSaved={setData} toast={toast} />
          <BoxesCard boxes={data.boxes} onChanged={setData} toast={toast} />
        </div>
      )}
    </>
  );
}

type Toast = (t: string, tone?: "ok" | "error") => void;

function SettingsCard({ settings, onSaved, toast }: { settings: Settings; onSaved: (d: All) => void; toast: Toast }) {
  const [f, setF] = useState<Settings>(settings);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(settings);
  const n = (v: number) => (Number.isFinite(v) ? v : 0);
  const save = async () => {
    setBusy(true);
    try {
      onSaved(await apiRequest<All>(`${base}/settings`, { method: "PUT", body: { enabled: f.enabled, bonusFollow: n(f.bonusFollow), bonusGift: n(f.bonusGift), bonusMessage: n(f.bonusMessage) } }));
      toast("Saved");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  };
  const row = (label: string, key: "bonusFollow" | "bonusGift" | "bonusMessage") => (
    <label className="block text-sm font-semibold">
      {label}
      <div className="mt-1 max-w-[220px]">
        <NumberField value={f[key]} onChange={(v) => setF((x) => ({ ...x, [key]: v }))} suffix="min" />
      </div>
    </label>
  );
  return (
    <Card title="Switch and tasks">
      <div className="space-y-4 p-4">
        <Toggle checked={f.enabled} onChange={(v) => setF((x) => ({ ...x, enabled: v }))} label="Show Daily Task in voice rooms" hint="Off: nobody sees the button. Time already counted today is kept." />
        <p className="text-xs text-muted">Minutes each task takes off the wait, once a day (0 hides the task):</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {row("Follow a voice room", "bonusFollow")}
          {row("Send a gift", "bonusGift")}
          {row("Send a message", "bonusMessage")}
        </div>
        <Button variant="primary" busy={busy} disabled={!dirty} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </Card>
  );
}

function BoxesCard({ boxes, onChanged, toast }: { boxes: Box[]; onChanged: (d: All) => void; toast: Toast }) {
  const [nm, setNm] = useState<number>(10);
  const [nc, setNc] = useState<number>(100);
  const [nv, setNv] = useState(false);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try {
      onChanged(await apiRequest<All>(`${base}/boxes`, { method: "POST", body: { minutes: Number.isFinite(nm) ? nm : 0, coins: Number.isFinite(nc) ? nc : 0, vipOnly: nv, active: true } }));
      toast("Box added");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't add", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={`${boxes.length} boxes`}>
      <p className="px-4 pt-3 text-xs text-muted">Normal boxes and VIP-only boxes each open in order of their minutes. A person opens each box once a day. Time counts only while they are in an open voice room.</p>
      {!boxes.length ? (
        <Empty>No boxes yet. Add one below.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {boxes.map((b) => (
            <BoxRow key={`${b.id}-${b.minutes}-${b.coins}-${b.vipOnly}-${b.active}`} box={b} onChanged={onChanged} toast={toast} />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-3 border-t border-line px-4 py-4">
        <label className="text-xs font-semibold text-muted">
          Minutes
          <div className="mt-1 w-32">
            <NumberField value={nm} onChange={setNm} suffix="min" />
          </div>
        </label>
        <label className="text-xs font-semibold text-muted">
          Coins
          <div className="mt-1 w-40">
            <NumberField value={nc} onChange={setNc} suffix="coins" />
          </div>
        </label>
        <Toggle checked={nv} onChange={setNv} label="VIP only" />
        <Button variant="primary" busy={busy} onClick={() => void add()}>
          Add box
        </Button>
      </div>
    </Card>
  );
}

function BoxRow({ box, onChanged, toast }: { box: Box; onChanged: (d: All) => void; toast: Toast }) {
  const [m, setM] = useState<number>(box.minutes);
  const [c, setC] = useState<number>(box.coins);
  const [v, setV] = useState(box.vipOnly);
  const [a, setA] = useState(box.active);
  const [busy, setBusy] = useState(false);
  const dirty = m !== box.minutes || c !== box.coins || v !== box.vipOnly || a !== box.active;
  const save = async () => {
    setBusy(true);
    try {
      onChanged(await apiRequest<All>(`${base}/boxes/${encodeURIComponent(box.id)}`, { method: "PUT", body: { minutes: Number.isFinite(m) ? m : 0, coins: Number.isFinite(c) ? c : 0, vipOnly: v, active: a } }));
      toast("Saved");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete the ${box.minutes}-minute box?`)) return;
    setBusy(true);
    try {
      onChanged(await apiRequest<All>(`${base}/boxes/${encodeURIComponent(box.id)}`, { method: "DELETE" }));
      toast("Box deleted");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't delete", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex flex-wrap items-end gap-3 px-4 py-3">
      <label className="text-xs font-semibold text-muted">
        Minutes
        <div className="mt-1 w-28">
          <NumberField value={m} onChange={setM} suffix="min" />
        </div>
      </label>
      <label className="text-xs font-semibold text-muted">
        Coins
        <div className="mt-1 w-40">
          <NumberField value={c} onChange={setC} suffix="coins" />
        </div>
      </label>
      <Toggle checked={v} onChange={setV} label="VIP only" />
      <Toggle checked={a} onChange={setA} label="On" />
      {!a ? <Badge tone="muted">Hidden</Badge> : null}
      <span className="ml-auto flex gap-2">
        <Button size="sm" variant="primary" busy={busy} disabled={!dirty} onClick={() => void save()}>
          Save
        </Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => void remove()}>
          Delete
        </Button>
      </span>
    </li>
  );
}

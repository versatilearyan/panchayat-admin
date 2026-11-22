import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { type AppSettings } from "../api";
import { useAdmin } from "../context";
import { BACKEND_ENABLED } from "../config/api";
import { apiRequest } from "../lib/api";
import { Button, Card, ErrorNote, Loading, NumberField, PageHeader, timeAgo, Toggle, useLoad } from "../components/ui";

type Draft = Omit<AppSettings, "updatedAt" | "updatedBy">;

const SETTINGS_PATH = "/api/v1/admin/settings";

export function SettingsPage() {
  const { version } = useAdmin();
  const { data, error } = useLoad(() => apiRequest<AppSettings>(SETTINGS_PATH), [version]);
  return (
    <>
      <PageHeader title="App settings" sub="Switches that change the Panchayat app for everyone." />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {data ? <SettingsForm key={data.updatedAt} settings={data} /> : <Loading />}
      {BACKEND_ENABLED ? <MoveFromCloudinary /> : null}
    </>
  );
}

function SettingsForm({ settings }: { settings: AppSettings }) {
  const { can, changed, toast } = useAdmin();
  const isSuper = can("settings.edit");
  const { updatedAt, updatedBy, ...initial } = settings;
  const [f, setF] = useState<Draft>(initial);
  const [etaMinutes, setEtaMinutes] = useState(() => (initial.maintenanceUntil ? Math.max(1, Math.round((initial.maintenanceUntil - Date.now()) / 60_000)) : 10));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setF((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(initial) || (f.maintenance && etaMinutes !== Math.max(1, Math.round(((initial.maintenanceUntil ?? 0) - Date.now()) / 60_000)));

  const save = async () => {
    const turningOn = f.maintenance && !initial.maintenance;
    if (turningOn && !window.confirm("Turn on maintenance mode? Every user is locked out of the app, and everyone with the app open right now gets an email about it.")) return;
    setBusy(true);
    try {
      const maintenanceUntil = f.maintenance ? Date.now() + etaMinutes * 60_000 : null;
      await apiRequest<AppSettings>(SETTINGS_PATH, {
        method: "PUT",
        body: { ...f, maintenanceUntil, signupBonusCoins: f.signupBonusCoins || 0, dailyCheckinCoins: f.dailyCheckinCoins || 0, roomCreateMinLevel: f.roomCreateMinLevel || 0 },
      });
      toast(turningOn ? "Maintenance mode is on" : "Settings saved");
      changed();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card title="Maintenance" className={f.maintenance ? "border-coral/40" : ""}>
        <div className="space-y-4 px-4 py-4">
          <Toggle checked={f.maintenance} onChange={(v) => set("maintenance", v)} label="Maintenance mode" hint="Closes the app for all users and shows the message below. Staff can still use this panel." />
          {f.maintenance ? (
            <p className="flex items-center gap-2 rounded-xl bg-[#3a1418] px-3.5 py-2.5 text-sm text-[#ffb0b4]">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> The app will be closed for everyone after you save, and everyone with it open now gets an email.
            </p>
          ) : null}
          <div>
            <label className="label" htmlFor="st-mm">
              Message shown during maintenance
            </label>
            <textarea id="st-mm" rows={2} className="field resize-none" value={f.maintenanceMessage} onChange={(e) => set("maintenanceMessage", e.target.value)} />
          </div>
          {f.maintenance ? (
            <div>
              <label className="label" htmlFor="st-eta">
                Expected downtime
              </label>
              <NumberField id="st-eta" value={etaMinutes} onChange={(n) => setEtaMinutes(Math.max(1, n))} suffix="minutes" />
              <p className="mt-1 text-xs text-muted">Shown to users as a countdown. Doesn't turn maintenance off by itself — come back here when it's actually fixed.</p>
            </div>
          ) : null}
        </div>
      </Card>

      <Card title="Announcement">
        <div className="px-4 py-4">
          <label className="label" htmlFor="st-ann">
            Banner on the home screen <span className="normal-case tracking-normal text-muted/70">(leave empty for none)</span>
          </label>
          <input id="st-ann" className="field" value={f.announcement} onChange={(e) => set("announcement", e.target.value)} placeholder="e.g. Diwali Mehfil Week starts Friday: double gift rewards!" />
        </div>
      </Card>

      <Card title="Coins and rewards">
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="st-bonus">
              Sign-up bonus
            </label>
            <NumberField id="st-bonus" value={f.signupBonusCoins} onChange={(n) => set("signupBonusCoins", n)} suffix="coins" />
          </div>
          <div>
            <label className="label" htmlFor="st-daily">
              Daily check-in reward
            </label>
            <NumberField id="st-daily" value={f.dailyCheckinCoins} onChange={(n) => set("dailyCheckinCoins", n)} suffix="coins" />
          </div>
          <div className="sm:col-span-2">
            <Toggle checked={f.giftingEnabled} onChange={(v) => set("giftingEnabled", v)} label="Gifting on" hint="Turn off to stop all gift sending, for example while fixing a pricing mistake." />
          </div>
        </div>
      </Card>

      <Card title="Rooms and app version">
        <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Toggle checked={f.roomCreationEnabled} onChange={(v) => set("roomCreationEnabled", v)} label="Users can create rooms" hint="Staff can still create rooms from the Rooms page." />
          </div>
          <div>
            <label className="label" htmlFor="st-lvl">
              Level needed to create a room
            </label>
            <NumberField id="st-lvl" value={f.roomCreateMinLevel} onChange={(n) => set("roomCreateMinLevel", n)} />
          </div>
          <div>
            <label className="label" htmlFor="st-ver">
              Oldest app version allowed
            </label>
            <input id="st-ver" className="field" value={f.minAppVersion} onChange={(e) => set("minAppVersion", e.target.value)} placeholder="1.0.0" />
          </div>
        </div>
      </Card>

      {!isSuper ? <p className="text-xs text-muted">Only Super Admin can change these switches.</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Last changed by {updatedBy} · {timeAgo(updatedAt)}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!dirty} onClick={() => setF(initial)}>
            Undo changes
          </Button>
          <Button variant={f.maintenance && !initial.maintenance ? "danger" : "primary"} busy={busy} disabled={!dirty || !isSuper} onClick={save}>
            Save settings
          </Button>
        </div>
      </div>
    </div>
  );
}

type Move = { running: boolean; phase: string; found: number; moved: number; failed: number; rowsUpdated: number; embeddedLeft: number; startedAt: string | null; finishedAt: string | null; startedBy: string | null; errors: string[] };
const moveBase = "/api/v1/admin/manage/storage/cloudinary";

/** Copies every picture still on Cloudinary onto this server (Super Admin). */
function MoveFromCloudinary() {
  const { session, toast } = useAdmin();
  const [st, setSt] = useState<Move | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const isSuper = session.role === "super_admin";

  const poll = useCallback(async () => {
    try {
      const s = await apiRequest<Move>(`${moveBase}/status`);
      setSt(s);
      setNote(null);
      return s;
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't read the progress.");
      return null;
    }
  }, []);
  useEffect(() => {
    if (!isSuper) return;
    void poll();
  }, [isSuper, poll]);
  useEffect(() => {
    if (!st?.running) return;
    timer.current = window.setInterval(() => void poll(), 2000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [st?.running, poll]);

  if (!isSuper) return null;
  const start = async () => {
    if (!window.confirm("Copy every picture that is still on Cloudinary onto this server? It runs in the background and can take a while. It is safe to run again.")) return;
    try {
      const s = await apiRequest<Move & { started: boolean }>(`${moveBase}/move`, { method: "POST" });
      setSt(s);
      toast(s.started ? "Started" : "Already running");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't start", "error");
    }
  };

  return (
    <Card title="Pictures on Cloudinary" className="mt-5">
      <div className="space-y-3 px-4 py-4">
        <p className="text-sm text-muted">New pictures (profile photos, banners, wallpapers, room covers, shop and wallet images, VIP cosmetics) are already kept on this server. Use this to copy the older ones that are still on Cloudinary, one time. Every place that used the old link is updated to the copy.</p>
        {note ? <ErrorNote>{note}</ErrorNote> : null}
        <Button variant="primary" busy={Boolean(st?.running)} disabled={Boolean(st?.running)} onClick={() => void start()}>
          {st?.running ? "Moving…" : "Move to this server"}
        </Button>
        {st && (st.running || st.finishedAt) ? (
          <div className="rounded-xl bg-cream/[0.04] p-3 text-sm">
            <p className="font-semibold">{st.running ? `Working: ${st.phase}` : st.phase === "done" ? "Finished" : st.phase}</p>
            <p className="mt-1 text-muted">
              Found {st.found} · copied {st.moved} · could not copy {st.failed} · rows updated {st.rowsUpdated}
              {st.embeddedLeft ? ` · ${st.embeddedLeft} values with a Cloudinary link inside longer text were left as they are` : ""}
            </p>
            {st.errors.length ? (
              <details className="mt-2 text-xs text-muted">
                <summary className="cursor-pointer">First {st.errors.length} problems (a 404 means Cloudinary no longer has that file)</summary>
                <ul className="mt-1 space-y-1 break-all">
                  {st.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { adminApi, type AppSettings } from "../api";
import { useAdmin } from "../context";
import { Button, Card, ErrorNote, Loading, NumberField, PageHeader, timeAgo, Toggle, useLoad } from "../components/ui";

type Draft = Omit<AppSettings, "updatedAt" | "updatedBy">;

export function SettingsPage() {
  const { version } = useAdmin();
  const { data, error } = useLoad(() => adminApi.getSettings(), [version]);
  return (
    <>
      <PageHeader title="App settings" sub="Switches that change the Panchayat app for everyone." />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {data ? <SettingsForm key={data.updatedAt} settings={data} /> : <Loading />}
    </>
  );
}

function SettingsForm({ settings }: { settings: AppSettings }) {
  const { changed, toast } = useAdmin();
  const { updatedAt, updatedBy, ...initial } = settings;
  const [f, setF] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setF((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);

  const save = async () => {
    if (f.maintenance && !initial.maintenance && !window.confirm("Turn on maintenance mode? Every user is locked out of the app until you turn it off.")) return;
    setBusy(true);
    try {
      await adminApi.saveSettings({ ...f, signupBonusCoins: f.signupBonusCoins || 0, dailyCheckinCoins: f.dailyCheckinCoins || 0, roomCreateMinLevel: f.roomCreateMinLevel || 0 });
      toast("Settings saved");
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
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> The app will be closed for everyone after you save.
            </p>
          ) : null}
          <div>
            <label className="label" htmlFor="st-mm">
              Message shown during maintenance
            </label>
            <textarea id="st-mm" rows={2} className="field resize-none" value={f.maintenanceMessage} onChange={(e) => set("maintenanceMessage", e.target.value)} />
          </div>
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Last changed by {updatedBy} · {timeAgo(updatedAt)}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!dirty} onClick={() => setF(initial)}>
            Undo changes
          </Button>
          <Button variant={f.maintenance && !initial.maintenance ? "danger" : "primary"} busy={busy} disabled={!dirty} onClick={save}>
            Save settings
          </Button>
        </div>
      </div>
    </div>
  );
}

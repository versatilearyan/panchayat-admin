/**
 * VIP plans, free trial and giving VIP to everyone (live backend, Super Admin).
 * Plans are what people buy at checkout (PayU): name, days, price. The price charged is always
 * the one saved here. When someone's VIP ends (a free trial too) they are asked to renew.
 */
import { useCallback, useEffect, useState } from "react";
import { Crown, Gift, Plus } from "lucide-react";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorNote, Loading, Modal, PageHeader, fmtCoins } from "../components/ui";
import { NeedsBackend } from "../components/WalletParts";

type Plan = { id: number; name: string; days: number; priceInRupees: number; active: boolean; sortOrder: number };
type Settings = { freeTrialDays: number; activeVip: number; endedVip: number; trialsGiven?: number; trialsToday?: number; trialsActive?: number; trialsBoughtAfter?: number };
type TrialRow = { userId: number; publicId?: number | null; name?: string | null; email?: string | null; days: number; grantedAt: string; endsAt: string; status: "ACTIVE" | "ENDED" | "BOUGHT" };
const base = "/api/v1/admin/vip-manage";

export function VipPlansPage() {
  if (!BACKEND_ENABLED) return <NeedsBackend what="VIP plans" />;
  return <Live />;
}

function Live() {
  const { toast } = useAdmin();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<Plan | "new" | null>(null);
  const [giveAll, setGiveAll] = useState(false);
  const [trial, setTrial] = useState("");
  const [trials, setTrials] = useState<TrialRow[] | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([apiRequest<Plan[]>(`${base}/plans`), apiRequest<Settings>(`${base}/settings`)]);
      apiRequest<TrialRow[]>(`${base}/trials?limit=50`).then(setTrials).catch(() => setTrials([]));
      setPlans(p);
      setSettings(s);
      setTrial(String(s.freeTrialDays));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load VIP plans.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const saveTrial = async () => {
    try {
      await apiRequest(`${base}/settings`, { method: "PUT", body: { days: Math.round(Number(trial)) } });
      toast(`New users get ${Math.round(Number(trial))} free VIP days`);
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    }
  };
  const toggle = async (p: Plan) => {
    try {
      await apiRequest(`${base}/plans/${p.id}`, { method: "PUT", body: { active: !p.active } });
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    }
  };

  return (
    <>
      <PageHeader
        title="VIP plans"
        sub="What people can buy to be VIP, how many days of free VIP new users get, and one-click VIP for everyone. Payments go through PayU."
        right={
          <span className="flex gap-2">
            <Button variant="gold" onClick={() => setGiveAll(true)}>
              <Gift className="h-4 w-4" /> Give VIP to everyone
            </Button>
            <Button onClick={() => setEdit("new")}>
              <Plus className="h-4 w-4" /> New plan
            </Button>
          </span>
        }
      />
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {settings ? (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface/60 px-4 py-3.5">
            <p className="text-[11px] font-bold tracking-wide text-muted uppercase">VIP right now</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">{fmtCoins(settings.activeVip)}</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface/60 px-4 py-3.5">
            <p className="text-[11px] font-bold tracking-wide text-muted uppercase">VIP ended (can renew)</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">{fmtCoins(settings.endedVip)}</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-line bg-surface/60 px-4 py-3.5 md:col-span-1">
            <label className="text-[11px] font-bold tracking-wide text-muted uppercase" htmlFor="trial">
              Free VIP for new users (days)
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input id="trial" className="field h-9 w-20 py-1" inputMode="numeric" value={trial} onChange={(e) => setTrial(e.target.value.replace(/\D/g, ""))} />
              <Button size="sm" onClick={saveTrial} disabled={trial === "" || Number(trial) === settings.freeTrialDays}>
                Save
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted">0 = no free trial. When it ends, they are asked to renew.</p>
          </div>
        </div>
      ) : null}

      {settings ? (
        <Card title="Free VIP trial for new users" className="mb-4">
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(
                [
                  ["Got the trial (all time)", settings.trialsGiven ?? 0],
                  ["Got it today", settings.trialsToday ?? 0],
                  ["On the trial right now", settings.trialsActive ?? 0],
                  ["Bought VIP after the trial", settings.trialsBoughtAfter ?? 0],
                ] as const
              ).map(([label, n]) => (
                <div key={label} className="rounded-2xl border border-line bg-surface/60 px-4 py-3">
                  <p className="text-[11px] font-bold tracking-wide text-muted uppercase">{label}</p>
                  <p className="mt-1 font-display text-2xl font-bold tabular-nums">{fmtCoins(n)}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted">Every new user gets {settings.freeTrialDays} days of VIP 1 automatically when they finish their profile. Change the number above. In Users you can filter "Free trial" to see who is on it.</p>
            {!trials ? null : trials.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nobody has got the trial yet.</p>
            ) : (
              <div className="scroll-thin mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-[11px] tracking-wide text-muted uppercase">
                    <tr>
                      <th className="py-2 text-left font-bold">User</th>
                      <th className="py-2 text-left font-bold">Got it</th>
                      <th className="py-2 text-left font-bold">Ends</th>
                      <th className="py-2 text-left font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trials.map((t) => (
                      <tr key={t.userId} className="border-t border-line">
                        <td className="py-2 pr-2">
                          <span className="font-semibold">{t.name ?? "New user"}</span>
                          <span className="block text-xs text-muted">{t.email}</span>
                        </td>
                        <td className="py-2 pr-2 text-xs">{new Date(t.grantedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="py-2 pr-2 text-xs">{new Date(t.endsAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="py-2">
                          <Badge tone={t.status === "ACTIVE" ? "ok" : t.status === "BOUGHT" ? "gold" : "muted"}>{t.status === "ACTIVE" ? "On trial" : t.status === "BOUGHT" ? "Bought VIP" : "Ended"}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      ) : null}

      <Card title="Plans on sale">
        {!plans ? (
          <Loading />
        ) : !plans.length ? (
          <Empty>No plans yet. Add one so people can buy VIP.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold">
                  <Crown className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="text-xs text-muted">
                    {p.days} days · ₹{p.priceInRupees}
                  </span>
                </span>
                <Badge tone={p.active ? "ok" : "muted"}>{p.active ? "On sale" : "Off"}</Badge>
                <Button size="sm" onClick={() => setEdit(p)}>
                  Edit
                </Button>
                <Button size="sm" variant={p.active ? "danger" : "ok"} onClick={() => toggle(p)}>
                  {p.active ? "Turn off" : "Turn on"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === "new" ? "New VIP plan" : "Edit VIP plan"}>
        {edit ? <PlanForm key={edit === "new" ? "new" : edit.id} plan={edit === "new" ? null : edit} onDone={() => (setEdit(null), void load())} /> : null}
      </Modal>
      <Modal open={giveAll} onClose={() => setGiveAll(false)} title="👑 Give VIP to everyone">
        {giveAll ? <GiveAllForm onDone={() => (setGiveAll(false), void load())} /> : null}
      </Modal>
    </>
  );
}

function PlanForm({ plan, onDone }: { plan: Plan | null; onDone: () => void }) {
  const { toast } = useAdmin();
  const [name, setName] = useState(plan?.name ?? "VIP · 1 month");
  const [days, setDays] = useState(String(plan?.days ?? 30));
  const [price, setPrice] = useState(String(plan?.priceInRupees ?? 299));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = name.trim() && Number(days) >= 1 && Number(price) > 0;
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim(), days: Math.round(Number(days)), priceInRupees: Number(price) };
      if (plan) await apiRequest(`${base}/plans/${plan.id}`, { method: "PUT", body });
      else await apiRequest(`${base}/plans`, { method: "POST", body });
      toast("Plan saved");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="pl-name">
          Name
        </label>
        <input id="pl-name" className="field h-10 w-full" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="pl-days">
            Days of VIP
          </label>
          <input id="pl-days" className="field h-10 w-full" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div>
          <label className="label" htmlFor="pl-price">
            Price (₹)
          </label>
          <input id="pl-price" className="field h-10 w-full" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} />
        </div>
      </div>
      <p className="text-xs text-muted">The price here is exactly what PayU charges (include GST if you want it included).</p>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        <Button variant="gold" busy={busy} disabled={!ok} onClick={save}>
          Save plan
        </Button>
      </div>
    </div>
  );
}

function GiveAllForm({ onDone }: { onDone: () => void }) {
  const { toast } = useAdmin();
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const d = Math.round(Number(days));
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await apiRequest<{ recipients: number }>(`${base}/give-all`, { method: "POST", body: { days: d, reason: reason.trim() } });
      toast(`${fmtCoins(r.recipients)} people got ${d} days of VIP`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
      setSure(false);
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="ga-days">
          Days of VIP for each person
        </label>
        <input id="ga-days" className="field h-10 w-28" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} />
      </div>
      <div>
        <label className="label" htmlFor="ga-why">
          Message they see (optional)
        </label>
        <input id="ga-why" className="field h-10 w-full" maxLength={200} placeholder="e.g. Happy Diwali!" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <p className="rounded-2xl bg-ink px-4 py-3 text-sm ring-1 ring-line">Everyone who is not banned gets these days added to their VIP (from today if it had ended). Each gets a message from Sarpanch. This cannot be undone.</p>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>Cancel</Button>
        {sure ? (
          <Button variant="danger" busy={busy} onClick={send}>
            Yes, give VIP to everyone
          </Button>
        ) : (
          <Button variant="gold" disabled={!(d >= 1 && d <= 3650)} onClick={() => setSure(true)}>
            Give VIP to everyone
          </Button>
        )}
      </div>
    </div>
  );
}

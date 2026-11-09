/**
 * Parivar management (live backend): everything about families is set here, nothing is fixed in the app.
 * Settings and permissions change for everyone straight away. Only Super Admins can save.
 */
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Button, Card, Chips, Empty, ErrorNote, Loading, PageHeader, Toggle, fmtCoins } from "../components/ui";
import { NeedsBackend } from "../components/WalletParts";

const base = "/api/v1/admin/parivar";

type Settings = {
  enabled: boolean;
  creationOpen: boolean;
  creationMode: "AUTO" | "MANUAL";
  creationInr: number;
  coinsPerInr: number | null;
  coinsPerInrEffective: number | null;
  manualCoins: number;
  requiredCoins: number | null;
  requiredCharm: number;
  consumeCharm: boolean;
  onePerUser: boolean;
  giftCoinsPerExp: number;
  giftCountsForRanking: boolean;
  giftUserDailyCap: number;
  donationCoinsPerExp: number;
  minDonation: number;
  updatedBy: string | null;
};
type Level = { level: number; expNeeded: number; capacity: number; deputyCap: number; adminCap: number };
type Perm = { role: "DEPUTY" | "ADMIN" | "MEMBER"; perm: string; allowed: boolean };
type Row = { id: number; code: number; name: string; sign: string; level: number; exp: number; funds: number; status: string; members: number; leader: string; createdAt: string };

const PERM_LABEL: Record<string, string> = {
  EDIT_PROFILE: "Edit Parivar profile",
  EDIT_ANNOUNCEMENT: "Edit announcement",
  ACCEPT_APPLICATIONS: "Accept / reject applications",
  REMOVE_MEMBERS: "Remove members",
  APPOINT_DEPUTY: "Appoint Deputy",
  APPOINT_ADMIN: "Appoint Admin",
  MANAGE_TREASURY: "Manage treasury",
  MANAGE_SETTINGS: "Manage Parivar settings",
};
const ROLES: Perm["role"][] = ["DEPUTY", "ADMIN", "MEMBER"];

export function ParivarPage() {
  if (!BACKEND_ENABLED) return <NeedsBackend what="Parivar management" />;
  return <Live />;
}

function Live() {
  const { toast, can } = useAdmin();
  const [s, setS] = useState<Settings | null>(null);
  const [levels, setLevels] = useState<Level[] | null>(null);
  const [perms, setPerms] = useState<Perm[] | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [log, setLog] = useState<{ id: number; adminName: string; what: string; detail: string; createdAt: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const canSave = can("settings.edit");

  const load = useCallback(async () => {
    try {
      const [a, b, c, d, e] = await Promise.all([
        apiRequest<Settings>(`${base}/settings`),
        apiRequest<Level[]>(`${base}/levels`),
        apiRequest<Perm[]>(`${base}/permissions`),
        apiRequest<{ content: Row[] }>(`${base}/list${q ? `?q=${encodeURIComponent(q)}` : ""}`),
        apiRequest<typeof log>(`${base}/audit`),
      ]);
      setS(a);
      setLevels(b);
      setPerms(c);
      setRows(d.content);
      setLog(e);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load Parivar settings.");
    }
  }, [q]);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast(done);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    } finally {
      setBusy(null);
    }
  };

  if (error && !s) return <ErrorNote>{error}</ErrorNote>;
  if (!s || !levels || !perms) return <Loading />;

  return (
    <>
      <PageHeader title="Parivar" sub="Families: creation price, requirements, activity rules, levels, who can do what, and every Parivar. Changes apply at once; nothing needs a new app release." />
      {!canSave ? <p className="mb-3 rounded-xl bg-[#3a2a14] px-3.5 py-2.5 text-sm text-[#ffd9a0]">Only a Super Admin can save changes here. You can look at everything.</p> : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <SettingsCard s={s} busy={busy === "settings"} disabled={!canSave} onSave={(body) => run("settings", () => apiRequest(`${base}/settings`, { method: "PUT", body }), "Settings saved")} />
      <LevelsCard levels={levels} busy={busy === "levels"} disabled={!canSave} onSave={(body) => run("levels", () => apiRequest(`${base}/levels`, { method: "PUT", body }), "Levels saved")} />

      <Card title="Who can do what" className="mt-4">
        <p className="px-4 pt-3 text-xs text-muted">The Leader can always do everything. Tick what each role may do.</p>
        <div className="scroll-thin overflow-x-auto px-4 pb-4">
          <table className="mt-2 w-full min-w-[420px] text-sm">
            <thead className="text-[11px] tracking-wide text-muted uppercase">
              <tr>
                <th className="py-2 text-left font-bold">Action</th>
                {ROLES.map((r) => (
                  <th key={r} className="py-2 text-center font-bold">
                    {r === "DEPUTY" ? "Deputy" : r === "ADMIN" ? "Admin" : "Member"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {Object.keys(PERM_LABEL).map((p) => (
                <tr key={p}>
                  <td className="py-2">{PERM_LABEL[p]}</td>
                  {ROLES.map((r) => {
                    const row = perms.find((x) => x.role === r && x.perm === p);
                    return (
                      <td key={r} className="py-2 text-center">
                        <input
                          type="checkbox"
                          disabled={!canSave || busy === "perm"}
                          checked={Boolean(row?.allowed)}
                          aria-label={`${PERM_LABEL[p]} for ${r}`}
                          onChange={(e) => run("perm", () => apiRequest(`${base}/permissions`, { method: "PUT", body: [{ role: r, perm: p, allowed: e.target.checked }] }), "Saved")}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        className="mt-4"
        title={rows ? `${rows.length} Parivars` : "Parivars"}
        action={
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
          >
            <input className="field h-9 w-48 py-1" placeholder="Name or sign" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search Parivars" />
            <Button size="sm" type="submit">
              Search
            </Button>
          </form>
        }
      >
        {!rows ? (
          <Loading />
        ) : !rows.length ? (
          <Empty>No Parivars yet.</Empty>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-[11px] tracking-wide text-muted uppercase">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-bold">Parivar</th>
                  <th className="px-2 py-2 font-bold">ID</th>
                  <th className="px-2 py-2 font-bold">Leader</th>
                  <th className="px-2 py-2 text-right font-bold">Members</th>
                  <th className="px-2 py-2 text-right font-bold">Level</th>
                  <th className="px-2 py-2 text-right font-bold">EXP</th>
                  <th className="px-2 py-2 text-right font-bold">Funds</th>
                  <th className="px-4 py-2 text-right font-bold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold">{r.name}</span> <span className="text-xs text-muted">[{r.sign}]</span>
                      {r.status !== "ACTIVE" ? (
                        <span className="ml-2">
                          <Badge tone="muted">Closed</Badge>
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 font-mono">{r.code}</td>
                    <td className="px-2 py-2.5">{r.leader}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.members}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.level}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{fmtCoins(r.exp)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{fmtCoins(r.funds)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {r.status === "ACTIVE" && canSave ? (
                        <Button
                          size="sm"
                          variant="danger"
                          busy={busy === `d${r.id}`}
                          onClick={() => {
                            if (window.confirm(`Close "${r.name}"? Its members are freed. This can't be undone.`)) void run(`d${r.id}`, () => apiRequest(`${base}/${r.id}/disband`, { method: "POST" }), "Parivar closed");
                          }}
                        >
                          Close
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Change log" className="mt-4">
        {!log?.length ? (
          <Empty>No changes yet.</Empty>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {log.map((l) => (
              <li key={l.id} className="px-4 py-2">
                <span className="font-semibold">{l.what}</span> <span className="text-muted">by {l.adminName ?? "?"} · {new Date(l.createdAt).toLocaleString("en-IN")}</span>
                <span className="block break-words text-xs text-muted">{l.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function SettingsCard({ s, onSave, busy, disabled }: { s: Settings; onSave: (b: Record<string, unknown>) => void; busy: boolean; disabled: boolean }) {
  const [f, setF] = useState({
    enabled: s.enabled,
    creationOpen: s.creationOpen,
    creationMode: s.creationMode,
    creationInr: String(s.creationInr),
    followPacks: s.coinsPerInr === null,
    coinsPerInr: s.coinsPerInr === null ? "" : String(s.coinsPerInr),
    manualCoins: String(s.manualCoins),
    requiredCharm: String(s.requiredCharm),
    consumeCharm: s.consumeCharm,
    onePerUser: s.onePerUser,
    giftCoinsPerExp: String(s.giftCoinsPerExp),
    giftCountsForRanking: s.giftCountsForRanking,
    giftUserDailyCap: String(s.giftUserDailyCap),
    donationCoinsPerExp: String(s.donationCoinsPerExp),
    minDonation: String(s.minDonation),
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? 0 : Number(v));
  const rate = f.followPacks ? s.coinsPerInrEffective : Number(f.coinsPerInr);
  const preview = f.creationMode === "MANUAL" ? num(f.manualCoins) : rate ? Math.ceil(num(f.creationInr) * rate) : null;
  const dec = (v: string) => v.replace(/[^\d.]/g, "");
  const int = (v: string) => v.replace(/\D/g, "");

  const save = () => {
    if (!window.confirm("Save these Parivar settings? They apply to everyone straight away.")) return;
    onSave({
      enabled: f.enabled,
      creationOpen: f.creationOpen,
      creationMode: f.creationMode,
      creationInr: num(f.creationInr),
      useCoinPackRate: f.followPacks,
      coinsPerInr: f.followPacks ? null : num(f.coinsPerInr),
      manualCoins: Math.round(num(f.manualCoins)),
      requiredCharm: Math.round(num(f.requiredCharm)),
      consumeCharm: f.consumeCharm,
      onePerUser: f.onePerUser,
      giftCoinsPerExp: Math.round(num(f.giftCoinsPerExp)),
      giftCountsForRanking: f.giftCountsForRanking,
      giftUserDailyCap: Math.round(num(f.giftUserDailyCap)),
      donationCoinsPerExp: Math.round(num(f.donationCoinsPerExp)),
      minDonation: Math.round(num(f.minDonation)),
    });
  };

  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <div>
      <span className="label">{label}</span>
      {node}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );

  return (
    <Card title="General settings and creation">
      <div className="space-y-5 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Toggle checked={f.enabled} onChange={(v) => set("enabled", v)} disabled={disabled} label="Parivar is open" hint="Off: the app shows Parivar as coming soon." />
          <Toggle checked={f.creationOpen} onChange={(v) => set("creationOpen", v)} disabled={disabled} label="People can create new Parivars" hint="Off: only joining works." />
          <Toggle checked={f.onePerUser} onChange={(v) => set("onePerUser", v)} disabled={disabled} label="One Parivar per person" />
        </div>

        <div>
          <span className="label">Creation price (paid in coins, never in rupees)</span>
          <Chips
            label="Price mode"
            value={f.creationMode}
            onChange={(v) => set("creationMode", v)}
            options={[
              { value: "AUTO", label: "Work out from rupees" },
              { value: "MANUAL", label: "Set the coins myself" },
            ]}
          />
          {f.creationMode === "AUTO" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {field("Reference price (₹)", <input className="field h-10 w-full" inputMode="decimal" disabled={disabled} value={f.creationInr} onChange={(e) => set("creationInr", dec(e.target.value))} />, "Only used to work out the coins.")}
              {field(
                "Coins per ₹1",
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" disabled={disabled} checked={f.followPacks} onChange={(e) => set("followPacks", e.target.checked)} /> Use the coin packs
                  </label>
                  {!f.followPacks ? <input className="field h-10 w-full" inputMode="decimal" disabled={disabled} value={f.coinsPerInr} onChange={(e) => set("coinsPerInr", dec(e.target.value))} /> : <p className="text-sm">{s.coinsPerInrEffective ?? "no coin pack found"}</p>}
                </div>,
                "From the cheapest coin pack: its coins divided by its price.",
              )}
            </div>
          ) : (
            <div className="mt-3 max-w-xs">{field("Coins", <input className="field h-10 w-full" inputMode="numeric" disabled={disabled} value={f.manualCoins} onChange={(e) => set("manualCoins", int(e.target.value))} />)}</div>
          )}
          <p className="mt-2 rounded-xl bg-ink px-3.5 py-2.5 text-sm ring-1 ring-line">
            Creating a Parivar will cost <b>{preview === null ? "—" : fmtCoins(preview)} coins</b>
            {preview === null ? " (set coins per ₹1, or add a coin pack)" : ""}, taken from the person's own wallet.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {field("Charm needed to create", <input className="field h-10 w-full" inputMode="numeric" disabled={disabled} value={f.requiredCharm} onChange={(e) => set("requiredCharm", int(e.target.value))} />, "0 = no Charm needed.")}
          <Toggle checked={f.consumeCharm} onChange={(v) => set("consumeCharm", v)} disabled={disabled} label="Use up that Charm" hint="Off: the Charm is only checked, not taken." />
        </div>

        <div>
          <span className="label">Activity and treasury</span>
          <div className="mt-1 grid gap-3 sm:grid-cols-3">
            {field("Gift coins = 1 EXP", <input className="field h-10 w-full" inputMode="numeric" disabled={disabled} value={f.giftCoinsPerExp} onChange={(e) => set("giftCoinsPerExp", int(e.target.value))} />, "Gifts between members of one Parivar.")}
            {field("Daily gift EXP cap per person", <input className="field h-10 w-full" inputMode="numeric" disabled={disabled} value={f.giftUserDailyCap} onChange={(e) => set("giftUserDailyCap", int(e.target.value))} />)}
            <Toggle checked={f.giftCountsForRanking} onChange={(v) => set("giftCountsForRanking", v)} disabled={disabled} label="Gifts count for weekly ranking" />
            {field("Donated coins = 1 EXP", <input className="field h-10 w-full" inputMode="numeric" disabled={disabled} value={f.donationCoinsPerExp} onChange={(e) => set("donationCoinsPerExp", int(e.target.value))} />, "0 = donations give no EXP.")}
            {field("Smallest donation (coins)", <input className="field h-10 w-full" inputMode="numeric" disabled={disabled} value={f.minDonation} onChange={(e) => set("minDonation", int(e.target.value))} />)}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="gold" busy={busy} disabled={disabled} onClick={save}>
            Save settings
          </Button>
        </div>
      </div>
    </Card>
  );
}

function LevelsCard({ levels, onSave, busy, disabled }: { levels: Level[]; onSave: (b: Level[]) => void; busy: boolean; disabled: boolean }) {
  const [rows, setRows] = useState(levels.map((l) => ({ ...l })));
  const edit = (i: number, k: keyof Level, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: Number(v.replace(/\D/g, "")) } : x)));
  const add = () => setRows((r) => [...r, { level: r.length + 1, expNeeded: (r.at(-1)?.expNeeded ?? 0) + 100000, capacity: (r.at(-1)?.capacity ?? 20) + 5, deputyCap: r.at(-1)?.deputyCap ?? 1, adminCap: r.at(-1)?.adminCap ?? 2 }]);
  return (
    <Card
      className="mt-4"
      title="Levels and capacity"
      action={
        <Button size="sm" onClick={add} disabled={disabled || rows.length >= 30}>
          <Plus className="h-3.5 w-3.5" /> Level
        </Button>
      }
    >
      <div className="scroll-thin overflow-x-auto px-4 pb-4">
        <table className="mt-2 w-full min-w-[520px] text-sm">
          <thead className="text-[11px] tracking-wide text-muted uppercase">
            <tr>
              <th className="py-2 text-left font-bold">Level</th>
              <th className="py-2 text-left font-bold">EXP needed</th>
              <th className="py-2 text-left font-bold">Members</th>
              <th className="py-2 text-left font-bold">Deputies</th>
              <th className="py-2 text-left font-bold">Admins</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-1 font-semibold">{r.level}</td>
                {(["expNeeded", "capacity", "deputyCap", "adminCap"] as const).map((k) => (
                  <td key={k} className="py-1 pr-2">
                    <input className="field h-9 w-28 py-1" inputMode="numeric" disabled={disabled || (i === 0 && k === "expNeeded")} value={r[k]} onChange={(e) => edit(i, k, e.target.value)} aria-label={`${k} for level ${r.level}`} />
                  </td>
                ))}
                <td>
                  {i === rows.length - 1 && i > 0 ? (
                    <Button size="sm" variant="danger" disabled={disabled} onClick={() => setRows((x) => x.slice(0, -1))} aria-label="Remove the last level">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">Each level needs more EXP than the one before; Members can't go down. A Parivar is re-levelled when you save.</p>
        <div className="mt-3 flex justify-end">
          <Button variant="gold" busy={busy} disabled={disabled} onClick={() => window.confirm("Save the level table? Parivars are re-levelled straight away.") && onSave(rows)}>
            Save levels
          </Button>
        </div>
      </div>
    </Card>
  );
}

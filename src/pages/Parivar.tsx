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
import { ConfigTable } from "../components/ConfigTable";

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
  giftCoinsPerCharm: number;
  changeNamePrice: number;
  changeSignPrice: number;
  changeLogoPrice: number;
  giftCountsForRanking: boolean;
  giftUserDailyCap: number;
  donationCoinsPerExp: number;
  minDonation: number;
  updatedBy: string | null;
};
type Level = { level: number; expNeeded: number; fundNeeded: number; capacity: number; deputyCap: number; adminCap: number; frame: string };
const FRAMES = ["wood", "bronze", "silver", "gold", "ruby", "diamond", "royal"];
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
  USE_STEAL: "Use Chori (steal)",
  MANAGE_STEAL: "Switch Chori on/off for members",
  MANAGE_BARRIER: "Switch on Kavach (barrier)",
  MANAGE_GACHA: "Spend funds / cards on Gacha",
  MANAGE_CHESTS: "Buy and send chests",
  MANAGE_VOICE: "Start the Parivar voice room",
};
const ROLES: Perm["role"][] = ["DEPUTY", "ADMIN", "MEMBER"];
type Sec = "general" | "chori" | "kavach" | "gacha" | "chests" | "shop" | "tasks" | "parivars" | "logs";
const SECS: { value: Sec; label: string }[] = [
  { value: "general", label: "General, levels, roles" },
  { value: "chori", label: "Chori and switches" },
  { value: "kavach", label: "Kavach" },
  { value: "gacha", label: "Gacha" },
  { value: "chests", label: "Chests" },
  { value: "shop", label: "Shop and cheer" },
  { value: "tasks", label: "Tasks and prizes" },
  { value: "parivars", label: "Parivars" },
  { value: "logs", label: "Logs" },
];

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
  const [sec, setSec] = useState<Sec>("general");
  const [machine, setMachine] = useState(1);
  const [chestId, setChestId] = useState(1);

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

      <Chips label="Section" value={sec} onChange={setSec} options={SECS} />

      {sec === "general" ? (
        <>
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

        </>
      ) : null}

      {sec === "chori" ? <ExtraSettings canSave={canSave} /> : null}

      {sec === "kavach" ? (
        <ConfigTable
          section="barriers"
          title="Kavach types"
          canSave={canSave}
          note="Strength is the chance (%) that this Kavach stops a Chori attempt. Price is paid from the Parivar treasury unless the Parivar already owns one."
          cols={[
            { key: "name", label: "Name", type: "text" },
            { key: "imageUrl", label: "Image URL", type: "text", width: "180px" },
            { key: "strength", label: "Strength %", type: "int" },
            { key: "durationMinutes", label: "Lasts (min)", type: "int" },
            { key: "priceFunds", label: "Price (funds)", type: "int" },
            { key: "cooldownMinutes", label: "Cooldown (min)", type: "int" },
            { key: "dailyLimit", label: "Per day", type: "int" },
            { key: "minLevel", label: "Min level", type: "int" },
            { key: "sortOrder", label: "Order", type: "int" },
            { key: "active", label: "On", type: "bool" },
          ]}
          blank={{ name: "New Kavach", imageUrl: "", strength: 50, durationMinutes: 720, priceFunds: 1000, cooldownMinutes: 0, dailyLimit: 2, minLevel: 1, sortOrder: 9, active: true }}
        />
      ) : null}

      {sec === "gacha" ? (
        <>
          <ConfigTable
            section="gacha-machines"
            title="Gacha machines"
            canSave={canSave}
            note="Each person gets the free rolls per day: the Parivar fund pays the machine fee for it. After that a roll uses the person's own Gacha ticket, else their own gold (roll price). Normal opens at level 1, Advanced at the level you set (4)."
            cols={[
              { key: "name", label: "Name", type: "text" },
              { key: "tier", label: "Tier", type: "text", width: "100px" },
              { key: "imageUrl", label: "Image URL", type: "text", width: "170px" },
              { key: "animationUrl", label: "Animation URL", type: "text", width: "170px" },
              { key: "freePerDay", label: "Free/day", type: "int" },
              { key: "freeFundCost", label: "Fund pays per free roll", type: "int" },
              { key: "rollPriceCoins", label: "Roll price (gold)", type: "int" },
              { key: "minLevel", label: "Min level", type: "int" },
              { key: "sortOrder", label: "Order", type: "int" },
              { key: "active", label: "On", type: "bool" },
            ]}
            blank={{ name: "New machine", tier: "CUSTOM", imageUrl: "", animationUrl: "", priceFunds: 0, serviceFeeCoins: 0, freePerDay: 1, freeFundCost: 2000, rollPriceCoins: 1000, minLevel: 1, sortOrder: 9, active: true }}
          />
          <Card className="mt-4" title="Rewards of machine">
            <div className="px-4 py-3">
              <label className="label" htmlFor="gm">
                Machine ID
              </label>
              <input id="gm" className="field h-9 w-28 py-1" inputMode="numeric" value={machine} onChange={(e) => setMachine(Number(e.target.value.replace(/\D/g, "")) || 1)} />
              <p className="mt-1 text-xs text-muted">Kinds: COINS = the player's gold, FUNDS = Parivar fund, GIFT_CARD = a gift in the winner's Bag, WEAPON = extra Chori attempts for the Parivar (Amount = how many), BARRIER = Kavach, CHEST = chest, CARD = Gacha ticket(s), ITEM = frame / chat bubble / entry animation for Amount days (create the item in Spend rewards first). Weight is the share of the chance: a reward with weight 10 among a total of 1000 is won 1% of the time. The app shows these chances to players.</p>
            </div>
          </Card>
          <ConfigTable
            key={machine}
            section="gacha-rewards"
            parent={{ key: "machineId", value: machine }}
            title="Gacha rewards"
            canSave={canSave}
            deletable
            cols={[
              { key: "kind", label: "Kind", type: "enum", options: ["COINS", "FUNDS", "CHARM", "CHEST", "CARD", "BARRIER", "GIFT_CARD", "WEAPON", "ITEM"] },
              { key: "ref", label: "Item ID", type: "int", hint: "CHEST: chest ID. BARRIER (Kavach): barrier ID. ITEM: the ID of a frame / chat bubble / entry animation made in Spend rewards. Others: 0" },
              { key: "giftId", label: "Gift ID", type: "text", width: "130px", hint: "GIFT_CARD only: which gift the card gives" },
              { key: "amount", label: "Amount", type: "int" },
              { key: "weight", label: "Weight", type: "int" },
              { key: "rarity", label: "Rarity", type: "enum", options: ["COMMON", "RARE", "EPIC", "LEGENDARY"] },
              { key: "label", label: "Label", type: "text" },
              { key: "imageUrl", label: "Image URL", type: "text", width: "160px" },
              { key: "active", label: "On", type: "bool" },
            ]}
            blank={{ kind: "COINS", ref: 0, giftId: "", amount: 100, weight: 10, rarity: "COMMON", label: "100 gold", imageUrl: "", active: true }}
          />
        </>
      ) : null}

      {sec === "chests" ? (
        <>
          <ConfigTable
            section="chests"
            title="Chests"
            canSave={canSave}
            note="Pieces is how many members can claim one piece each. Price is paid from the treasury unless the Parivar already owns one."
            cols={[
              { key: "name", label: "Name", type: "text" },
              { key: "imageUrl", label: "Image URL", type: "text", width: "180px" },
              { key: "priceFunds", label: "Price (funds)", type: "int" },
              { key: "pieces", label: "Pieces", type: "int" },
              { key: "minLevel", label: "Min level", type: "int" },
              { key: "sortOrder", label: "Order", type: "int" },
              { key: "active", label: "On", type: "bool" },
            ]}
            blank={{ name: "New Chest", imageUrl: "", priceFunds: 2000, pieces: 10, minLevel: 1, sortOrder: 9, active: true }}
          />
          <Card className="mt-4" title="Rewards of chest">
            <div className="px-4 py-3">
              <label className="label" htmlFor="cm">
                Chest ID
              </label>
              <input id="cm" className="field h-9 w-28 py-1" inputMode="numeric" value={chestId} onChange={(e) => setChestId(Number(e.target.value.replace(/\D/g, "")) || 1)} />
            </div>
          </Card>
          <ConfigTable
            key={chestId}
            section="chest-rewards"
            parent={{ key: "chestId", value: chestId }}
            title="Chest rewards"
            canSave={canSave}
            deletable
            cols={[
              { key: "kind", label: "Kind", type: "enum", options: ["COINS", "FUNDS", "CHARM", "CHEST", "CARD", "BARRIER"] },
              { key: "ref", label: "Item ID", type: "int" },
              { key: "amount", label: "Amount", type: "int" },
              { key: "weight", label: "Weight", type: "int" },
              { key: "label", label: "Label", type: "text" },
              { key: "active", label: "On", type: "bool" },
            ]}
            blank={{ kind: "COINS", ref: 0, amount: 100, weight: 10, label: "100 coins", active: true }}
          />
        </>
      ) : null}

      {sec === "shop" ? (
        <>
          <ConfigTable
            section="shop"
            title="Parivar shop"
            canSave={canSave}
            note="Items go into the Parivar inventory. Price in funds is paid by members allowed to manage the treasury; price in coins by any member from their own wallet (0 = not for sale that way). Kind GACHA_CARD uses the machine ID as Item ID."
            cols={[
              { key: "name", label: "Name", type: "text" },
              { key: "imageUrl", label: "Image URL", type: "text", width: "160px" },
              { key: "kind", label: "Kind", type: "enum", options: ["GACHA_CARD", "CHEST", "BARRIER"] },
              { key: "ref", label: "Item ID", type: "int" },
              { key: "qty", label: "Qty", type: "int" },
              { key: "priceFunds", label: "Funds", type: "int" },
              { key: "priceCoins", label: "Coins", type: "int" },
              { key: "dailyLimit", label: "Per day", type: "int" },
              { key: "minLevel", label: "Min level", type: "int" },
              { key: "sortOrder", label: "Order", type: "int" },
              { key: "active", label: "On", type: "bool" },
            ]}
            blank={{ name: "New item", imageUrl: "", kind: "CHEST", ref: 1, qty: 1, priceFunds: 1000, priceCoins: 0, dailyLimit: 0, minLevel: 1, sortOrder: 99, active: true }}
          />
          <ConfigTable
            section="cheer"
            title="Cheer"
            canSave={canSave}
            note="Cheer costs coins from the player's wallet and gives the Parivar EXP (and funds if set)."
            cols={[
              { key: "name", label: "Name", type: "text" },
              { key: "times", label: "Times", type: "int" },
              { key: "coinsCost", label: "Cost (coins)", type: "int" },
              { key: "expGain", label: "EXP", type: "int" },
              { key: "fundsGain", label: "Funds", type: "int" },
              { key: "dailyLimit", label: "Per day", type: "int" },
              { key: "sortOrder", label: "Order", type: "int" },
              { key: "active", label: "On", type: "bool" },
            ]}
            blank={{ name: "Cheer x5", times: 5, coinsCost: 500, expGain: 55, fundsGain: 0, dailyLimit: 20, sortOrder: 9, active: true }}
          />
        </>
      ) : null}

      {sec === "tasks" ? (
        <>
          <ConfigTable
            section="tasks"
            title="Daily and weekly tasks"
            canSave={canSave}
            deletable
            note="The metric is what is counted for each member in that day or week."
            cols={[
              { key: "title", label: "Title", type: "text", width: "220px" },
              { key: "period", label: "Period", type: "enum", options: ["DAILY", "WEEKLY"] },
              { key: "metric", label: "Counts", type: "enum", options: ["GIFT_EXP", "DONATED_COINS", "CHEERS", "CHECKINS", "ACTIVITY_EXP", "GACHA_ROLLS"] },
              { key: "target", label: "Target", type: "int" },
              { key: "rewardKind", label: "Reward", type: "enum", options: ["EXP", "FUNDS", "COINS", "CHARM"] },
              { key: "rewardAmount", label: "Amount", type: "int" },
              { key: "sortOrder", label: "Order", type: "int" },
              { key: "active", label: "On", type: "bool" },
            ]}
            blank={{ title: "New task", period: "DAILY", metric: "CHEERS", target: 1, rewardKind: "EXP", rewardAmount: 10, sortOrder: 9, active: true }}
          />
          <ConfigTable
            section="rank-rewards"
            title="Weekly ranking prizes"
            canSave={canSave}
            deletable
            note="Funds paid to the Parivars that finish the week at these places (switch this on under Chori and switches)."
            cols={[
              { key: "rankFrom", label: "From rank", type: "int" },
              { key: "rankTo", label: "To rank", type: "int" },
              { key: "funds", label: "Funds", type: "int" },
              { key: "active", label: "On", type: "bool" },
            ]}
            blank={{ rankFrom: 11, rankTo: 20, funds: 1000, active: true }}
          />
        </>
      ) : null}

      {sec === "parivars" ? (
        <>
          <Stats />
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

        </>
      ) : null}

      {sec === "logs" ? (
        <>
          <Logs />
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
      ) : null}
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
    giftCoinsPerCharm: String(s.giftCoinsPerCharm ?? 5),
    changeNamePrice: String(s.changeNamePrice ?? 5000),
    changeSignPrice: String(s.changeSignPrice ?? 5000),
    changeLogoPrice: String(s.changeLogoPrice ?? 5000),
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
      giftCoinsPerCharm: Math.max(1, Math.round(num(f.giftCoinsPerCharm))),
      changeNamePrice: Math.max(0, Math.round(num(f.changeNamePrice))),
      changeSignPrice: Math.max(0, Math.round(num(f.changeSignPrice))),
      changeLogoPrice: Math.max(0, Math.round(num(f.changeLogoPrice))),
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
            {field("Change name price (coins)", <input className="field h-10 w-full" inputMode="numeric" disabled={disabled} value={f.changeNamePrice} onChange={(e) => set("changeNamePrice", int(e.target.value))} />, "What the Mukhiya pays to change the Parivar name. 0 = free.")}
            {field("Change title price (coins)", <input className="field h-10 w-full" inputMode="numeric" disabled={disabled} value={f.changeSignPrice} onChange={(e) => set("changeSignPrice", int(e.target.value))} />, "What the Mukhiya pays to change the Parivar title (the short sign). 0 = free.")}
            {field("Change logo price (coins)", <input className="field h-10 w-full" inputMode="numeric" disabled={disabled} value={f.changeLogoPrice} onChange={(e) => set("changeLogoPrice", int(e.target.value))} />, "What the Mukhiya pays to change the Parivar logo. 0 = free.")}
            {field("Gift coins = 1 Charm", <input className="field h-10 w-full" inputMode="numeric" disabled={disabled} value={f.giftCoinsPerCharm} onChange={(e) => set("giftCoinsPerCharm", int(e.target.value))} />, "Every gift sent inside a Parivar gives the receiver 1 Charm per this many coins (5 means 5 coins : 1 Charm).")}
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
  const add = () => setRows((r) => [...r, { level: r.length + 1, expNeeded: (r.at(-1)?.expNeeded ?? 0) + 100000, fundNeeded: (r.at(-1)?.fundNeeded ?? 0) + 20000, capacity: (r.at(-1)?.capacity ?? 20) + 5, deputyCap: r.at(-1)?.deputyCap ?? 1, adminCap: r.at(-1)?.adminCap ?? 2, frame: r.at(-1)?.frame ?? "royal" }]);
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
              <th className="py-2 text-left font-bold">Activity (EXP) needed</th>
              <th className="py-2 text-left font-bold">Family fund needed</th>
              <th className="py-2 text-left font-bold">Members</th>
              <th className="py-2 text-left font-bold">Deputies</th>
              <th className="py-2 text-left font-bold">Admins</th>
              <th className="py-2 text-left font-bold">Frame</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="py-1 font-semibold">{r.level}</td>
                {(["expNeeded", "fundNeeded", "capacity", "deputyCap", "adminCap"] as const).map((k) => (
                  <td key={k} className="py-1 pr-2">
                    <input className="field h-9 w-28 py-1" inputMode="numeric" disabled={disabled || (i === 0 && (k === "expNeeded" || k === "fundNeeded"))} value={r[k]} onChange={(e) => edit(i, k, e.target.value)} aria-label={`${k} for level ${r.level}`} />
                  </td>
                ))}
                <td className="py-1 pr-2">
                  <select className="field h-9 w-28 py-1" disabled={disabled} value={r.frame} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, frame: e.target.value } : y)))} aria-label={`Frame for level ${r.level}`}>
                    {FRAMES.map((fr) => (
                      <option key={fr} value={fr}>
                        {fr}
                      </option>
                    ))}
                  </select>
                </td>
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
        <p className="mt-2 text-xs text-muted">Each level needs more EXP than the one before; Members can't go down. The frame is the border and sign badge a Parivar shows at that level. A Parivar is re-levelled when you save.</p>
        <div className="mt-3 flex justify-end">
          <Button variant="gold" busy={busy} disabled={disabled} onClick={() => window.confirm("Save the level table? Parivars are re-levelled straight away.") && onSave(rows)}>
            Save levels
          </Button>
        </div>
      </div>
    </Card>
  );
}

type Extra = Record<string, number | boolean | string>;
const EXTRA_FIELDS: { key: string; label: string; type: "bool" | "int" | "enum"; options?: string[]; group: string; hint?: string }[] = [
  { key: "stealEnabled", label: "Chori is on", type: "bool", group: "Chori (steal)", hint: "Off by default. Even when on, each Parivar's Mukhiya decides if members may use it." },
  { key: "stealMinLevel", label: "Parivar level needed", type: "int", group: "Chori (steal)" },
  { key: "stealDailyAttempts", label: "Attempts per Parivar per day", type: "int", group: "Chori (steal)" },
  { key: "stealCooldownMinutes", label: "Cooldown (minutes)", type: "int", group: "Chori (steal)" },
  { key: "stealSuccessPercent", label: "Success chance %", type: "int", group: "Chori (steal)" },
  { key: "stealTakePercent", label: "Share taken from the treasury %", type: "int", group: "Chori (steal)" },
  { key: "stealMaxTake", label: "Most that can be taken", type: "int", group: "Chori (steal)" },
  { key: "stealFailPenalty", label: "Cost of a failed attempt (funds)", type: "int", group: "Chori (steal)" },
  { key: "stealMinTargetFunds", label: "Target needs at least (funds)", type: "int", group: "Chori (steal)" },
  { key: "cheerEnabled", label: "Cheer", type: "bool", group: "Feature switches" },
  { key: "gachaEnabled", label: "Gacha", type: "bool", group: "Feature switches" },
  { key: "shopEnabled", label: "Parivar shop", type: "bool", group: "Feature switches" },
  { key: "tasksEnabled", label: "Tasks", type: "bool", group: "Feature switches" },
  { key: "chatEnabled", label: "Family chat", type: "bool", group: "Feature switches" },
  { key: "voiceEnabled", label: "Parivar voice room", type: "bool", group: "Feature switches" },
  { key: "rankRewardsEnabled", label: "Weekly ranking prizes", type: "bool", group: "Feature switches" },
  { key: "gachaTicketPrice", label: "Gacha ticket price (gold)", type: "int", group: "Limits", hint: "What one personal Gacha ticket costs. A roll with the player's own gold is set on each machine." },
  { key: "voiceMinLevel", label: "Voice room unlocks at level", type: "int", group: "Limits" },
  { key: "chestExpiryHours", label: "Chest stays open (hours)", type: "int", group: "Limits" },
  { key: "chestExpiryPolicy", label: "Unclaimed chest pieces", type: "enum", options: ["NONE", "REFUND_FUNDS"], group: "Limits", hint: "REFUND_FUNDS: their share of the price goes back to the treasury." },
  { key: "checkinExp", label: "Daily check-in EXP", type: "int", group: "Limits" },
];

function ExtraSettings({ canSave }: { canSave: boolean }) {
  const { toast } = useAdmin();
  const [e, setE] = useState<Extra | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    apiRequest<Extra>(`${base}/settings/extra`)
      .then(setE)
      .catch(() => undefined);
  }, []);
  if (!e) return <Loading />;
  const groups = Array.from(new Set(EXTRA_FIELDS.map((f) => f.group)));
  const save = async () => {
    if (!window.confirm("Save these settings? They apply to every Parivar at once.")) return;
    setBusy(true);
    try {
      setE(await apiRequest<Extra>(`${base}/settings/extra`, { method: "PUT", body: e }));
      toast("Saved");
    } catch (er) {
      toast(er instanceof Error ? er.message : "Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {groups.map((g) => (
        <Card key={g} title={g} className="mt-4">
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            {EXTRA_FIELDS.filter((f) => f.group === g).map((f) =>
              f.type === "bool" ? (
                <Toggle key={f.key} checked={Boolean(e[f.key])} disabled={!canSave} onChange={(v) => setE({ ...e, [f.key]: v })} label={f.label} hint={f.hint} />
              ) : (
                <div key={f.key}>
                  <label className="label" htmlFor={f.key}>
                    {f.label}
                  </label>
                  {f.type === "enum" ? (
                    <select id={f.key} className="field h-10" disabled={!canSave} value={String(e[f.key])} onChange={(ev) => setE({ ...e, [f.key]: ev.target.value })}>
                      {f.options?.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input id={f.key} className="field h-10 w-40" inputMode="numeric" disabled={!canSave} value={String(e[f.key] ?? "")} onChange={(ev) => setE({ ...e, [f.key]: ev.target.value.replace(/[^\d.]/g, "") })} />
                  )}
                  {f.hint ? <p className="mt-1 text-xs text-muted">{f.hint}</p> : null}
                </div>
              ),
            )}
          </div>
        </Card>
      ))}
      <div className="mt-4 flex justify-end">
        <Button variant="gold" busy={busy} disabled={!canSave} onClick={save}>
          Save settings
        </Button>
      </div>
    </>
  );
}

function Stats() {
  const [s, setS] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    apiRequest<Record<string, number>>(`${base}/stats`)
      .then(setS)
      .catch(() => undefined);
  }, []);
  if (!s) return null;
  const items: [string, string][] = [
    ["parivars", "Parivars"],
    ["members", "Members"],
    ["totalFunds", "Funds in treasuries"],
    ["donatedToday", "Donated today"],
    ["choriToday", "Chori today"],
    ["gachaToday", "Gacha rolls today"],
    ["chestsOpen", "Chests open"],
    ["kavachOn", "Kavach on now"],
  ];
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(([k, label]) => (
        <div key={k} className="rounded-2xl border border-line bg-surface/60 px-4 py-3.5">
          <p className="text-[11px] font-bold tracking-wide text-muted uppercase">{label}</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">{fmtCoins(s[k] ?? 0)}</p>
        </div>
      ))}
    </div>
  );
}

function Logs() {
  const [kind, setKind] = useState<"funds" | "steal" | "gacha" | "chests">("funds");
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  useEffect(() => {
    setRows(null);
    apiRequest<Record<string, unknown>[]>(`${base}/logs/${kind}`)
      .then(setRows)
      .catch(() => setRows([]));
  }, [kind]);
  const cols = rows && rows[0] ? Object.keys(rows[0]) : [];
  return (
    <Card
      title="Transactions"
      action={
        <Chips
          label="Log"
          value={kind}
          onChange={setKind}
          options={[
            { value: "funds", label: "Treasury" },
            { value: "steal", label: "Chori" },
            { value: "gacha", label: "Gacha" },
            { value: "chests", label: "Chests" },
          ]}
        />
      }
    >
      {!rows ? (
        <Loading />
      ) : !rows.length ? (
        <Empty>Nothing yet.</Empty>
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] tracking-wide text-muted uppercase">
              <tr className="border-b border-line">
                {cols.map((c) => (
                  <th key={c} className="px-3 py-2 font-bold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c} className="px-3 py-1.5 whitespace-nowrap">
                      {c === "createdAt" ? new Date(String(r[c])).toLocaleString("en-IN") : String(r[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
import { useCallback, useEffect, useState } from "react";
import { Minus, Plus, Play, Square, Swords, Trash2 } from "lucide-react";
import { BACKEND_ENABLED } from "../config/api";
import { apiRequest } from "../lib/api";
import { useAdmin } from "../context";
import { Badge, Button, Card, Chips, Empty, Loading, PageHeader, timeAgo } from "../components/ui";

type Settings = { enabled: boolean; percent: number; minGiftCoins: number; officialBonus: number; itemDays: number };
type Summary = { holders: number; inCirculation: number; earnedThisWeek: number; spentThisWeek: number; officialRooms: number };
type Holder = { userId: string; name: string; publicId: number; balance: number; earned: number; updatedAt: string };
type Tx = { id: number; userId: string; name: string; publicId: number; amount: number; kind: "EARN" | "SPEND" | "GRANT" | "DEDUCT"; ref?: string; reason?: string | null; admin?: string | null; balanceAfter: number; at: string };
type RoomHost = { userId: string; name: string };
type Room = { roomId: string; roomCode: number; name: string; status: string; title?: string | null; ownerName?: string | null; online: number; live: boolean; hosts: RoomHost[] };

const KIND_TONE = { EARN: "ok", SPEND: "info", GRANT: "gold", DEDUCT: "coral" } as const;
const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

/**
 * PK system: how PK Coins are earned (percent of gifts sent in a live PK), the PK Shop default days, who holds PK Coins,
 * every change, grant / deduct with a reason, and Official PK rooms (badge, title, run their PK from here).
 */
export function PkSystemPage() {
  const { version, openUser, changed, toast } = useAdmin();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<Record<keyof Settings, string> & { enabled: string }>({ enabled: "true", percent: "", minGiftCoins: "", officialBonus: "", itemDays: "" });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [holders, setHolders] = useState<Holder[] | null>(null);
  const [q, setQ] = useState("");
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [kind, setKind] = useState<"" | Tx["kind"]>("");
  const [txUser, setTxUser] = useState("");
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [adj, setAdj] = useState({ user: "", amount: "", reason: "" });
  const [newRoom, setNewRoom] = useState({ room: "", title: "", hostUser: "" });
  const [battle, setBattle] = useState({ mode: "1v1", rule: "gifts", minutes: "10" });
  const [busy, setBusy] = useState<string | null>(null);
  const [addHost, setAddHost] = useState<Record<string, string>>({});

  const loadSettings = useCallback(() => {
    apiRequest<Settings>("/api/v1/admin/pk/settings")
      .then((s) => {
        setSettings(s);
        setForm({ enabled: String(s.enabled), percent: String(s.percent), minGiftCoins: String(s.minGiftCoins), officialBonus: String(s.officialBonus), itemDays: String(s.itemDays) });
      })
      .catch(() => setSettings(null));
    apiRequest<Summary>("/api/v1/admin/pk/summary").then(setSummary).catch(() => setSummary(null));
  }, []);
  const loadHolders = useCallback(() => {
    setHolders(null);
    apiRequest<Holder[]>(`/api/v1/admin/pk/balances?q=${encodeURIComponent(q.trim())}`).then(setHolders).catch(() => setHolders([]));
  }, [q]);
  const loadTxs = useCallback(() => {
    setTxs(null);
    const p = new URLSearchParams();
    if (kind) p.set("kind", kind);
    if (txUser.trim()) p.set("user", txUser.trim());
    apiRequest<Tx[]>(`/api/v1/admin/pk/transactions?${p}`).then(setTxs).catch((e) => {
      setTxs([]);
      toast(e instanceof Error ? e.message : "Couldn't load the log", "error");
    });
  }, [kind, txUser, toast]);
  const loadRooms = useCallback(() => {
    apiRequest<Room[]>("/api/v1/admin/pk/rooms").then(setRooms).catch(() => setRooms([]));
  }, []);
  useEffect(loadSettings, [loadSettings, version]);
  useEffect(loadRooms, [loadRooms, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadHolders, [version]);
  useEffect(loadTxs, [loadTxs, version]);

  const run = async (key: string, f: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await f();
      toast(ok);
      changed();
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (!BACKEND_ENABLED) return <Empty>The PK system needs the live backend.</Empty>;
  const n = (s: string) => (s.trim() === "" ? NaN : Number(s));
  const settingsBad = [n(form.percent), n(form.minGiftCoins), n(form.officialBonus), n(form.itemDays)].some((x) => !Number.isInteger(x) || x < 0) || n(form.itemDays) < 1;
  const amount = n(adj.amount);

  return (
    <>
      <PageHeader title="PK Coins & rooms" sub="PK Coins are a currency of their own: earned by sending gifts while a PK is live, spent only in the Shop's PK category (set a category to 'PK Coins' in Shop). PK items are never permanent. PK ranking (weekly / monthly / overall) counts PK Coins earned." />

      {summary ? (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ["Holders", summary.holders],
            ["In circulation", summary.inCirculation],
            ["Earned this week", summary.earnedThisWeek],
            ["Spent this week", summary.spentThisWeek],
            ["Official PK rooms", summary.officialRooms],
          ].map(([label, v]) => (
            <div key={label as string} className="rounded-2xl bg-surface p-3 ring-1 ring-line">
              <p className="text-xs text-muted">{label}</p>
              <p className="font-display text-xl font-bold text-cream">{fmt(v as number)}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="How PK Coins are earned">
          {!settings ? (
            <Loading />
          ) : (
            <div className="space-y-3 p-4">
              <Chips label="PK Coins" value={form.enabled} onChange={(v) => setForm((f) => ({ ...f, enabled: v }))} options={[{ value: "true", label: "On" }, { value: "false", label: "Paused" }]} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="pk-pct">PK Coins per 100 coins of gifts (%)</label>
                  <input id="pk-pct" className="field" inputMode="numeric" value={form.percent} onChange={(e) => setForm((f) => ({ ...f, percent: e.target.value.replace(/\D/g, "") }))} />
                  <p className="mt-1 text-xs text-muted">10 = a 1,000-coin gift in a live PK earns the sender 100 PK Coins.</p>
                </div>
                <div>
                  <label className="label" htmlFor="pk-min">Smallest gift that counts (coins)</label>
                  <input id="pk-min" className="field" inputMode="numeric" value={form.minGiftCoins} onChange={(e) => setForm((f) => ({ ...f, minGiftCoins: e.target.value.replace(/\D/g, "") }))} />
                </div>
                <div>
                  <label className="label" htmlFor="pk-bonus">Official PK room bonus (%)</label>
                  <input id="pk-bonus" className="field" inputMode="numeric" value={form.officialBonus} onChange={(e) => setForm((f) => ({ ...f, officialBonus: e.target.value.replace(/\D/g, "") }))} />
                  <p className="mt-1 text-xs text-muted">50 = half as much again in Official PK rooms.</p>
                </div>
                <div>
                  <label className="label" htmlFor="pk-days">PK Shop item days (default)</label>
                  <input id="pk-days" className="field" inputMode="numeric" value={form.itemDays} onChange={(e) => setForm((f) => ({ ...f, itemDays: e.target.value.replace(/\D/g, "") }))} />
                  <p className="mt-1 text-xs text-muted">PK items never last for ever. An item with its own "valid days" uses those.</p>
                </div>
              </div>
              <Button
                variant="gold"
                busy={busy === "settings"}
                disabled={settingsBad}
                onClick={() =>
                  void run(
                    "settings",
                    () => apiRequest("/api/v1/admin/pk/settings", { method: "PUT", body: { enabled: form.enabled === "true", percent: n(form.percent), minGiftCoins: n(form.minGiftCoins), officialBonus: n(form.officialBonus), itemDays: n(form.itemDays) } }),
                    "PK settings saved",
                  )
                }
              >
                Save settings
              </Button>
            </div>
          )}
        </Card>

        <Card title="Grant or deduct PK Coins">
          <div className="space-y-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="pk-user">User ID</label>
                <input id="pk-user" className="field" inputMode="numeric" value={adj.user} onChange={(e) => setAdj((a) => ({ ...a, user: e.target.value.replace(/\D/g, "") }))} placeholder="7-digit user ID" />
              </div>
              <div>
                <label className="label" htmlFor="pk-amt">PK Coins</label>
                <input id="pk-amt" className="field" inputMode="numeric" value={adj.amount} onChange={(e) => setAdj((a) => ({ ...a, amount: e.target.value.replace(/\D/g, "") }))} placeholder="e.g. 500" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="pk-why">Reason (required, saved in the log)</label>
              <input id="pk-why" className="field" maxLength={300} value={adj.reason} onChange={(e) => setAdj((a) => ({ ...a, reason: e.target.value }))} placeholder="e.g. Official PK King vs Queen winner" />
            </div>
            <div className="flex flex-wrap gap-2">
              {([1, -1] as const).map((sign) => (
                <Button
                  key={sign}
                  variant={sign > 0 ? "gold" : "danger"}
                  busy={busy === `adj${sign}`}
                  disabled={!adj.user || !Number.isInteger(amount) || amount <= 0 || !adj.reason.trim()}
                  onClick={async () => {
                    if (sign < 0 && !window.confirm(`Take ${fmt(amount)} PK Coins from user ${adj.user}?`)) return;
                    const ok = await run(`adj${sign}`, () => apiRequest("/api/v1/admin/pk/adjust", { method: "POST", body: { user: adj.user, amount: sign * amount, reason: adj.reason.trim() } }), sign > 0 ? `${fmt(amount)} PK Coins granted` : `${fmt(amount)} PK Coins deducted`);
                    if (ok) setAdj({ user: "", amount: "", reason: "" });
                  }}
                >
                  {sign > 0 ? <Plus className="h-4 w-4" aria-hidden /> : <Minus className="h-4 w-4" aria-hidden />} {sign > 0 ? "Grant" : "Deduct"}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted">A balance can never go below 0. Every change is logged with your name and the reason.</p>
          </div>
        </Card>
      </div>

      <Card title="Official PK rooms" className="mt-4">
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[160px_1fr_160px_auto]">
          <input className="field" inputMode="numeric" value={newRoom.room} onChange={(e) => setNewRoom((r) => ({ ...r, room: e.target.value.replace(/\D/g, "") }))} placeholder="Room ID" aria-label="Room ID" />
          <input className="field" maxLength={80} value={newRoom.title} onChange={(e) => setNewRoom((r) => ({ ...r, title: e.target.value }))} placeholder="Event title, e.g. Official PK King vs Queen" aria-label="Event title" />
          <input className="field" inputMode="numeric" value={newRoom.hostUser} onChange={(e) => setNewRoom((r) => ({ ...r, hostUser: e.target.value.replace(/\D/g, "") }))} placeholder="Host admin ID (optional)" aria-label="Host admin ID" />
          <Button
            variant="primary"
            busy={busy === "room"}
            disabled={!newRoom.room}
            onClick={async () => {
              const ok = await run("room", () => apiRequest("/api/v1/admin/pk/rooms", { method: "POST", body: newRoom }), "Room is now an Official PK room");
              if (ok) {
                setNewRoom({ room: "", title: "", hostUser: "" });
                loadRooms();
              }
            }}
          >
            <Swords className="h-4 w-4" aria-hidden /> Make Official PK
          </Button>
        </div>
        <p className="border-b border-line px-4 py-2 text-xs text-muted">Host admin: made a room admin there, so they can set up, start and close its PK (1 vs 1 or multiplayer, any rule or length) from inside the app itself — add more below.</p>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-3">
          <Chips label="Mode" value={battle.mode} onChange={(v) => setBattle((b) => ({ ...b, mode: v }))} options={[{ value: "1v1", label: "1 vs 1" }, { value: "team", label: "Team" }]} />
          <Chips label="Rule" value={battle.rule} onChange={(v) => setBattle((b) => ({ ...b, rule: v }))} options={[{ value: "gifts", label: "By gifts" }, { value: "votes", label: "By votes" }]} />
          <Chips label="Minutes" value={battle.minutes} onChange={(v) => setBattle((b) => ({ ...b, minutes: v }))} options={["3", "5", "10", "15", "30", "60"].map((m) => ({ value: m, label: m }))} />
        </div>
        {!rooms ? (
          <Loading />
        ) : rooms.length ? (
          <ul className="divide-y divide-line">
            {rooms.map((r) => (
              <li key={r.roomId} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-cream">
                    {r.name} {r.live ? <Badge tone="coral">PK live</Badge> : null} {r.status !== "ACTIVE" ? <Badge>{r.status}</Badge> : null}
                  </p>
                  <p className="truncate text-xs text-muted">
                    Room ID {r.roomCode} · {r.title || "no title"} · owner {r.ownerName ?? "?"} · {r.online} online
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    Host admins:{" "}
                    {r.hosts.length ? (
                      r.hosts.map((h) => (
                        <Badge key={h.userId} tone="info">
                          {h.name}
                        </Badge>
                      ))
                    ) : (
                      <span>none yet</span>
                    )}
                  </p>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      className="field h-8 max-w-[160px] text-xs"
                      inputMode="numeric"
                      value={addHost[r.roomId] ?? ""}
                      onChange={(e) => setAddHost((m) => ({ ...m, [r.roomId]: e.target.value.replace(/\D/g, "") }))}
                      placeholder="Host admin ID"
                      aria-label={`Add a host admin to ${r.name}`}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      busy={busy === `host${r.roomId}`}
                      disabled={!addHost[r.roomId]}
                      onClick={async () => {
                        const ok = await run(`host${r.roomId}`, () => apiRequest(`/api/v1/admin/pk/rooms/${r.roomId}/host`, { method: "POST", body: { user: addHost[r.roomId] } }), "Host admin added");
                        if (ok) {
                          setAddHost((m) => ({ ...m, [r.roomId]: "" }));
                          loadRooms();
                        }
                      }}
                    >
                      Add host
                    </Button>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {r.live ? (
                    <Button size="sm" variant="danger" busy={busy === `stop${r.roomId}`} onClick={async () => (await run(`stop${r.roomId}`, () => apiRequest(`/api/v1/admin/pk/rooms/${r.roomId}/battle`, { method: "DELETE" }), "PK closed")) && loadRooms()}>
                      <Square className="h-4 w-4" aria-hidden /> Close PK
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="gold"
                      busy={busy === `go${r.roomId}`}
                      onClick={async () => (await run(`go${r.roomId}`, () => apiRequest(`/api/v1/admin/pk/rooms/${r.roomId}/battle`, { method: "POST", body: { mode: battle.mode, rule: battle.rule, minutes: Number(battle.minutes) } }), "PK started")) && loadRooms()}
                    >
                      <Play className="h-4 w-4" aria-hidden /> Start PK
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    busy={busy === `rm${r.roomId}`}
                    onClick={async () => {
                      if (!window.confirm(`${r.name} stops being an Official PK room?`)) return;
                      if (await run(`rm${r.roomId}`, () => apiRequest(`/api/v1/admin/pk/rooms/${r.roomId}`, { method: "DELETE" }), "No longer official")) loadRooms();
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden /> Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No Official PK rooms yet. Add one with its room ID above. It gets an Official PK badge and title, and its PK earns the bonus.</Empty>
        )}
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="PK Coin holders">
          <div className="flex gap-2 border-b border-line p-3">
            <input className="field" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadHolders()} placeholder="Search name or ID" aria-label="Search holders" />
            <Button variant="ghost" onClick={loadHolders}>Search</Button>
          </div>
          {!holders ? (
            <Loading />
          ) : holders.length ? (
            <ul className="max-h-[480px] divide-y divide-line overflow-y-auto">
              {holders.map((h) => (
                <li key={h.userId} className="flex items-center gap-3 px-4 py-2.5">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openUser(h.userId)}>
                    <p className="truncate font-semibold text-cream">{h.name}</p>
                    <p className="text-xs text-muted">ID {h.publicId} · earned {fmt(h.earned)}</p>
                  </button>
                  <span className="font-display font-bold text-gold">{fmt(h.balance)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No one holds PK Coins yet.</Empty>
          )}
        </Card>

        <Card title="PK Coin log">
          <div className="flex flex-wrap items-end gap-2 border-b border-line p-3">
            <Chips label="Kind" value={kind} onChange={setKind} options={[{ value: "", label: "All" }, { value: "EARN", label: "Earned" }, { value: "SPEND", label: "Spent" }, { value: "GRANT", label: "Granted" }, { value: "DEDUCT", label: "Deducted" }]} />
            <input className="field max-w-[160px]" inputMode="numeric" value={txUser} onChange={(e) => setTxUser(e.target.value.replace(/\D/g, ""))} placeholder="User ID" aria-label="Filter by user ID" />
          </div>
          {!txs ? (
            <Loading />
          ) : txs.length ? (
            <ul className="max-h-[480px] divide-y divide-line overflow-y-auto">
              {txs.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Badge tone={KIND_TONE[t.kind]}>{t.kind}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-cream">
                      {t.name} <span className="text-xs font-normal text-muted">ID {t.publicId}</span>
                    </p>
                    <p className="truncate text-xs text-muted">
                      {[t.reason, t.admin ? `by ${t.admin}` : null, t.ref, timeAgo(Date.parse(t.at))].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className={`font-display font-bold ${t.amount >= 0 ? "text-ok" : "text-coral"}`}>
                    {t.amount >= 0 ? "+" : "−"}
                    {fmt(Math.abs(t.amount))}
                  </span>
                  <span className="hidden w-20 text-right text-xs text-muted sm:block">= {fmt(t.balanceAfter)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No PK Coin changes yet.</Empty>
          )}
        </Card>
      </div>
    </>
  );
}

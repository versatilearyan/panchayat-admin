/**
 * Newbie Room Management, live from the backend (/api/v1/admin/newbie).
 *
 * Welcome rooms for new members: the rooms and their hosts, the settings (automatic rooms, the Newbie period, room
 * limits, extra seats, the Welcome Newbie gift and messages) and the numbers. Every change is recorded in the audit log.
 */
import { useCallback, useEffect, useState } from "react";
import { Plus, Power, Trash2, UserCog, X } from "lucide-react";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Button, Card, Chips, Empty, ErrorNote, Loading, Modal, NumberField, PageHeader, Toggle } from "../components/ui";
import { UserPicker } from "./RoomsLive";

const base = "/api/v1/admin/newbie";

type Host = { id: string | null; name: string | null; avatarUrl: string | null; publicId: number | null; online: boolean };
type NRoom = {
  id: number;
  roomId: number;
  roomCode: number;
  number: number;
  name: string;
  status: "ACTIVE" | "DISABLED" | "EXPIRED" | "CLOSED";
  priority: number;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string | null;
  host: Host;
  capacity: number;
  joined: number;
  newbiesInside: number;
  extraSeats: boolean;
  visitors: number;
  welcomeGifts: number;
};
type Page = { content: NRoom[]; page: number; size: number; totalElements: number };
type HostRow = { userId: string; name: string; avatarUrl: string | null; publicId: number; active: boolean; addedBy: string | null; rooms: number; activeRooms: number; giftsSent: number; giftCoins: number; newbiesWelcomed: number; lastActive: string | null };
type Cfg = {
  autoCreate: boolean;
  eligibilityDays: number;
  maxRooms: number;
  roomCapacity: number;
  roomLifetimeHours: number;
  extraSeatsAllowed: boolean;
  hostGraceMinutes: number;
  welcomeGiftEnabled: boolean;
  welcomeGiftId: string;
  welcomeTitle: string;
  welcomeMessage: string;
  roomDescription: string;
  priority: number;
};
type Stats = {
  totalRooms: number;
  activeRooms: number;
  newbiesWelcomed: number;
  newbiesAssigned: number;
  newbieRoomJoins: number;
  becameActive: number;
  conversionPercent: number;
  welcomeGiftsSent: number;
  welcomeGiftCoins: number;
  hosts: number;
  insideNow: number;
  avgVisitorsPerRoom: number;
  recent: { kind: string; detail: string | null; at: string; roomId: string | null }[];
};

const TABS = [
  { value: "rooms", label: "Rooms" },
  { value: "hosts", label: "Hosts" },
  { value: "settings", label: "Settings" },
  { value: "stats", label: "Analytics" },
] as const;
type Tab = (typeof TABS)[number]["value"];
const STATUS_TONE: Record<string, "ok" | "warn" | "muted" | "coral"> = { ACTIVE: "ok", DISABLED: "warn", EXPIRED: "muted", CLOSED: "muted" };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-");
const msg = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);

function HostCell({ h }: { h: Host }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="relative shrink-0">
        {h.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={h.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-cream/10 text-xs font-bold">{(h.name ?? "?").slice(0, 1).toUpperCase()}</span>
        )}
        <span className={`absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${h.online ? "bg-[#3ddc84]" : "bg-muted"}`} title={h.online ? "In the room" : "Not in the room"} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{h.name ?? "No host"}</span>
        <span className="block text-[11px] text-muted">{h.publicId ? `ID ${h.publicId}` : ""}</span>
      </span>
    </span>
  );
}

export function NewbieRoomsPage() {
  const [tab, setTab] = useState<Tab>("rooms");
  return (
    <div>
      <PageHeader title="Newbie Room Management" sub="Welcome rooms that greet new members, hosted by your team. Shown first in the app." />
      <div className="mb-4">
        <Chips options={TABS.map((t) => ({ value: t.value, label: t.label }))} value={tab} onChange={(v) => setTab(v as Tab)} label="Section" />
      </div>
      {tab === "rooms" ? <RoomsTab /> : tab === "hosts" ? <HostsTab /> : tab === "settings" ? <SettingsTab /> : <StatsTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ rooms */

function RoomsTab() {
  const { toast, changed, version } = useAdmin();
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState("");
  const [create, setCreate] = useState(false);
  const [hostFor, setHostFor] = useState<NRoom | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    apiRequest<Page>(`${base}/rooms?status=${status}&q=${encodeURIComponent(q.trim())}&page=${page}&size=15`)
      .then((r) => {
        setData(r);
        setError("");
      })
      .catch((e) => setError(msg(e, "Couldn't load the rooms")));
  }, [status, q, page]);
  useEffect(() => {
    const t = window.setTimeout(load, q ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [load, version]);
  useEffect(() => setPage(0), [status, q]);

  const act = async (r: NRoom, f: () => Promise<unknown>, ok: string) => {
    setBusy(r.roomId);
    try {
      await f();
      toast(ok);
      changed();
      load();
    } catch (e) {
      toast(msg(e, "That didn't work"), "error");
    } finally {
      setBusy(null);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.totalElements / data.size)) : 1;
  return (
    <>
      <Card
        title={`Welcome rooms${data ? ` (${data.totalElements})` : ""}`}
        action={
          <Button variant="primary" onClick={() => setCreate(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New welcome room
          </Button>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input className="field max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, number, room ID or host" aria-label="Search rooms" />
          <select className="field w-40" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            {["ALL", "ACTIVE", "DISABLED", "EXPIRED", "CLOSED"].map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All statuses" : s[0] + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        {!data ? (
          <Loading />
        ) : !data.content.length ? (
          <Empty>No welcome rooms yet. Add a host, then create one (or turn on automatic rooms in Settings).</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-[11px] tracking-wide text-muted uppercase">
                <tr>
                  <th className="py-2 pr-3">Room</th>
                  <th className="pr-3">Host</th>
                  <th className="pr-3">People</th>
                  <th className="pr-3">Created</th>
                  <th className="pr-3">Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.content.map((r) => (
                  <tr key={r.id} className="align-middle">
                    <td className="py-2.5 pr-3">
                      <span className="block font-semibold">{r.name}</span>
                      <span className="text-[11px] text-muted">
                        No. {r.number} · Room ID {r.roomCode}
                      </span>
                    </td>
                    <td className="pr-3">
                      <HostCell h={r.host} />
                    </td>
                    <td className="pr-3 text-xs">
                      <span className="block">
                        {r.joined}/{r.capacity} inside
                      </span>
                      <span className="text-muted">
                        {r.newbiesInside} new · {r.welcomeGifts} gifts
                      </span>
                    </td>
                    <td className="pr-3 text-xs">
                      <span className="block">{when(r.createdAt)}</span>
                      <span className="text-muted">{r.status === "ACTIVE" && r.expiresAt ? `ends ${when(r.expiresAt)}` : r.createdBy ? `by ${r.createdBy}` : ""}</span>
                    </td>
                    <td className="pr-3">
                      <Badge tone={STATUS_TONE[r.status]}>{r.status.toLowerCase()}</Badge>
                      {r.extraSeats ? (
                        <span className="ml-1">
                          <Badge tone="gold">+6 seats</Badge>
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2">
                      <span className="flex flex-wrap justify-end gap-1.5">
                        {r.status === "ACTIVE" ? (
                          <Button size="sm" disabled={busy === r.roomId} onClick={() => void act(r, () => apiRequest(`${base}/rooms/${r.roomId}/extra-seats`, { method: "PUT", body: { enabled: !r.extraSeats } }), r.extraSeats ? "Extra seats closed" : "Extra seats opened")}>
                            {r.extraSeats ? "Close extra seats" : "Open extra seats"}
                          </Button>
                        ) : null}
                        <Button size="sm" disabled={busy === r.roomId} onClick={() => setHostFor(r)}>
                          <UserCog className="h-3.5 w-3.5" aria-hidden /> Host
                        </Button>
                        {r.status === "ACTIVE" ? (
                          <Button size="sm" disabled={busy === r.roomId} onClick={() => void act(r, () => apiRequest(`${base}/rooms/${r.roomId}/disable`, { method: "POST" }), "Room disabled")}>
                            <Power className="h-3.5 w-3.5" aria-hidden /> Disable
                          </Button>
                        ) : (
                          <Button size="sm" disabled={busy === r.roomId} onClick={() => void act(r, () => apiRequest(`${base}/rooms/${r.roomId}/activate`, { method: "POST" }), "Room is open again")}>
                            <Power className="h-3.5 w-3.5" aria-hidden /> Activate
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy === r.roomId}
                          onClick={() => window.confirm(`Delete ${r.name}? It closes for good and leaves this list.`) && void act(r, () => apiRequest(`${base}/rooms/${r.roomId}`, { method: "DELETE" }), "Room deleted")}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && pages > 1 ? (
          <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted">
            <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span>
              Page {page + 1} of {pages}
            </span>
            <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        ) : null}
      </Card>

      <Modal open={create} onClose={() => setCreate(false)} title="New welcome room">
        <p className="mb-2 text-sm text-muted">Pick the host. The room name and number are made by the server (Newbie Welcome #10001, #10002 ...).</p>
        <UserPicker
          placeholder="Search the host by name, email or ID"
          onPick={(u) =>
            void (async () => {
              try {
                await apiRequest(`${base}/rooms`, { method: "POST", body: { hostId: String(u.id) } });
                toast("Welcome room created");
                changed();
                setCreate(false);
                load();
              } catch (e) {
                toast(msg(e, "Couldn't create the room"), "error");
              }
            })()
          }
        />
      </Modal>
      <Modal open={Boolean(hostFor)} onClose={() => setHostFor(null)} title={hostFor ? `Host of ${hostFor.name}` : ""}>
        <p className="mb-2 text-sm text-muted">The new host becomes the owner of the room and takes the host seat.</p>
        <UserPicker
          placeholder="Search the new host"
          onPick={(u) =>
            void (async () => {
              try {
                await apiRequest(`${base}/rooms/${hostFor!.roomId}/host`, { method: "PUT", body: { hostId: String(u.id) } });
                toast("Host changed");
                changed();
                setHostFor(null);
                load();
              } catch (e) {
                toast(msg(e, "Couldn't change the host"), "error");
              }
            })()
          }
        />
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ hosts */

function HostsTab() {
  const { toast, changed, version } = useAdmin();
  const [rows, setRows] = useState<HostRow[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    apiRequest<HostRow[]>(`${base}/hosts`)
      .then((r) => {
        setRows(r);
        setError("");
      })
      .catch((e) => setError(msg(e, "Couldn't load the hosts")));
  }, []);
  useEffect(load, [load, version]);
  return (
    <Card title="Hosts" action={<span className="text-xs text-muted">Only people on this list can host welcome rooms and send the welcome gift.</span>}>
      <div className="mb-3 max-w-md">
        <UserPicker
          placeholder="Add a host: search by name, email or ID"
          onPick={(u) =>
            void (async () => {
              try {
                setRows(await apiRequest<HostRow[]>(`${base}/hosts`, { method: "POST", body: { hostId: String(u.id) } }));
                toast(`${u.name} is a host now`);
                changed();
              } catch (e) {
                toast(msg(e, "Couldn't add the host"), "error");
              }
            })()
          }
        />
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!rows ? (
        <Loading />
      ) : !rows.length ? (
        <Empty>No hosts yet.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[11px] tracking-wide text-muted uppercase">
              <tr>
                <th className="py-2 pr-3">Host</th>
                <th className="pr-3">Rooms</th>
                <th className="pr-3">New members welcomed</th>
                <th className="pr-3">Welcome gifts</th>
                <th className="pr-3">Last in a welcome room</th>
                <th className="text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((h) => (
                <tr key={h.userId}>
                  <td className="py-2.5 pr-3">
                    <HostCell h={{ id: h.userId, name: h.name, avatarUrl: h.avatarUrl, publicId: h.publicId, online: false }} />
                  </td>
                  <td className="pr-3">
                    {h.activeRooms} active / {h.rooms} total
                  </td>
                  <td className="pr-3">{h.newbiesWelcomed}</td>
                  <td className="pr-3">
                    {h.giftsSent} <span className="text-xs text-muted">({h.giftCoins.toLocaleString("en-IN")} coins)</span>
                  </td>
                  <td className="pr-3 text-xs">{when(h.lastActive)}</td>
                  <td className="text-right">
                    {h.active ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          window.confirm(`Remove ${h.name} as a host? Their active room keeps running until you change its host.`) &&
                          void apiRequest<HostRow[]>(`${base}/hosts/${h.userId}`, { method: "DELETE" })
                            .then((r) => {
                              setRows(r);
                              toast("Host removed");
                              changed();
                            })
                            .catch((e) => toast(msg(e, "Couldn't remove the host"), "error"))
                        }
                      >
                        <X className="h-3.5 w-3.5" aria-hidden /> Remove
                      </Button>
                    ) : (
                      <Badge tone="muted">removed</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ settings */

function SettingsTab() {
  const { toast, changed } = useAdmin();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [saved, setSaved] = useState<Cfg | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    apiRequest<Cfg>(`${base}/config`)
      .then((c) => {
        setCfg(c);
        setSaved(c);
      })
      .catch((e) => setError(msg(e, "Couldn't load the settings")));
  }, []);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!cfg || !saved) return <Loading />;
  const set = <K extends keyof Cfg>(k: K, v: Cfg[K]) => setCfg({ ...cfg, [k]: v });
  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);
  const save = async () => {
    setBusy(true);
    try {
      const c = await apiRequest<Cfg>(`${base}/config`, { method: "PUT", body: cfg });
      setCfg(c);
      setSaved(c);
      toast("Settings saved");
      changed();
    } catch (e) {
      toast(msg(e, "Couldn't save"), "error");
    } finally {
      setBusy(false);
    }
  };
  const num = (label: string, k: keyof Cfg, suffix: string, hint: string) => (
    <div>
      <label className="label" htmlFor={`nb-${k}`}>
        {label}
      </label>
      <NumberField id={`nb-${k}`} value={cfg[k] as number} onChange={(n) => set(k, n as never)} suffix={suffix} />
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Rooms">
        <div className="space-y-4">
          <Toggle checked={cfg.autoCreate} onChange={(v) => set("autoCreate", v)} label="Create rooms automatically" hint="When a new member signs up and no welcome room has a free spot, open one with a free host from your Hosts list." />
          {num("Maximum welcome rooms open at once", "maxRooms", "rooms", "New rooms are refused after this.")}
          {num("Room capacity", "roomCapacity", "people", "16 to 50. At least 16 so the extra seats fit.")}
          {num("Room lifetime", "roomLifetimeHours", "hours", "A welcome room closes by itself after this time.")}
          {num("Host grace time", "hostGraceMinutes", "min", "If the host stays away this long, the room goes to a free host (or closes if it is empty).")}
          {num("Priority", "priority", "", "Lower numbers show first when rooms are otherwise equal (0 to 1000).")}
          <div>
            <label className="label" htmlFor="nb-desc">
              Room description
            </label>
            <textarea id="nb-desc" className="field min-h-[70px]" maxLength={300} value={cfg.roomDescription} onChange={(e) => set("roomDescription", e.target.value)} />
          </div>
        </div>
      </Card>
      <Card title="New members and gift">
        <div className="space-y-4">
          {num("Newbie period", "eligibilityDays", "days", "How long a new account keeps the NEWBIE badge and welcome benefits (1 to 365).")}
          <Toggle checked={cfg.extraSeatsAllowed} onChange={(v) => set("extraSeatsAllowed", v)} label="Allow the 6 extra welcome seats" hint="Hosts see Enable Extra Welcome Seats in room settings only when this is on." />
          <Toggle checked={cfg.welcomeGiftEnabled} onChange={(v) => set("welcomeGiftEnabled", v)} label="Welcome Newbie gift available" hint="Hosts can send it once to each new member. The host pays its price from their own coins." />
          <div>
            <label className="label" htmlFor="nb-gift">
              Welcome gift ID
            </label>
            <input id="nb-gift" className="field" value={cfg.welcomeGiftId} onChange={(e) => set("welcomeGiftId", e.target.value)} />
            <p className="mt-1 text-xs text-muted">Price, picture and animation are set in Gifts. The gift is called Welcome Newbie and stays off sale until you add its picture and turn it on.</p>
          </div>
          <div>
            <label className="label" htmlFor="nb-title">
              Welcome title
            </label>
            <input id="nb-title" className="field" maxLength={80} value={cfg.welcomeTitle} onChange={(e) => set("welcomeTitle", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="nb-msg">
              Welcome message
            </label>
            <textarea id="nb-msg" className="field min-h-[110px]" maxLength={600} value={cfg.welcomeMessage} onChange={(e) => set("welcomeMessage", e.target.value)} />
            <p className="mt-1 text-xs text-muted">Shown once in the welcome card when a new member first enters a welcome room.</p>
          </div>
        </div>
      </Card>
      <div className="lg:col-span-2 flex justify-end">
        <Button variant="primary" busy={busy} disabled={!dirty} onClick={() => void save()}>
          Save settings
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ analytics */

function StatsTab() {
  const { version } = useAdmin();
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiRequest<Stats>(`${base}/analytics`)
      .then(setS)
      .catch((e) => setError(msg(e, "Couldn't load the numbers")));
  }, [version]);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!s) return <Loading />;
  const tiles: [string, string | number, string?][] = [
    ["Total welcome rooms", s.totalRooms],
    ["Active rooms", s.activeRooms],
    ["Inside right now", s.insideNow],
    ["New members welcomed", s.newbiesWelcomed, "Newbies who entered a welcome room"],
    ["Joins into welcome rooms", s.newbieRoomJoins],
    ["Became active", s.becameActive, "Also joined a regular voice room"],
    ["Newbie to active", `${s.conversionPercent}%`],
    ["Welcome gifts sent", s.welcomeGiftsSent],
    ["Welcome gift coins", s.welcomeGiftCoins.toLocaleString("en-IN")],
    ["Hosts", s.hosts],
    ["Visitors per room", s.avgVisitorsPerRoom],
    ["Assigned to a room", s.newbiesAssigned, "At sign-up"],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {tiles.map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-[11px] tracking-wide text-muted uppercase">{label}</p>
            <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
            {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
          </div>
        ))}
      </div>
      <Card title="Recent activity">
        {!s.recent.length ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {s.recent.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <b>{e.kind.replaceAll("_", " ").toLowerCase()}</b>
                  {e.detail ? <span className="text-muted"> · {e.detail}</span> : null}
                  {e.roomId ? <span className="text-muted"> · room {e.roomId}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-muted">{when(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

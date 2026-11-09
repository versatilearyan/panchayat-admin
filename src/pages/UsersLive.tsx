/**
 * The app's real users (/api/v1/admin/users): how many there are, how many are
 * online and active, and a searchable list (name, email, 7-digit ID). Admins
 * and Super Admins.
 */
import { useEffect, useState } from "react";
import { Ban, Gift, RefreshCw, ShieldCheck } from "lucide-react";
import { useAdmin } from "../context";
import { Avatar, Badge, Button, Card, Chips, Empty, fmtCoins, Loading, PageHeader } from "../components/ui";
import { Pager } from "../components/WalletParts";
import { GiveAllButton } from "../components/GiveAll";
import { BanDialog, RedPacketGiftDialog } from "../components/UserModeration";
import { mediaHref } from "../components/MediaParts";
import { adminUsersService, type AppUser, type UserFilter, type UserStats } from "../services/adminUsersService";
import type { Paged } from "../services/rewardService";

const ago = (iso: string | null) => {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 30 * 86400) return `${Math.round(s / 86400)} days ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

function Tile({ label, value, sub, live }: { label: string; value: number; sub?: string; live?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/60 px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-muted uppercase">
        {live ? <span className="h-2 w-2 rounded-full bg-ok" aria-hidden /> : null}
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{fmtCoins(value)}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

export function UsersLivePage() {
  const { version, changed, toast } = useAdmin();
  const [banUser, setBanUser] = useState<AppUser | null>(null);
  const [packetUser, setPacketUser] = useState<AppUser | null>(null);
  const [tick, setTick] = useState(0);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [data, setData] = useState<Paged<AppUser> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<UserFilter>("all");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    adminUsersService
      .stats()
      .then((s) => live && setStats(s))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't load the counts."));
    return () => {
      live = false;
    };
  }, [version, tick]);

  useEffect(() => {
    let live = true;
    adminUsersService
      .list({ page, q, filter })
      .then((d) => live && (setData(d), setError(null)))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't load users."));
    return () => {
      live = false;
    };
  }, [page, q, filter, version, tick]);

  // Online counts change all the time: refresh every 30 seconds
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const pages = data ? Math.ceil(data.totalElements / data.size) : 0;
  return (
    <>
      <PageHeader
        title="Users"
        sub="Everyone signed up in the app. Online = has the app open right now. Active = signed in, joined a room or used coins in that time."
        right={
          <span className="flex gap-2">
            <GiveAllButton />
            <Button onClick={() => setTick((n) => n + 1)}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </span>
        }
      />
      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-[#3a1418] px-3.5 py-2.5 text-sm text-[#ffb0b4]">
          {error}
        </p>
      ) : null}

      {stats ? (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Total users" value={stats.total} sub={`${fmtCoins(stats.profileCompleted)} finished their profile`} />
          <Tile label="Online now" value={stats.onlineNow} sub={`${fmtCoins(stats.inRoomsNow)} in rooms`} live />
          <Tile label="Active today" value={stats.activeToday} sub={`${fmtCoins(stats.active7Days)} in 7 days · ${fmtCoins(stats.active30Days)} in 30`} />
          <Tile label="New users" value={stats.newToday} sub={`today · ${fmtCoins(stats.new7Days)} in 7 days · ${fmtCoins(stats.vipActive)} VIP`} />
        </div>
      ) : null}

      <Card
        title={data ? `${fmtCoins(data.totalElements)} users` : "Users"}
        action={
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(0);
              setQ(input.trim());
            }}
          >
            <input className="field h-9 w-56 py-1" placeholder="Name, email or 7-digit ID" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Search users" />
            <Button size="sm" type="submit">
              Search
            </Button>
          </form>
        }
      >
        <div className="border-b border-line px-4 py-3">
          <Chips
            label="Show"
            value={filter}
            onChange={(v) => {
              setPage(0);
              setFilter(v);
            }}
            options={[
              { value: "all", label: "All" },
              { value: "online", label: "Online now" },
              { value: "vip", label: "VIP" },
              { value: "new", label: "New (7 days)" },
              { value: "banned", label: "Banned" },
            ]}
          />
        </div>
        {!data ? (
          <Loading />
        ) : !data.content.length ? (
          <Empty>No users match.</Empty>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="text-[11px] tracking-wide text-muted uppercase">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-bold">User</th>
                  <th className="px-2 py-2 font-bold">ID</th>
                  <th className="px-2 py-2 font-bold">Status</th>
                  <th className="px-2 py-2 text-right font-bold">Coins</th>
                  <th className="px-2 py-2 font-bold">VIP</th>
                  <th className="px-2 py-2 font-bold">Joined</th>
                  <th className="px-2 py-2 font-bold">Last active</th>
                  <th className="px-4 py-2 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.content.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={u.name ?? "?"} color="#3a3a44" photoUrl={mediaHref(u.avatarUrl) ?? undefined} size={34} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{u.name || "No name yet"}</span>
                          <span className="block truncate text-xs text-muted">{u.email ?? "—"}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="font-mono font-semibold">{u.publicId}</span>
                      <span className="block text-[11px] text-muted">#{u.id}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      {u.banned ? (
                        <span className="block">
                          <Badge tone="coral">{u.banPermanent ? "Banned" : `Suspended till ${new Date(u.bannedUntil ?? "").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}</Badge>
                        </span>
                      ) : u.inRoom ? <Badge tone="ok">In a room</Badge> : u.online ? <Badge tone="ok">Online</Badge> : <Badge>Offline</Badge>}
                      {!u.profileCompleted ? (
                        <span className="mt-1 block">
                          <Badge tone="warn">Profile not finished</Badge>
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{fmtCoins(u.coins)}</td>
                    <td className="px-2 py-2.5">{u.vipLevel ? <Badge tone="gold">VIP {u.vipLevel}</Badge> : <span className="text-muted">—</span>}</td>
                    <td className="px-2 py-2.5 whitespace-nowrap text-muted">{new Date(u.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="px-2 py-2.5 whitespace-nowrap text-muted">{ago(u.lastActiveAt)}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex justify-end gap-1.5">
                        <Button size="sm" onClick={() => setPacketUser(u)} aria-label={`Give ${u.name ?? "user"} a red packet`}>
                          <Gift className="h-3.5 w-3.5" /> Red packet
                        </Button>
                        {u.banned ? (
                          <Button
                            size="sm"
                            variant="ok"
                            onClick={() =>
                              adminUsersService
                                .unban(u.id)
                                .then(() => (toast(`${u.name ?? "User"} is unbanned`), changed()))
                                .catch((e) => toast(e instanceof Error ? e.message : "Couldn't unban", "error"))
                            }
                          >
                            <ShieldCheck className="h-3.5 w-3.5" /> Unban
                          </Button>
                        ) : (
                          <Button size="sm" variant="danger" onClick={() => setBanUser(u)}>
                            <Ban className="h-3.5 w-3.5" /> Ban
                          </Button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data ? <Pager page={page} pages={pages} total={data.totalElements} onPage={setPage} /> : null}
      </Card>
      <BanDialog user={banUser} onClose={() => setBanUser(null)} />
      <RedPacketGiftDialog user={packetUser} onClose={() => setPacketUser(null)} />
    </>
  );
}

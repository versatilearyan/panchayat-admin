import { useMemo, useState } from "react";
import { Ban, Coins, Crown, DoorOpen, Flag, Gift, IndianRupee, MessageSquareWarning, MicOff, Package, Search, Settings, ShieldCheck, StickyNote, Undo2, UserCog, UserPen, Landmark, Volume2, Warehouse } from "lucide-react";
import { adminApi, type AuditAction, type AuditEntry, type Permission } from "../api";
import { useAdmin } from "../context";
import { Card, Chips, Empty, ErrorNote, fmtDate, Loading, PageHeader, timeAgo, useLoad } from "../components/ui";

const ICON: Record<AuditAction, [typeof Ban, string]> = {
  coins: [Coins, "text-gold"],
  ban: [Ban, "text-coral"],
  unban: [ShieldCheck, "text-ok"],
  mute: [MicOff, "text-warn"],
  unmute: [Volume2, "text-ok"],
  warn: [MessageSquareWarning, "text-gold"],
  kick: [DoorOpen, "text-info"],
  unkick: [Undo2, "text-ok"],
  report: [Flag, "text-muted"],
  note: [StickyNote, "text-muted"],
  vip: [Crown, "text-gold"],
  item: [Package, "text-gold"],
  room: [Warehouse, "text-info"],
  gift: [Gift, "text-coral"],
  product: [Package, "text-info"],
  pricing: [IndianRupee, "text-gold"],
  staff: [UserCog, "text-info"],
  settings: [Settings, "text-muted"],
  profile: [UserPen, "text-info"],
  sarpanch: [Landmark, "text-gold"],
};

const GROUPS: Record<Exclude<Filter, "all">, AuditAction[]> = {
  moderation: ["ban", "unban", "mute", "unmute", "warn", "kick", "unkick"],
  coins: ["coins"],
  reports: ["report"],
  grants: ["vip", "item"],
  catalog: ["gift", "product", "pricing", "room"],
  admin: ["staff", "settings", "profile", "sarpanch"],
};

export function ActivityRow({ entry: e }: { entry: AuditEntry }) {
  const { openUser } = useAdmin();
  const [Icon, color] = ICON[e.action];
  const body = (
    <>
      <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cream/[0.05] ${color}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{e.detail}</p>
        <p className="mt-0.5 text-xs text-muted" title={fmtDate(e.at)}>
          {e.by} · {timeAgo(e.at)}
        </p>
      </div>
    </>
  );
  return (
    <li>
      {e.userId ? (
        <button type="button" onClick={() => openUser(e.userId!)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-cream/[0.03]">
          {body}
        </button>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3">{body}</div>
      )}
    </li>
  );
}

type Filter = "all" | "coins" | "moderation" | "reports" | "grants" | "catalog" | "admin";

/** Filter chips only for kinds of actions this person can take themselves. */
const GROUP_PERMISSION: Record<Exclude<Filter, "all">, Permission> = {
  moderation: "users.mute",
  coins: "users.coins",
  reports: "reports.handle",
  grants: "users.vip",
  catalog: "gifts.manage",
  admin: "staff.manage",
};

export function ActivityPage() {
  const { version, can } = useAdmin();
  const { data, error, loading } = useLoad(() => adminApi.listAudit(500), [version]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter(
      (e) =>
        (filter === "all" || GROUPS[filter].includes(e.action)) &&
        (!term || e.detail.toLowerCase().includes(term) || e.by.toLowerCase().includes(term)),
    );
  }, [data, q, filter]);

  return (
    <>
      <PageHeader title="Activity log" sub="Staff actions, newest first. Entries can't be edited or deleted." />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input className="field pl-9" placeholder="Search actions or admins" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the log" />
        </div>
        <Chips
          label="Filter"
          value={filter}
          onChange={setFilter}
          options={(
            [
              { value: "all", label: "All" },
              { value: "moderation", label: "Moderation" },
              { value: "coins", label: "Coins" },
              { value: "reports", label: "Reports" },
              { value: "grants", label: "VIP & items" },
              { value: "catalog", label: "Gifts, shop & rooms" },
              { value: "admin", label: "Staff, Sarpanch & settings" },
            ] as { value: Filter; label: string }[]
          ).filter((o) => o.value === "all" || can(GROUP_PERMISSION[o.value]))}
        />
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Card>
        {loading && !data ? (
          <Loading />
        ) : list.length ? (
          <ul className="divide-y divide-line">
            {list.map((e) => (
              <ActivityRow key={e.id} entry={e} />
            ))}
          </ul>
        ) : (
          <Empty>{data?.length ? "No entries match." : "No admin actions yet."}</Empty>
        )}
      </Card>
    </>
  );
}

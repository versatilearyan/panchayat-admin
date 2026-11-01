import { useEffect, useState } from "react";
import { ChevronRight, Search, BadgeCheck } from "lucide-react";
import { adminApi, type UserFilter } from "../api";
import { useAdmin } from "../context";
import { Avatar, Badge, Card, Chips, Empty, ErrorNote, fmtCoins, Loading, PageHeader, StatusBadge, useLoad } from "../components/ui";

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "banned", label: "Banned" },
  { value: "muted", label: "Muted" },
  { value: "warned", label: "Warned" },
  { value: "reported", label: "Reported" },
];

export function UsersPage() {
  const { version, openUser } = useAdmin();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  // Search after a short pause in typing, so the API isn't called on every key
  useEffect(() => {
    const t = window.setTimeout(() => setTerm(q), 250);
    return () => window.clearTimeout(t);
  }, [q]);
  const { data, error, loading } = useLoad(() => adminApi.listUsers(term, filter), [term, filter, version]);

  return (
    <>
      <PageHeader title="Users" sub="Search by name, @handle or user ID. Open someone to see their details and actions." />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-96">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input className="field pl-9" placeholder="Name, @handle or ID (e.g. 208114)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" autoFocus />
        </div>
        <Chips label="Filter users" options={FILTERS} value={filter} onChange={setFilter} />
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Card>
        <div className="hidden grid-cols-[minmax(0,2.2fr)_1fr_0.8fr_1fr_1.3fr_24px] gap-3 border-b border-line px-4 py-2.5 text-[11px] font-bold tracking-wider text-muted uppercase md:grid">
          <span>User</span>
          <span>User ID</span>
          <span>Level</span>
          <span className="text-right">Coins</span>
          <span>Status</span>
          <span />
        </div>
        {loading && !data ? (
          <Loading />
        ) : data?.length ? (
          <ul className="divide-y divide-line">
            {data.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => openUser(u.id)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-cream/[0.03] md:grid-cols-[minmax(0,2.2fr)_1fr_0.8fr_1fr_1.3fr_24px]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="relative">
                      <Avatar name={u.name} color={u.color} photoUrl={u.photoUrl} size={38} />
                      {u.online && !u.ban ? <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-ok ring-2 ring-ink-2" aria-label="Online" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1 truncate text-sm font-semibold">
                        {u.name}
                        {u.official ? <BadgeCheck className="h-4 w-4 shrink-0 text-gold" aria-label="Official" /> : null}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {u.handle}
                        <span className="md:hidden"> · ID {u.uid} · {fmtCoins(u.coins)} coins</span>
                      </span>
                    </span>
                  </span>
                  <span className="hidden font-mono text-[13px] text-cream/85 md:block">{u.uid}</span>
                  <span className="hidden text-sm md:block">
                    Lv.{u.level}
                    {u.vip ? <span className="ml-1.5 text-xs font-bold text-gold">VIP {u.vip}</span> : null}
                  </span>
                  <span className="hidden text-right font-display text-sm font-bold text-gold md:block">{fmtCoins(u.coins)}</span>
                  <span className="flex flex-wrap items-center justify-end gap-1 md:justify-start">
                    <StatusBadge status={u.status} />
                    {u.warnings ? <Badge tone="gold">{u.warnings}× warned</Badge> : null}
                    {u.kicks.length ? <Badge tone="info">Kicked</Badge> : null}
                    {u.openReports ? <Badge tone="coral">{u.openReports} report{u.openReports > 1 ? "s" : ""}</Badge> : null}
                  </span>
                  <ChevronRight className="hidden h-4 w-4 text-muted md:block" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No users match{q ? ` “${q}”` : ""}.</Empty>
        )}
      </Card>
      {data ? <p className="mt-3 text-xs text-muted">{data.length} user{data.length === 1 ? "" : "s"}</p> : null}
    </>
  );
}

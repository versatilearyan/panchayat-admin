import { ArrowRight } from "lucide-react";
import { adminApi } from "../api";
import { useAdmin } from "../context";
import { Avatar, Badge, Button, Card, Empty, ErrorNote, fmtCoins, Loading, PageHeader, StatusBadge, timeAgo, untilText, useLoad } from "../components/ui";
import { ActivityRow } from "./Activity";

export function Overview() {
  const { version, go, openUser, session, can } = useAdmin();
  const stats = useLoad(() => adminApi.stats(), [version]);
  const reports = useLoad(() => adminApi.listReports("open"), [version]);
  const restricted = useLoad(() => adminApi.listUsers("", "all").then((us) => us.filter((u) => u.status !== "active")), [version]);
  const users = useLoad(() => adminApi.listUsers(), [version]);
  const log = useLoad(() => adminApi.listAudit(8), [version]);
  const nameOf = (id: string) => users.data?.find((u) => u.id === id)?.name ?? id;

  const s = stats.data;
  const tiles: [string, string, string?][] = s
    ? [
        ["Users", s.users.toLocaleString("en-IN"), `${s.online} online now`],
        ["Open reports", String(s.openReports), s.openReports ? "Waiting for review" : "All clear"],
        ["Banned", String(s.banned)],
        ["Muted", String(s.muted)],
        ["Coins added (7 days)", fmtCoins(s.coinsGranted7d)],
        ["Actions today", String(s.actionsToday)],
      ].filter(([label]) => can("users.coins") || !label.startsWith("Coins")) as [string, string, string?][]
    : [];

  return (
    <>
      <PageHeader title={`Namaste, ${session.name}`} sub="Here's what needs attention on Panchayat." />
      {stats.error ? <ErrorNote>{stats.error}</ErrorNote> : null}
      {s ? (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {tiles.map(([label, value, sub]) => (
            <div key={label} className="rounded-2xl border border-line bg-ink-2 px-4 py-3.5">
              <p className="text-[11px] font-bold tracking-wider text-muted uppercase">{label}</p>
              <p className={`mt-1 font-display text-[26px] leading-none font-extrabold ${label === "Open reports" && s.openReports ? "text-coral" : label.startsWith("Coins") ? "text-gold" : ""}`}>{value}</p>
              {sub ? <p className="mt-1.5 text-xs text-muted">{sub}</p> : null}
            </div>
          ))}
        </div>
      ) : stats.loading ? (
        <Loading />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Open reports"
          action={
            <Button size="sm" variant="ghost" onClick={() => go("reports")}>
              All reports <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          }
        >
          {reports.data?.length ? (
            <ul className="divide-y divide-line">
              {reports.data.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => openUser(r.userId)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cream/[0.03]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {nameOf(r.userId)} <span className="font-normal text-muted">· {r.reason}</span>
                      </p>
                      <p className="truncate text-xs text-muted">
                        Reported by {nameOf(r.reporterId)} · {timeAgo(r.createdAt)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          ) : reports.loading ? (
            <Loading />
          ) : (
            <Empty>No open reports. 🎉</Empty>
          )}
        </Card>

        <Card title="Banned and muted">
          {restricted.data?.length ? (
            <ul className="divide-y divide-line">
              {restricted.data.map((u) => (
                <li key={u.id}>
                  <button type="button" onClick={() => openUser(u.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cream/[0.03]">
                    <Avatar name={u.name} color={u.color} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{u.name}</p>
                      <p className="truncate text-xs text-muted">
                        {(u.ban ?? u.mute)!.reason} · {untilText((u.ban ?? u.mute)!)}
                      </p>
                    </div>
                    <StatusBadge status={u.status} />
                  </button>
                </li>
              ))}
            </ul>
          ) : restricted.loading ? (
            <Loading />
          ) : (
            <Empty>Nobody is banned or muted.</Empty>
          )}
        </Card>

        <Card
          className="lg:col-span-2"
          title="Recent activity"
          action={
            <Button size="sm" variant="ghost" onClick={() => go("activity")}>
              Full log <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          }
        >
          {log.data?.length ? (
            <ul className="divide-y divide-line">
              {log.data.map((e) => (
                <ActivityRow key={e.id} entry={e} />
              ))}
            </ul>
          ) : log.loading ? (
            <Loading />
          ) : (
            <Empty>
              Nothing yet. Open <button type="button" className="font-semibold text-gold underline-offset-2 hover:underline" onClick={() => go("users")}>Users</button> to get started. <Badge>Logged here</Badge>
            </Empty>
          )}
        </Card>
      </div>
    </>
  );
}

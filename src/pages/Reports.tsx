import { useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { adminApi, type ReportStatus } from "../api";
import { useAdmin } from "../context";
import { Avatar, Badge, Button, Card, Chips, Empty, ErrorNote, Loading, PageHeader, StatusBadge, timeAgo, useLoad } from "../components/ui";

export function ReportsPage() {
  const { version, openUser, changed, toast } = useAdmin();
  const [status, setStatus] = useState<ReportStatus>("open");
  const reports = useLoad(() => adminApi.listReports(status), [status, version]);
  const users = useLoad(() => adminApi.listUsers(), [version]);
  const [busy, setBusy] = useState<string | null>(null);
  const userOf = (id: string) => users.data?.find((u) => u.id === id);

  const decide = async (id: string, next: ReportStatus) => {
    setBusy(id + next);
    try {
      await adminApi.setReportStatus(id, next);
      toast(next === "resolved" ? "Report resolved" : next === "dismissed" ? "Report dismissed" : "Report reopened");
      changed();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Reports" sub="Reports people send from a profile. Review the user, take action, then resolve or dismiss." />
      <div className="mb-4">
        <Chips
          label="Report status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "open", label: "Open" },
            { value: "resolved", label: "Resolved" },
            { value: "dismissed", label: "Dismissed" },
          ]}
        />
      </div>
      {reports.error ? <ErrorNote>{reports.error}</ErrorNote> : null}
      <Card>
        {reports.loading && !reports.data ? (
          <Loading />
        ) : reports.data?.length ? (
          <ul className="divide-y divide-line">
            {reports.data.map((r) => {
              const target = userOf(r.userId);
              return (
                <li key={r.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center">
                  <button type="button" onClick={() => openUser(r.userId)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    {target ? <Avatar name={target.name} color={target.color} size={40} /> : null}
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{target?.name ?? r.userId}</span>
                        <Badge tone="coral">{r.reason}</Badge>
                        {target && target.status !== "active" ? <StatusBadge status={target.status} /> : null}
                      </span>
                      {r.note ? <span className="mt-1 block text-sm text-cream/80">“{r.note}”</span> : null}
                      <span className="mt-1 block text-xs text-muted">
                        From {userOf(r.reporterId)?.name ?? r.reporterId} · {timeAgo(r.createdAt)}
                        {r.handledBy ? ` · ${r.status} by ${r.handledBy}` : ""}
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openUser(r.userId)}>
                      Review user
                    </Button>
                    {r.status === "open" ? (
                      <>
                        <Button size="sm" variant="ok" busy={busy === r.id + "resolved"} onClick={() => decide(r.id, "resolved")}>
                          <Check className="h-3.5 w-3.5" /> Resolve
                        </Button>
                        <Button size="sm" variant="soft" busy={busy === r.id + "dismissed"} onClick={() => decide(r.id, "dismissed")}>
                          <X className="h-3.5 w-3.5" /> Dismiss
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="soft" busy={busy === r.id + "open"} onClick={() => decide(r.id, "open")}>
                        <RotateCcw className="h-3.5 w-3.5" /> Reopen
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No {status} reports.</Empty>
        )}
      </Card>
    </>
  );
}

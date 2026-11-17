import { useCallback, useEffect, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { BACKEND_ENABLED } from "../config/api";
import { apiRequest } from "../lib/api";
import { useAdmin } from "../context";
import { Badge, Button, Card, Chips, Empty, Loading, PageHeader, timeAgo } from "../components/ui";

type Status = "OPEN" | "RESOLVED" | "DISMISSED";
type Report = {
  id: number;
  targetType: "USER" | "MESSAGE" | "ROOM";
  targetRef?: string | null;
  snippet?: string | null;
  reason: string;
  note?: string | null;
  status: Status;
  handledBy?: string | null;
  createdAt: string;
  reporterId: number;
  reporterName?: string | null;
  reporterPublicId?: number | null;
  targetUserId?: number | null;
  targetName?: string | null;
  targetPublicId?: number | null;
  totalAgainst: number;
};

const REASON: Record<string, string> = { SPAM: "Spam", ABUSE: "Abuse", HARASSMENT: "Harassment", NUDITY: "Nudity", HATE: "Hate / violence", SCAM: "Scam", UNDERAGE: "Under 13", OTHER: "Other" };
const WHAT: Record<string, string> = { USER: "a person", MESSAGE: "a chat message", ROOM: "a room" };

/** Reports people send from a profile, a chat message or a room. Review the person (mute / ban from the user page), then resolve or dismiss. */
export function ReportsPage() {
  const { version, openUser, changed, toast } = useAdmin();
  const [status, setStatus] = useState<Status>("OPEN");
  const [rows, setRows] = useState<Report[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => {
    setRows(null);
    apiRequest<Report[]>(`/api/v1/admin/reports?status=${status}`).then(setRows).catch(() => setRows([]));
  }, [status]);
  useEffect(load, [load, version]);

  const decide = async (id: number, next: Status) => {
    setBusy(id + next);
    try {
      await apiRequest(`/api/v1/admin/reports/${id}`, { method: "PATCH", body: { status: next } });
      toast(next === "RESOLVED" ? "Report resolved" : next === "DISMISSED" ? "Report dismissed" : "Report reopened");
      changed();
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(null);
    }
  };

  if (!BACKEND_ENABLED) return <Empty>Reports need the live backend.</Empty>;
  return (
    <>
      <PageHeader title="Reports" sub="Reports people send from a profile, a chat message or a room. Review the person (mute or ban from their user page), then resolve or dismiss." />
      <div className="mb-4">
        <Chips
          label="Report status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "OPEN", label: "Open" },
            { value: "RESOLVED", label: "Resolved" },
            { value: "DISMISSED", label: "Dismissed" },
          ]}
        />
      </div>
      <Card>
        {!rows ? (
          <Loading />
        ) : rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="coral">{REASON[r.reason] ?? r.reason}</Badge>
                    <span className="font-semibold">
                      {r.targetName ?? (r.targetType === "ROOM" ? `Room ${r.targetRef ?? ""}` : "Unknown")}
                      {r.targetPublicId ? <span className="ml-1 text-xs font-normal text-muted">#{r.targetPublicId}</span> : null}
                    </span>
                    <span className="text-xs text-muted">reported as {WHAT[r.targetType]}</span>
                    {r.totalAgainst > 1 ? <Badge tone="muted">{r.totalAgainst} reports against them</Badge> : null}
                  </div>
                  {r.snippet ? <p className="mt-1 rounded-lg bg-ink px-2.5 py-1.5 text-sm text-cream/85">“{r.snippet}”</p> : null}
                  {r.note ? <p className="mt-1 text-sm text-cream/80">Note: {r.note}</p> : null}
                  <p className="mt-1 text-xs text-muted">
                    From {r.reporterName ?? r.reporterId}
                    {r.reporterPublicId ? ` #${r.reporterPublicId}` : ""} · {timeAgo(new Date(r.createdAt).getTime())}
                    {r.handledBy ? ` · ${r.status.toLowerCase()} by ${r.handledBy}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {r.targetUserId ? (
                    <Button size="sm" variant="ghost" onClick={() => openUser(String(r.targetUserId))}>
                      Review user
                    </Button>
                  ) : null}
                  {r.status === "OPEN" ? (
                    <>
                      <Button size="sm" variant="ok" busy={busy === r.id + "RESOLVED"} onClick={() => void decide(r.id, "RESOLVED")}>
                        <Check className="h-3.5 w-3.5" /> Resolve
                      </Button>
                      <Button size="sm" variant="soft" busy={busy === r.id + "DISMISSED"} onClick={() => void decide(r.id, "DISMISSED")}>
                        <X className="h-3.5 w-3.5" /> Dismiss
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="soft" busy={busy === r.id + "OPEN"} onClick={() => void decide(r.id, "OPEN")}>
                      <RotateCcw className="h-3.5 w-3.5" /> Reopen
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No {status.toLowerCase()} reports.</Empty>
        )}
      </Card>
    </>
  );
}

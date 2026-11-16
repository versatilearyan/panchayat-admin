/**
 * Guard, live backend: what removing a Guard right away costs, and the removal requests still waiting or recently refused.
 * (A removal that was accepted, or paid for, leaves no record by design.)
 */
import { useCallback, useEffect, useState } from "react";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorNote, Loading, NumberField, PageHeader, fmtCoins } from "../components/ui";
import { NeedsBackend } from "../components/WalletParts";

type Who = { userId: string; publicId: string; name: string };
type Req = { id: string; status: "PENDING" | "REFUSED"; at: string; answeredAt: string | null; from: Who; to: Who };
type All = { forceDeleteCost: number; requests: Req[] };
const base = "/api/v1/admin/manage/guard";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-");

export function GuardPage() {
  if (!BACKEND_ENABLED) return <NeedsBackend what="Guard" />;
  return <Live />;
}

function Live() {
  const { toast, version } = useAdmin();
  const [data, setData] = useState<All | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await apiRequest<All>(base));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load Guard.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, version]);
  return (
    <>
      <PageHeader title="Guard" sub="People can remove the Guard between them by asking, or right away for coins." />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!data ? (
        <Loading />
      ) : (
        <div className="space-y-5">
          <PriceCard key={data.forceDeleteCost} cost={data.forceDeleteCost} onSaved={setData} toast={toast} />
          <Card title={`Requests (${data.requests.length})`}>
            {!data.requests.length ? (
              <Empty>No request is waiting. Accepted removals leave no record.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {data.requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 flex-1">
                      <b>{r.from.name}</b> <span className="text-muted">ID {r.from.publicId}</span> asked <b>{r.to.name}</b> <span className="text-muted">ID {r.to.publicId}</span>
                    </span>
                    <Badge tone={r.status === "PENDING" ? "muted" : "coral"}>{r.status === "PENDING" ? "Waiting" : "Refused"}</Badge>
                    <span className="w-32 text-right text-xs text-muted">{when(r.answeredAt ?? r.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function PriceCard({ cost, onSaved, toast }: { cost: number; onSaved: (d: All) => void; toast: (t: string, tone?: "ok" | "error") => void }) {
  const [v, setV] = useState<number>(cost);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      onSaved(await apiRequest<All>(base, { method: "PUT", body: { forceDeleteCost: Number.isFinite(v) ? v : 0 } }));
      toast("Saved");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Remove right away">
      <div className="space-y-3 p-4">
        <label className="block text-sm font-semibold">
          Price to remove a Guard without the other person agreeing
          <div className="mt-1 max-w-[260px]">
            <NumberField value={v} onChange={setV} suffix="coins" />
          </div>
          <span className="mt-1 block text-xs font-normal text-muted">Now {fmtCoins(cost)} coins. The coins are spent (nobody receives them). 0 makes it free.</span>
        </label>
        <Button variant="primary" busy={busy} disabled={v === cost} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </Card>
  );
}

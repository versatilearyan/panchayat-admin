/**
 * CP in the admin panel (live backend):
 *  - Ending a CP at once: switch it on and set the price in coins. The person who ends it pays; the partner can't say no.
 *  - Who is whose CP: live and ended couples, with their ring, love and how each one ended.
 */
import { useCallback, useEffect, useState } from "react";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Button, Card, Chips, Empty, ErrorNote, Loading, NumberField, PageHeader, Toggle, fmtCoins } from "../components/ui";
import { NeedsBackend } from "../components/WalletParts";

type Person = { id: string; publicId: number; name: string };
type Couple = {
  id: string;
  a: Person;
  b: Person;
  ring: string | null;
  love: number;
  level: number;
  rings: number;
  since: string | null;
  endedAt: string | null;
  endedHow: "AGREED" | "FORCED" | "ADMIN" | null;
  endedBy: string | null;
  forcePaid: number | null;
  endRequestBy: string | null;
};
type Page = { total: number; page: number; size: number; items: Couple[] };
type Settings = { enabled: boolean; price: number };
const base = "/api/v1/admin/manage/cp";
const SIZE = 30;

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");

export function CpCouplesPage() {
  if (!BACKEND_ENABLED) return <NeedsBackend what="CP couples" />;
  return <Live />;
}

function Live() {
  return (
    <>
      <PageHeader title="CP" sub="Who is whose CP, and the price for ending a CP at once." />
      <EndAtOnce />
      <Couples />
    </>
  );
}

function EndAtOnce() {
  const { toast } = useAdmin();
  const [saved, setSaved] = useState<Settings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [price, setPrice] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<Settings>(`${base}/settings`)
      .then((s) => {
        setSaved(s);
        setEnabled(s.enabled);
        setPrice(s.price);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the setting."));
  }, []);

  const dirty = saved !== null && (saved.enabled !== enabled || saved.price !== (Number.isFinite(price) ? price : 0));
  const save = async () => {
    setBusy(true);
    try {
      const s = await apiRequest<Settings>(`${base}/settings`, { method: "PUT", body: { enabled, price: Number.isFinite(price) ? price : 0 } });
      setSaved(s);
      setEnabled(s.enabled);
      setPrice(s.price);
      setError(null);
      toast("Saved");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="End a CP at once">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!saved && !error ? (
        <Loading />
      ) : (
        <div className="space-y-4 p-4">
          <Toggle checked={enabled} onChange={setEnabled} label="Allow ending a CP at once" hint="Besides asking the partner, a person can pay and end the CP right away. The partner can't refuse. The couple's ring collection is removed too." />
          <label className="block text-sm font-semibold">
            Price (coins)
            <div className="mt-1 max-w-[260px]">
              <NumberField value={price} onChange={setPrice} suffix="coins" />
            </div>
            <span className="mt-1 block text-xs font-normal text-muted">Taken from the person who ends it. Must be above 0 to switch this on.</span>
          </label>
          <Button variant="primary" busy={busy} disabled={!dirty} onClick={() => void save()}>
            Save
          </Button>
        </div>
      )}
    </Card>
  );
}

function Couples() {
  const { toast, version } = useAdmin();
  const [status, setStatus] = useState<"live" | "ended" | "all">("live");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setTerm(q.trim());
      setPage(0);
    }, 350);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ status, page: String(page), size: String(SIZE) });
      if (term) qs.set("q", term);
      setData(await apiRequest<Page>(`${base}/couples?${qs.toString()}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the couples.");
    }
  }, [status, term, page]);
  useEffect(() => {
    void load();
  }, [load, version]);

  const endIt = async (c: Couple) => {
    if (!window.confirm(`End the CP of ${c.a.name} and ${c.b.name}? Their ring collection is removed. This can't be undone.`)) return;
    setEnding(c.id);
    try {
      await apiRequest(`${base}/couples/${encodeURIComponent(c.id)}/end`, { method: "POST" });
      toast("CP ended");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't end it", "error");
    } finally {
      setEnding(null);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const who = (id: string | null, c: Couple) => (id === c.a.id ? c.a.name : id === c.b.id ? c.b.name : null);

  return (
    <Card
      title={data ? `${fmtCoins(data.total)} ${status === "all" ? "couples" : status === "live" ? "live couples" : "ended couples"}` : "Couples"}
      action={<input className="field h-9 w-56" placeholder="Search name or ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search couples" />}
    >
      <div className="px-4 pt-3">
        <Chips
          label="Show"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(0);
          }}
          options={[
            { value: "live", label: "Live" },
            { value: "ended", label: "Ended" },
            { value: "all", label: "All" },
          ]}
        />
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!data ? (
        <Loading />
      ) : !data.items.length ? (
        <Empty>No couples here.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {data.items.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <span className="min-w-0 flex-1 basis-56">
                <span className="block truncate font-semibold">
                  {c.a.name} <span className="text-muted">💞</span> {c.b.name}
                </span>
                <span className="block text-xs text-muted">
                  ID {c.a.publicId} · ID {c.b.publicId}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  {c.ring ? <span>💍 {c.ring}</span> : null}
                  <span>Love {fmtCoins(c.love)} (Lv {c.level})</span>
                  <span>{c.rings} {c.rings === 1 ? "ring" : "rings"} in the box</span>
                  {c.since ? <span>since {date(c.since)}</span> : null}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {c.endedAt ? (
                  <>
                    <Badge tone="muted">Ended {date(c.endedAt)}</Badge>
                    {c.endedHow === "FORCED" ? (
                      <Badge tone="warn">At once{who(c.endedBy, c) ? ` by ${who(c.endedBy, c)}` : ""}{c.forcePaid ? ` · ${fmtCoins(c.forcePaid)} coins` : ""}</Badge>
                    ) : c.endedHow === "ADMIN" ? (
                      <Badge tone="muted">Ended by staff</Badge>
                    ) : c.endedHow === "AGREED" ? (
                      <Badge tone="muted">Both agreed</Badge>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Badge tone="ok">Live</Badge>
                    {c.endRequestBy ? <Badge tone="warn">{who(c.endRequestBy, c) ?? "Someone"} asked to end it</Badge> : null}
                    <Button size="sm" variant="danger" busy={ending === c.id} onClick={() => void endIt(c)}>
                      End CP
                    </Button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {data && pages > 1 ? (
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-muted">
          <Button size="sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
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
  );
}

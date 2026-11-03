/**
 * Super Admin money pages, live from /api/v1/admin/super/…:
 * Revenue (top-ups made in the app and website), Payments, Coin logs and the
 * Audit log of every change staff make through the admin API.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { Badge, Button, Card, Chips, Empty, fmtCoins, Loading, PageHeader } from "../components/ui";
import { NeedsBackend, Pager } from "../components/WalletParts";
import { financeService, type AuditEntry, type CoinLog, type Payment, type RevenueSummary } from "../services/financeService";
import type { Paged } from "../services/rewardService";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const PURPOSE: Record<string, string> = { COIN_PACK: "Coin packs", RED_PACKET: "Red packets", VIP: "VIP" };

function useServer<T>(load: () => Promise<T>, deps: unknown[]) {
  const { version } = useAdmin();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    load()
      .then((d) => live && (setData(d), setError(null)))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't load this."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);
  return { data, error, loading };
}

function Needs({ title, children }: { title: string; children: ReactNode }) {
  if (!BACKEND_ENABLED)
    return (
      <>
        <PageHeader title={title} />
        <NeedsBackend what={title.toLowerCase()} />
      </>
    );
  return <>{children}</>;
}

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="mb-4 rounded-xl bg-[#3a1418] px-3.5 py-2.5 text-sm text-[#ffb0b4]">
      {text}
    </p>
  ) : null;
}

/* ------------------------------------------------------------------ */
/* Revenue                                                              */
/* ------------------------------------------------------------------ */

export function RevenuePage() {
  return (
    <Needs title="Revenue">
      <Revenue />
    </Needs>
  );
}

function Tile({ label, amount, sub }: { label: string; amount: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/60 px-4 py-3.5">
      <p className="text-[11px] font-bold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{amount}</p>
      <p className="mt-0.5 text-xs text-muted">{sub}</p>
    </div>
  );
}

function Revenue() {
  const [days, setDays] = useState(30);
  const { data, error, loading } = useServer<RevenueSummary>(() => financeService.revenue(days), [days]);
  const w = (x: RevenueSummary["today"]) => `${fmtCoins(x.count)} payment${x.count === 1 ? "" : "s"} · ${fmtCoins(x.payers)} payer${x.payers === 1 ? "" : "s"}`;
  return (
    <>
      <PageHeader title="Revenue" sub="Successful top-ups in the app and website (PayU), in rupees. Days are India time." />
      <Problem text={error} />
      {!data ? (
        loading ? (
          <Card>
            <Loading />
          </Card>
        ) : null
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile label="Today" amount={inr(data.today.amount)} sub={w(data.today)} />
            <Tile label="Last 7 days" amount={inr(data.last7Days.amount)} sub={w(data.last7Days)} />
            <Tile label="Last 30 days" amount={inr(data.last30Days.amount)} sub={w(data.last30Days)} />
            <Tile label="This month" amount={inr(data.thisMonth.amount)} sub={w(data.thisMonth)} />
            <Tile label="All time" amount={inr(data.allTime.amount)} sub={`${w(data.allTime)} · avg ${inr(data.allTime.average)}`} />
          </div>

          <Card title="Revenue per day" action={<Chips label="Range" value={days} onChange={setDays} options={[7, 30, 90].map((d) => ({ value: d, label: `${d} days` }))} />}>
            <DailyBars daily={data.daily} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Payments by status">
              <ul className="divide-y divide-line">
                {(["SUCCESS", "PENDING", "FAILED"] as const).map((s) => (
                  <li key={s} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <Badge tone={s === "SUCCESS" ? "ok" : s === "PENDING" ? "warn" : "coral"}>{s === "SUCCESS" ? "Paid" : s === "PENDING" ? "Pending" : "Failed"}</Badge>
                    <span className="font-semibold tabular-nums">{fmtCoins(data.paymentsByStatus[s] ?? 0)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Revenue by product">
              {!data.byPurpose.length ? (
                <Empty>No successful payments yet.</Empty>
              ) : (
                <ul className="divide-y divide-line">
                  {data.byPurpose.map((p) => (
                    <li key={p.purpose} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span>{PURPOSE[p.purpose] ?? p.purpose}</span>
                      <span className="tabular-nums">
                        <b>{inr(p.amount)}</b> <span className="text-muted">· {fmtCoins(p.count)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Top payers">
              {!data.topPayers.length ? (
                <Empty>No payers yet.</Empty>
              ) : (
                <ol className="divide-y divide-line">
                  {data.topPayers.map((t, i) => (
                    <li key={t.userId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className="w-5 text-right font-bold text-muted tabular-nums">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{t.name || `User ${t.userId}`}</span>
                        <span className="block truncate text-xs text-muted">
                          ID {t.userId}
                          {t.email ? ` · ${t.email}` : ""}
                        </span>
                      </span>
                      <span className="text-right tabular-nums">
                        <b>{inr(t.amount)}</b>
                        <span className="block text-xs text-muted">{fmtCoins(t.count)} payments</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Card title="Coins">
              <div className="grid grid-cols-2 gap-3 border-b border-line p-4">
                <div>
                  <p className="text-[11px] font-bold tracking-wide text-muted uppercase">In wallets now</p>
                  <p className="font-display text-xl font-bold tabular-nums">{fmtCoins(data.coins.inWallets)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-wide text-muted uppercase">Sold (with bonus)</p>
                  <p className="font-display text-xl font-bold tabular-nums">{fmtCoins(data.coins.sold)}</p>
                </div>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] tracking-wide text-muted uppercase">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 font-bold">Reason</th>
                    <th className="px-2 py-2 text-right font-bold">Coins</th>
                    <th className="px-4 py-2 text-right font-bold">Times</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.coins.byReason.map((r) => (
                    <tr key={`${r.reason}-${r.type}`}>
                      <td className="px-4 py-2">
                        {r.reason} <span className="text-xs text-muted">{r.type === "CREDIT" ? "in" : "out"}</span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {r.type === "CREDIT" ? "+" : "−"}
                        {fmtCoins(r.coins)}
                      </td>
                      <td className="px-4 py-2 text-right text-muted tabular-nums">{fmtCoins(r.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

/** One series (rupees per day): one hue, thin rounded bars, hover tooltip per bar, no legend. */
function DailyBars({ daily }: { daily: RevenueSummary["daily"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...daily.map((d) => d.amount));
  const total = daily.reduce((s, d) => s + d.amount, 0);
  const label = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const h = hover !== null ? daily[hover] : null;
  const every = Math.ceil(daily.length / 8);
  return (
    <div className="px-4 pt-3 pb-4">
      <p className="mb-2 text-sm text-muted" aria-live="polite">
        {h ? (
          <>
            <b className="text-cream">{label(h.day)}</b> · {inr(h.amount)} · {fmtCoins(h.count)} payment{h.count === 1 ? "" : "s"}
          </>
        ) : (
          <>
            Total <b className="text-cream">{inr(total)}</b> over {daily.length} days. Point at a bar for that day.
          </>
        )}
      </p>
      <div className="relative h-48 border-b border-line-strong" role="img" aria-label={`Revenue per day, ${daily.length} days, total ${inr(total)}`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" />
        <span className="pointer-events-none absolute top-0 right-0 -translate-y-full pb-0.5 text-[10px] text-muted tabular-nums">{inr(max)}</span>
        <div className="flex h-full items-end gap-[2px]">
          {daily.map((d, i) => (
            <button
              key={d.day}
              type="button"
              className="group flex h-full min-w-0 flex-1 items-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${label(d.day)}: ${inr(d.amount)}, ${d.count} payments`}
            >
              <span
                className={`block w-full rounded-t-[4px] transition-colors ${hover === i ? "bg-cream" : "bg-gold/85"}`}
                style={{ height: d.amount > 0 ? `${Math.max(2, (d.amount / max) * 100)}%` : "0" }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 flex gap-[2px] text-[10px] text-muted">
        {daily.map((d, i) => (
          <span key={d.day} className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">
            {i % every === 0 ? label(d.day) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payments                                                             */
/* ------------------------------------------------------------------ */

export function PaymentsPage() {
  return (
    <Needs title="Payments">
      <Payments />
    </Needs>
  );
}

function SearchForm({ placeholder, onSearch, numeric }: { placeholder: string; onSearch: (q: string) => void; numeric?: boolean }) {
  const [v, setV] = useState("");
  return (
    <form
      className="flex gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(v.trim());
      }}
    >
      <input className="field h-9 w-48 py-1" inputMode={numeric ? "numeric" : undefined} placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} aria-label={placeholder} />
      <Button size="sm" type="submit">
        Search
      </Button>
    </form>
  );
}

function Payments() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [purpose, setPurpose] = useState("");
  const [q, setQ] = useState("");
  const { data, error } = useServer<Paged<Payment>>(() => financeService.payments({ page, status, purpose, q }), [page, status, purpose, q]);
  const pages = data ? Math.ceil(data.totalElements / data.size) : 0;
  return (
    <>
      <PageHeader title="Payments" sub="Every top-up attempt, newest first. Search by transaction ID, PayU ID, user ID or email." />
      <Problem text={error} />
      <Card
        title={data ? `${fmtCoins(data.totalElements)} payments` : "Payments"}
        action={
          <SearchForm
            placeholder="Txn, user ID or email"
            onSearch={(v) => {
              setPage(0);
              setQ(v);
            }}
          />
        }
      >
        <div className="flex flex-wrap gap-3 border-b border-line px-4 py-3">
          <Chips
            label="Status"
            value={status}
            onChange={(v) => {
              setPage(0);
              setStatus(v);
            }}
            options={[
              { value: "", label: "All" },
              { value: "SUCCESS", label: "Paid" },
              { value: "PENDING", label: "Pending" },
              { value: "FAILED", label: "Failed" },
            ]}
          />
          <Chips
            label="Product"
            value={purpose}
            onChange={(v) => {
              setPage(0);
              setPurpose(v);
            }}
            options={[{ value: "", label: "All products" }, ...Object.entries(PURPOSE).map(([value, label]) => ({ value, label }))]}
          />
        </div>
        {!data ? (
          <Loading />
        ) : !data.content.length ? (
          <Empty>No payments match.</Empty>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-[11px] tracking-wide text-muted uppercase">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-bold">When</th>
                  <th className="px-2 py-2 font-bold">User</th>
                  <th className="px-2 py-2 font-bold">Product</th>
                  <th className="px-2 py-2 text-right font-bold">Amount</th>
                  <th className="px-2 py-2 text-right font-bold">Coins</th>
                  <th className="px-2 py-2 font-bold">Status</th>
                  <th className="px-4 py-2 font-bold">Transaction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.content.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-muted">{when(p.createdAt)}</td>
                    <td className="px-2 py-2">
                      <span className="block font-semibold">{p.userName || `User ${p.userId}`}</span>
                      <span className="block text-xs text-muted">ID {p.userId}</span>
                    </td>
                    <td className="px-2 py-2">{PURPOSE[p.purpose] ?? p.purpose}</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums">{inr(p.amount)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.coins !== null ? fmtCoins((p.coins ?? 0) + (p.bonusCoins ?? 0)) : "—"}</td>
                    <td className="px-2 py-2">
                      <Badge tone={p.status === "SUCCESS" ? "ok" : p.status === "PENDING" ? "warn" : "coral"}>{p.status === "SUCCESS" ? "Paid" : p.status === "PENDING" ? "Pending" : "Failed"}</Badge>
                      {p.failureReason ? <span className="mt-0.5 block max-w-[200px] truncate text-xs text-muted" title={p.failureReason}>{p.failureReason}</span> : null}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {p.txnId}
                      {p.payuPaymentId ? <span className="block text-muted">PayU {p.payuPaymentId}{p.paymentMode ? ` · ${p.paymentMode}` : ""}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data ? <Pager page={page} pages={pages} total={data.totalElements} onPage={setPage} /> : null}
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Coin logs                                                            */
/* ------------------------------------------------------------------ */

export function CoinLogsPage() {
  return (
    <Needs title="Coin logs">
      <CoinLogs />
    </Needs>
  );
}

function CoinLogs() {
  const [page, setPage] = useState(0);
  const [reason, setReason] = useState("");
  const [type, setType] = useState("");
  const [userId, setUserId] = useState("");
  const reasons = useServer<string[]>(() => financeService.coinReasons(), []);
  const { data, error } = useServer<Paged<CoinLog>>(() => financeService.coinLogs({ page, reason, type, userId }), [page, reason, type, userId]);
  const pages = data ? Math.ceil(data.totalElements / data.size) : 0;
  const reasonOptions = useMemo(() => [{ value: "", label: "All reasons" }, ...(reasons.data ?? []).map((r) => ({ value: r, label: r }))], [reasons.data]);
  return (
    <>
      <PageHeader title="Coin logs" sub="Every coin added to or taken from a wallet: purchases, gifts sent and earned, admin changes." />
      <Problem text={error} />
      <Card
        title={data ? `${fmtCoins(data.totalElements)} entries` : "Coin logs"}
        action={
          <SearchForm
            numeric
            placeholder="User ID"
            onSearch={(v) => {
              setPage(0);
              setUserId(/^\d+$/.test(v) ? v : "");
            }}
          />
        }
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <Chips
            label="Direction"
            value={type}
            onChange={(v) => {
              setPage(0);
              setType(v);
            }}
            options={[
              { value: "", label: "In and out" },
              { value: "CREDIT", label: "In" },
              { value: "DEBIT", label: "Out" },
            ]}
          />
          <select
            className="field h-8 w-auto py-0 text-xs"
            value={reason}
            aria-label="Reason"
            onChange={(e) => {
              setPage(0);
              setReason(e.target.value);
            }}
          >
            {reasonOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {!data ? (
          <Loading />
        ) : !data.content.length ? (
          <Empty>No coin movements match.</Empty>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-[11px] tracking-wide text-muted uppercase">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-bold">When</th>
                  <th className="px-2 py-2 font-bold">User</th>
                  <th className="px-2 py-2 font-bold">Reason</th>
                  <th className="px-2 py-2 text-right font-bold">Coins</th>
                  <th className="px-2 py-2 text-right font-bold">Balance after</th>
                  <th className="px-4 py-2 font-bold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.content.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-muted">{when(t.createdAt)}</td>
                    <td className="px-2 py-2">
                      <span className="block font-semibold">{t.userName || `User ${t.userId}`}</span>
                      <span className="block text-xs text-muted">ID {t.userId}</span>
                    </td>
                    <td className="px-2 py-2">{t.reason}</td>
                    <td className={`px-2 py-2 text-right font-semibold tabular-nums ${t.type === "CREDIT" ? "text-ok" : "text-[#ff9095]"}`}>
                      {t.type === "CREDIT" ? "+" : "−"}
                      {fmtCoins(t.amount)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtCoins(t.balanceAfter)}</td>
                    <td className="max-w-[260px] px-4 py-2 text-xs text-muted">
                      <span className="block truncate" title={t.description ?? ""}>
                        {t.description || "—"}
                      </span>
                      {t.referenceId ? <span className="block truncate font-mono">{t.referenceId}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data ? <Pager page={page} pages={pages} total={data.totalElements} onPage={setPage} /> : null}
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Audit log                                                            */
/* ------------------------------------------------------------------ */

export function AuditLogPage() {
  return (
    <Needs title="Audit log">
      <Audit />
    </Needs>
  );
}

/** Turns "/api/v1/admin/manage/gifts/dragon/image" into words staff can read. */
function describe(e: AuditEntry) {
  const p = e.path.replace(/^\/api\/(v1\/)?admin\//, "");
  const verb = { POST: "Added / did", PATCH: "Changed", PUT: "Set", DELETE: "Deleted" }[e.method] ?? e.method;
  if (p === "auth/login") return "Signed in";
  return `${verb} · ${p}`;
}

function Audit() {
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [method, setMethod] = useState("");
  const { data, error } = useServer<Paged<AuditEntry>>(() => financeService.audit({ page, q, method }), [page, q, method]);
  const pages = data ? Math.ceil(data.totalElements / data.size) : 0;
  return (
    <>
      <PageHeader title="Audit log" sub="Every change staff made through the admin panel: who, their role, what, the result and from which IP." />
      <Problem text={error} />
      <Card
        title={data ? `${fmtCoins(data.totalElements)} actions` : "Audit log"}
        action={
          <SearchForm
            placeholder="Staff name or path"
            onSearch={(v) => {
              setPage(0);
              setQ(v);
            }}
          />
        }
      >
        <div className="border-b border-line px-4 py-3">
          <Chips
            label="Action"
            value={method}
            onChange={(v) => {
              setPage(0);
              setMethod(v);
            }}
            options={[
              { value: "", label: "All" },
              { value: "POST", label: "Add" },
              { value: "PATCH", label: "Change" },
              { value: "PUT", label: "Set" },
              { value: "DELETE", label: "Delete" },
            ]}
          />
        </div>
        {!data ? (
          <Loading />
        ) : !data.content.length ? (
          <Empty>Nothing logged yet.</Empty>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-[11px] tracking-wide text-muted uppercase">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-bold">When</th>
                  <th className="px-2 py-2 font-bold">Staff</th>
                  <th className="px-2 py-2 font-bold">What</th>
                  <th className="px-2 py-2 font-bold">Result</th>
                  <th className="px-4 py-2 font-bold">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.content.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-muted">{when(e.createdAt)}</td>
                    <td className="px-2 py-2">
                      <span className="block font-semibold">{e.admin ?? "—"}</span>
                      <span className="block text-xs text-muted">{e.role ? e.role.replace("_", " ").toLowerCase() : "not signed in"}</span>
                    </td>
                    <td className="px-2 py-2 font-mono text-xs break-all">{describe(e)}</td>
                    <td className="px-2 py-2">
                      <Badge tone={e.status < 300 ? "ok" : e.status < 500 ? "warn" : "coral"}>{e.status < 300 ? "Done" : e.status === 403 ? "Refused" : `Error ${e.status}`}</Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted">{e.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data ? <Pager page={page} pages={pages} total={data.totalElements} onPage={setPage} /> : null}
      </Card>
    </>
  );
}

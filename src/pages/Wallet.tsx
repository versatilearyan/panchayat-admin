/**
 * Wallet Management, live from the backend (/api/v1/admin/wallets/{userId}/...).
 *
 * Staff open a wallet by user ID, credit or debit coins, and page through the history.
 * The backend checks the role and applies every change; the panel only shows what the
 * server replied. Each credit or debit carries one idempotency key per logical request:
 * if the reply never arrives, the form locks and offers a retry with that same key, so
 * the same adjustment can't be applied twice by retrying.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, History, RotateCcw, Search, Wallet } from "lucide-react";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { ApiError } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorNote, fmtCoins, fmtDate, Loading, PageHeader } from "../components/ui";
import { ConfirmDialog, Field, NeedsBackend, wholeNumber } from "../components/WalletParts";
import { readUserId } from "../lib/userId";
import {
  adminWalletService,
  newIdempotencyKey,
  outcomeUnknown,
  type WalletAdjustment,
  type WalletAdjustmentResult,
  type WalletDetails,
  type WalletTransactionPage,
} from "../services/adminWalletService";

type Kind = "credit" | "debit";

const PAGE_SIZE = 20;
const REASONS: Record<Kind, string[]> = {
  credit: ["ADMIN_GRANT", "ADMIN_ADJUSTMENT"],
  debit: ["ADMIN_ADJUSTMENT"],
};

const coins = (n?: number) => (n === undefined ? "—" : fmtCoins(n));
const when = (at?: string) => {
  const t = at ? Date.parse(at) : NaN;
  return Number.isFinite(t) ? fmtDate(t) : (at ?? "—");
};

export function WalletPage() {
  if (!BACKEND_ENABLED)
    return (
      <>
        <PageHeader title="Wallet Management" sub="Credit or debit a user's coins and see their wallet history." />
        <NeedsBackend what="wallets" />
      </>
    );
  return <WalletLive />;
}

function WalletLive() {
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [locked, setLocked] = useState<Record<Kind, boolean>>({ credit: false, debit: false });
  const anyLocked = locked.credit || locked.debit;

  const open = (e: FormEvent) => {
    e.preventDefault();
    if (anyLocked) return;
    const id = readUserId(typed);
    if (typeof id !== "number") return setTypedError(id.error);
    setTypedError(null);
    setUserId(id);
    setRefresh((n) => n + 1);
  };
  const setLock = useCallback((kind: Kind, on: boolean) => setLocked((l) => (l[kind] === on ? l : { ...l, [kind]: on })), []);
  const reload = useCallback(() => setRefresh((n) => n + 1), []);

  return (
    <>
      <PageHeader title="Wallet Management" sub="Live from the server. Credit or debit a user's coins and check their wallet history." />

      <Card className="mb-4">
        <form onSubmit={open} className="flex flex-wrap items-end gap-3 p-4" noValidate>
          <div className="min-w-[220px] flex-1">
            <Field id="wallet-user" label="User ID" error={typedError} hint="The user's ID as shown in the app (like 4228012), or the internal ID.">
              <input
                id="wallet-user"
                className="field font-mono"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="e.g. 42"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                disabled={anyLocked}
                aria-invalid={Boolean(typedError)}
                aria-describedby={typedError ? "wallet-user-err" : undefined}
              />
            </Field>
          </div>
          <Button type="submit" variant="primary" disabled={anyLocked}>
            <Search className="h-4 w-4" /> Open wallet
          </Button>
        </form>
        {anyLocked ? (
          <p className="border-t border-line px-4 py-2.5 text-xs text-warn">Finish or resolve the request with an unknown outcome below before opening another wallet.</p>
        ) : null}
      </Card>

      {userId ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <Wallet className="h-4 w-4 text-gold" aria-hidden />
            <span className="text-muted">Wallet of user</span>
            <code className="rounded bg-cream/10 px-1.5 py-0.5 font-mono text-cream" data-testid="active-user">
              {userId}
            </code>
          </div>
          <DetailsCard key={`d-${userId}`} userId={userId} refresh={refresh} />
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <AdjustCard key={`credit-${userId}`} kind="credit" userId={userId} onDone={reload} onLock={setLock} />
            <AdjustCard key={`debit-${userId}`} kind="debit" userId={userId} onDone={reload} onLock={setLock} />
          </div>
          <HistoryCard key={userId} userId={userId} refresh={refresh} />
        </>
      ) : (
        <Card>
          <Empty>Enter a user ID to credit, debit or check their wallet.</Empty>
        </Card>
      )}
    </>
  );
}

/* ---------- wallet details ---------- */

const pretty = (r: string) => r.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function DetailsCard({ userId, refresh }: { userId: number; refresh: number }) {
  const [data, setData] = useState<WalletDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    adminWalletService
      .details(userId)
      .then((d) => {
        if (live) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : "Couldn't load the wallet.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [userId, refresh]);

  if (error)
    return (
      <div className="mb-4">
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  if (!data)
    return (
      <Card className="mb-4">
        <Loading />
      </Card>
    );
  const stat = (label: string, value: string, tone = "text-cream") => (
    <div className="rounded-lg border border-line bg-cream/5 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-0.5 font-mono text-lg font-semibold ${tone}`}>{value}</div>
    </div>
  );
  return (
    <Card className={`mb-4 ${loading ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        {data.avatarUrl ? (
          <img src={data.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-full bg-cream/10 text-lg font-semibold text-cream">{(data.name ?? "?").slice(0, 1).toUpperCase()}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-cream">{data.name ?? "—"}</span>
            {data.vipActive ? <Badge tone="gold">VIP {data.vipLevel ?? ""}</Badge> : <Badge>No VIP</Badge>}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            ID <span className="font-mono">{data.publicId ?? "—"}</span> · internal <span className="font-mono">{data.userId ?? "—"}</span>
            {data.email ? <> · {data.email}</> : null}
            {data.joinedAt ? <> · joined {when(data.joinedAt)}</> : null}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-muted">Balance</div>
          <div className="font-mono text-2xl font-bold text-gold" data-testid="wallet-balance">
            {coins(data.balance)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        {stat("Coins in (all time)", coins(data.totalIn), "text-ok")}
        {stat("Coins out (all time)", coins(data.totalOut), "text-coral")}
        {stat("Paid (₹)", data.rupeesPaid === undefined ? "—" : `₹${data.rupeesPaid.toLocaleString("en-IN")}`)}
        {stat("Charm", coins(data.charmPoints))}
      </div>
      {data.byReason.length ? (
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="py-1.5 pr-3 font-medium">Where coins came from / went</th>
                <th className="py-1.5 pr-3 font-medium">Type</th>
                <th className="py-1.5 pr-3 text-right font-medium">Times</th>
                <th className="py-1.5 text-right font-medium">Coins</th>
              </tr>
            </thead>
            <tbody>
              {data.byReason.map((r) => (
                <tr key={`${r.reason}-${r.type}`} className="border-t border-line">
                  <td className="py-1.5 pr-3 text-cream">{pretty(r.reason)}</td>
                  <td className="py-1.5 pr-3">{r.type === "CREDIT" ? <Badge tone="ok">In</Badge> : <Badge tone="coral">Out</Badge>}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-muted">{r.count.toLocaleString("en-IN")}</td>
                  <td className={`py-1.5 text-right font-mono ${r.type === "CREDIT" ? "text-ok" : "text-coral"}`}>
                    {r.type === "CREDIT" ? "+" : "−"}
                    {fmtCoins(r.coins)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.lastActivityAt ? <p className="mt-2 text-xs text-muted">Last coin activity {when(data.lastActivityAt)}</p> : null}
        </div>
      ) : (
        <p className="px-4 pb-4 text-xs text-muted">No coin activity yet.</p>
      )}
    </Card>
  );
}

/* ---------- credit / debit ---------- */

type Pending = { key: string; fingerprint: string; body: WalletAdjustment };
type Unknown = { pending: Pending; message: string };

function AdjustCard({ kind, userId, onDone, onLock }: { kind: Kind; userId: number; onDone: () => void; onLock: (kind: Kind, on: boolean) => void }) {
  const { toast } = useAdmin();
  const credit = kind === "credit";
  const verb = credit ? "Credit" : "Debit";
  const id = (f: string) => `${kind}-${f}`;

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState(REASONS[kind][0]);
  const [referenceId, setReferenceId] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"amount" | "reason", string>>>({});

  const [confirm, setConfirm] = useState<WalletAdjustment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unknown, setUnknown] = useState<Unknown | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [result, setResult] = useState<(WalletAdjustmentResult & { requested: number }) | null>(null);
  // Blocks a second send while one is in flight, even before React re-renders
  const inFlight = useRef(false);

  useEffect(() => onLock(kind, Boolean(unknown)), [kind, unknown, onLock]);
  useEffect(() => () => onLock(kind, false), [kind, onLock]);

  const review = (e: FormEvent) => {
    e.preventDefault();
    if (unknown) return;
    const next: typeof errors = {};
    const n = wholeNumber(amount, { min: 1, name: "the amount" });
    if (typeof n !== "number") next.amount = n ?? "Enter the amount.";
    const r = reason.trim().toUpperCase();
    if (!r) next.reason = "Pick or type a reason.";
    else if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(r)) next.reason = "Use capital letters, digits and underscores, like ADMIN_GRANT.";
    setErrors(next);
    if (Object.keys(next).length || typeof n !== "number") return;
    setError(null);
    setConfirm({
      amount: n,
      reason: r,
      referenceId: referenceId.trim() || undefined,
      description: description.trim() || undefined,
      // Filled in at send time: a fresh key, or the earlier one for a retry
      idempotencyKey: "",
    });
  };

  /** Sends one logical request. A retry passes the earlier Pending, so the same key goes again. */
  const send = async (fields: WalletAdjustment, retryOf?: Pending) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const fingerprint = JSON.stringify([userId, kind, fields.amount, fields.reason, fields.referenceId ?? null, fields.description ?? null]);
    const pending: Pending = retryOf && retryOf.fingerprint === fingerprint ? retryOf : { key: newIdempotencyKey(), fingerprint, body: fields };
    const body: WalletAdjustment = { ...fields, idempotencyKey: pending.key };
    setBusy(true);
    setError(null);
    try {
      const res = await (credit ? adminWalletService.credit(userId, body) : adminWalletService.debit(userId, body));
      setResult({ ...res, requested: body.amount });
      setUnknown(null);
      setConfirm(null);
      setAmount("");
      setReferenceId("");
      setDescription("");
      toast(`${credit ? "Credited" : "Debited"} ${fmtCoins(body.amount)} coins`);
      onDone();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      if (outcomeUnknown(e)) {
        // It may have gone through. Keep the key and lock the form until it's resolved.
        setUnknown({ pending, message });
        setConfirm(null);
      } else {
        // The server answered no: nothing changed, so a later attempt is a new request
        setUnknown(null);
        if (e instanceof ApiError && e.kind === "unauthorized") setConfirm(null);
        else setError(message);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const locked = Boolean(unknown) || busy;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {credit ? <ArrowUpCircle className="h-4 w-4 text-ok" aria-hidden /> : <ArrowDownCircle className="h-4 w-4 text-[#ff9095]" aria-hidden />}
          {verb} coins
        </span>
      }
    >
      <form onSubmit={review} className="space-y-3 p-4" noValidate aria-label={`${verb} coins`}>
        <Field id={id("amount")} label="Amount (coins)" error={errors.amount}>
          <input
            id={id("amount")}
            className="field"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 500"
            disabled={locked}
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={errors.amount ? `${id("amount")}-err` : undefined}
          />
        </Field>
        <Field id={id("reason")} label="Reason" error={errors.reason} hint={credit ? "ADMIN_GRANT for a gift of coins, ADMIN_ADJUSTMENT for a correction." : "ADMIN_ADJUSTMENT for a correction."}>
          <input
            id={id("reason")}
            className="field font-mono uppercase"
            list={id("reasons")}
            value={reason}
            onChange={(e) => setReason(e.target.value.toUpperCase())}
            disabled={locked}
            maxLength={64}
            aria-invalid={Boolean(errors.reason)}
            aria-describedby={errors.reason ? `${id("reason")}-err` : undefined}
          />
          <datalist id={id("reasons")}>
            {REASONS[kind].map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>
        <Field id={id("ref")} label="Reference ID (optional)" hint="A ticket or order number, so the change can be traced.">
          <input id={id("ref")} className="field font-mono" value={referenceId} onChange={(e) => setReferenceId(e.target.value)} maxLength={255} disabled={locked} autoComplete="off" />
        </Field>
        <Field id={id("desc")} label="Description (optional)">
          <textarea id={id("desc")} className="field min-h-[64px] py-2" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} disabled={locked} />
        </Field>

        {unknown ? (
          <div role="alert" className="space-y-2.5 rounded-xl bg-warn/10 px-3.5 py-3 text-sm text-warn ring-1 ring-warn/30">
            <p className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              We don't know if this {kind} went through.
            </p>
            <p className="text-cream/80">
              {unknown.message} The server may still have applied it. Check the history below first. Retrying sends the same request with the same idempotency key, so the server won't apply it twice.
            </p>
            <p className="font-mono text-[11px] text-muted">Key {unknown.pending.key}</p>
            {discarding ? (
              <div className="space-y-2 rounded-lg bg-ink-2 p-2.5 text-cream/85">
                <p>Only discard it if the history shows this {kind} or you're sure it didn't happen. A new request gets a new key and could {credit ? "credit" : "debit"} the coins again.</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setDiscarding(false)}>
                    Keep it
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setUnknown(null);
                      setDiscarding(false);
                    }}
                  >
                    Discard and unlock
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="gold" busy={busy} onClick={() => send(unknown.pending.body, unknown.pending)}>
                  <RotateCcw className="h-3.5 w-3.5" /> Retry with the same key
                </Button>
                <Button size="sm" variant="ghost" onClick={onDone} disabled={busy}>
                  <History className="h-3.5 w-3.5" /> Refresh history
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDiscarding(true)} disabled={busy}>
                  Discard
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Button type="submit" variant={credit ? "ok" : "danger"} className="w-full" disabled={busy}>
            {verb} coins
          </Button>
        )}

        {result ? (
          <div className="rounded-xl bg-cream/[0.05] px-3.5 py-3 text-sm" data-testid={`${kind}-result`}>
            <p className="font-semibold text-cream">
              {credit ? "Credited" : "Debited"} {coins(result.amount ?? result.requested)} coins
            </p>
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
              <dt className="text-muted">Transaction</dt>
              <dd className="break-all font-mono text-cream/85">{result.transactionId ?? "— (not in the server's reply)"}</dd>
              <dt className="text-muted">Balance</dt>
              <dd className="text-cream/85">
                {coins(result.balanceBefore)} → <span className="font-semibold text-cream">{coins(result.balanceAfter)}</span>
              </dd>
            </dl>
          </div>
        ) : null}
      </form>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={`${verb} ${confirm ? fmtCoins(confirm.amount) : ""} coins?`}
        confirmLabel={`${verb} ${confirm ? fmtCoins(confirm.amount) : ""} coins`}
        confirmVariant={credit ? "ok" : "danger"}
        busy={busy}
        error={error}
        onClose={() => {
          setConfirm(null);
          setError(null);
        }}
        onConfirm={() => confirm && send(confirm)}
      >
        {confirm ? (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted">User ID</dt>
              <dd className="break-all font-mono">{userId}</dd>
              <dt className="text-muted">Amount</dt>
              <dd className="font-semibold">{fmtCoins(confirm.amount)} coins</dd>
              <dt className="text-muted">Reason</dt>
              <dd className="font-mono">{confirm.reason}</dd>
              {confirm.referenceId ? (
                <>
                  <dt className="text-muted">Reference</dt>
                  <dd className="break-all font-mono">{confirm.referenceId}</dd>
                </>
              ) : null}
              {confirm.description ? (
                <>
                  <dt className="text-muted">Description</dt>
                  <dd className="break-words">{confirm.description}</dd>
                </>
              ) : null}
            </dl>
            <p className={credit ? "text-muted" : "text-[#ffb0b4]"}>
              {credit ? "These coins are added to the user's wallet right away." : "This takes coins out of the user's wallet. The server refuses it if their balance is too low."}
            </p>
          </>
        ) : null}
      </ConfirmDialog>
    </Card>
  );
}

/* ---------- history ---------- */

function HistoryCard({ userId, refresh }: { userId: number; refresh: number }) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<WalletTransactionPage | null>(null);
  const [error, setError] = useState<{ message: string; kind: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  // A change from the forms shows the newest page again
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPage(0);
  }, [refresh]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    adminWalletService
      .transactions(userId, page, PAGE_SIZE)
      .then((d) => {
        if (!live) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => live && setError({ message: e instanceof Error ? e.message : "Something went wrong.", kind: e instanceof ApiError ? e.kind : "unknown" }))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [userId, page, refresh, retry]);

  const rows = data?.transactions ?? [];
  const current = data?.currentPage ?? page;

  return (
    <Card
      title="Transaction history"
      action={
        <Button size="sm" variant="ghost" onClick={() => setRetry((n) => n + 1)} busy={loading} aria-label="Refresh history">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      }
    >
      {error ? (
        <div className="p-4">
          <ErrorNote>{error.message}</ErrorNote>
          {error.kind !== "forbidden" && error.kind !== "not_found" ? (
            <Button size="sm" variant="danger" className="mt-3" onClick={() => setRetry((n) => n + 1)}>
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          ) : null}
        </div>
      ) : !data && loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>{current === 0 ? "No wallet transactions for this user yet." : "No transactions on this page."}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-semibold">When</th>
                <th className="px-3 py-2.5 font-semibold">Type</th>
                <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-3 py-2.5 text-right font-semibold">Before</th>
                <th className="px-3 py-2.5 text-right font-semibold">After</th>
                <th className="px-3 py-2.5 font-semibold">Reason</th>
                <th className="px-3 py-2.5 font-semibold">Reference</th>
                <th className="px-3 py-2.5 font-semibold">Description</th>
                <th className="px-4 py-2.5 font-semibold">Transaction ID</th>
              </tr>
            </thead>
            <tbody className={loading ? "opacity-60" : undefined}>
              {rows.map((t) => {
                const isCredit = t.transactionType === "CREDIT";
                const isDebit = t.transactionType === "DEBIT";
                return (
                  <tr key={t.transactionId} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-cream/85">{when(t.createdAt)}</td>
                    <td className="px-3 py-2.5">{isCredit ? <Badge tone="ok">Credit</Badge> : isDebit ? <Badge tone="coral">Debit</Badge> : <Badge>{t.transactionType || "—"}</Badge>}</td>
                    <td className={`whitespace-nowrap px-3 py-2.5 text-right font-semibold ${isCredit ? "text-ok" : isDebit ? "text-[#ff9095]" : ""}`}>
                      {t.amount === undefined ? "—" : `${isCredit ? "+" : isDebit ? "−" : ""}${fmtCoins(Math.abs(t.amount))}`}
                    </td>
                    <td className="px-3 py-2.5 text-right text-cream/75">{coins(t.balanceBefore)}</td>
                    <td className="px-3 py-2.5 text-right text-cream">{coins(t.balanceAfter)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{t.reason ?? "—"}</td>
                    <td className="max-w-[160px] truncate px-3 py-2.5 font-mono text-xs" title={t.referenceId}>
                      {t.referenceId ?? "—"}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2.5 text-cream/80" title={t.description}>
                      {t.description ?? "—"}
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-2.5 font-mono text-xs text-muted" title={t.transactionId}>
                      {t.transactionId}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && !error && (current > 0 || data.hasNext) ? (
        <nav aria-label="History pages" className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-muted">
          <span>
            Page {current + 1}
            {data.totalPages !== undefined ? ` of ${Math.max(1, data.totalPages)}` : ""}
            {data.totalElements !== undefined ? ` · ${fmtCoins(data.totalElements)} total` : ""}
          </span>
          <span className="flex gap-1.5">
            <Button size="sm" variant="ghost" disabled={current === 0 || loading} onClick={() => setPage(current - 1)} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" disabled={!data.hasNext || loading} onClick={() => setPage(current + 1)} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </span>
        </nav>
      ) : data && !error && data.totalElements !== undefined && rows.length > 0 ? (
        <p className="border-t border-line px-4 py-2.5 text-xs text-muted">{fmtCoins(data.totalElements)} total</p>
      ) : null}
    </Card>
  );
}

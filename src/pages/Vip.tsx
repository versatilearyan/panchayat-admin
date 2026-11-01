/**
 * VIP Management, live from the backend (/api/v1/admin/vip/users/{userId}). Super Admins only.
 *
 * Staff look up a user by numeric ID, then grant, extend or revoke VIP and credit or debit
 * VIP points. Every change asks for confirmation, sends one request at a time, and then
 * reloads the user's status from the server. Expiry dates and balances always come from
 * the server; the panel never works them out.
 */
import { useCallback, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, CalendarPlus, Crown, MinusCircle, PlusCircle, RotateCcw, Search, ShieldOff, Sparkles } from "lucide-react";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { ApiError } from "../lib/api";
import { readUserId } from "../lib/userId";
import { Badge, Button, Card, Empty, ErrorNote, fmtCoins, fmtDate, Loading, PageHeader } from "../components/ui";
import { ConfirmDialog, Field, NeedsBackend, wholeNumber } from "../components/WalletParts";
import { adminVipService, vipOutcomeUnknown, type VipStatus } from "../services/adminVipService";

type Op = "grant" | "extend" | "revoke" | "credit" | "debit";
type Pending = { op: Op; value?: number };

const OP: Record<Op, { title: string; done: string; field?: "days" | "points"; variant: "ok" | "gold" | "danger" | "primary" }> = {
  grant: { title: "Grant VIP", done: "VIP granted", field: "days", variant: "gold" },
  extend: { title: "Extend VIP", done: "VIP extended", field: "days", variant: "gold" },
  revoke: { title: "Revoke VIP", done: "VIP revoked", variant: "danger" },
  credit: { title: "Credit VIP points", done: "VIP points credited", field: "points", variant: "ok" },
  debit: { title: "Debit VIP points", done: "VIP points debited", field: "points", variant: "danger" },
};

const time = (at?: string) => {
  const t = at ? Date.parse(at) : NaN;
  return Number.isFinite(t) ? fmtDate(t) : at;
};
const isPast = (at?: string) => {
  const t = at ? Date.parse(at) : NaN;
  return Number.isFinite(t) && t <= Date.now();
};

export function VipPage() {
  if (!BACKEND_ENABLED)
    return (
      <>
        <PageHeader title="VIP Management" sub="Grant, extend or revoke VIP and manage VIP points." />
        <NeedsBackend what="VIP" />
      </>
    );
  return <VipLive />;
}

type Load = { data: VipStatus | null; loading: boolean; error: { message: string; kind: string } | null };

function VipLive() {
  const { toast } = useAdmin();
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [status, setStatus] = useState<Load>({ data: null, loading: false, error: null });
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  // Bumped after each success so the forms start empty again
  const [round, setRound] = useState(0);
  const inFlight = useRef(false);
  const loadSeq = useRef(0);

  const load = useCallback(async (id: number) => {
    const seq = ++loadSeq.current;
    setStatus((s) => ({ data: s.data && String(s.data.userId) === String(id) ? s.data : null, loading: true, error: null }));
    try {
      const data = await adminVipService.get(id);
      if (seq === loadSeq.current) setStatus({ data, loading: false, error: null });
    } catch (e) {
      if (seq === loadSeq.current) setStatus({ data: null, loading: false, error: { message: e instanceof Error ? e.message : "Something went wrong.", kind: e instanceof ApiError ? e.kind : "unknown" } });
    }
  }, []);

  const view = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const id = readUserId(typed);
    if (typeof id !== "number") return setTypedError(id.error);
    setTypedError(null);
    setNotice(null);
    setUserId(id);
    void load(id);
  };

  const ask = (p: Pending) => {
    setDialogError(null);
    setPending(p);
  };

  const run = async () => {
    if (!pending || userId === null || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setDialogError(null);
    const { op, value } = pending;
    try {
      const res =
        op === "grant"
          ? await adminVipService.grant(userId, value!)
          : op === "extend"
            ? await adminVipService.extend(userId, value!)
            : op === "revoke"
              ? await adminVipService.revoke(userId)
              : op === "credit"
                ? await adminVipService.creditPoints(userId, value!)
                : await adminVipService.debitPoints(userId, value!);
      setPending(null);
      setRound((n) => n + 1);
      toast(OP[op].done);
      setNotice({ tone: "ok", text: res?.message ? `${OP[op].done}. The server said: ${res.message}` : `${OP[op].done} for user ${userId}.` });
      // Show what the server says now, not a value worked out here
      await load(userId);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      if (e instanceof ApiError && e.kind === "unauthorized") setPending(null);
      else if (vipOutcomeUnknown(e)) {
        setPending(null);
        setNotice({ tone: "warn", text: `We don't know if "${OP[op].title}" went through: ${message} The status below was reloaded from the server. Check it before trying again, so the change isn't applied twice.` });
        await load(userId);
      } else setDialogError(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const s = status.data;
  const ready = userId !== null && s !== null && !status.error;

  return (
    <>
      <PageHeader title="VIP Management" sub="Live from the server. Look up a user's VIP, grant, extend or revoke it, and manage their VIP points." />

      <Card className="mb-4">
        <form onSubmit={view} className="flex flex-wrap items-end gap-3 p-4" noValidate>
          <div className="min-w-[220px] flex-1">
            <Field id="vip-user" label="User ID" error={typedError} hint="The user's numeric ID from the backend, like 42. Not a username. There's no user search here yet.">
              <input
                id="vip-user"
                className="field font-mono"
                inputMode="numeric"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="e.g. 42"
                autoComplete="off"
                spellCheck={false}
                disabled={busy}
                aria-invalid={Boolean(typedError)}
                aria-describedby={typedError ? "vip-user-err" : undefined}
              />
            </Field>
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            <Search className="h-4 w-4" /> View VIP status
          </Button>
        </form>
      </Card>

      {notice ? (
        <div role="status" className={`mb-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ring-1 ${notice.tone === "ok" ? "bg-ok/10 text-ok ring-ok/25" : "bg-warn/10 text-warn ring-warn/30"}`}>
          {notice.tone === "warn" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
          <span>{notice.text}</span>
        </div>
      ) : null}

      {userId === null ? (
        <Card>
          <Empty>Enter a user's numeric ID to see and manage their VIP.</Empty>
        </Card>
      ) : (
        <>
          <StatusCard userId={userId} load={status} onRetry={() => load(userId)} />
          {ready ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card title={<CardTitle icon={<Crown className="h-4 w-4 text-gold" aria-hidden />}>VIP membership</CardTitle>}>
                <div className="space-y-4 p-4">
                  <AmountForm key={`grant-${round}`} id="vip-grant" label="Grant VIP for (days)" button="Grant VIP" variant="gold" icon={<Crown className="h-4 w-4" />} kind="days" disabled={busy} onSubmit={(n) => ask({ op: "grant", value: n })} />
                  <AmountForm key={`extend-${round}`}
                    id="vip-extend"
                    label="Extend VIP by (days)"
                    hint="The server adds this to an active VIP's expiry, or starts it from now if VIP isn't active."
                    button="Extend VIP"
                    variant="gold"
                    icon={<CalendarPlus className="h-4 w-4" />}
                    kind="days"
                    disabled={busy}
                    onSubmit={(n) => ask({ op: "extend", value: n })}
                  />
                  <div className="border-t border-line pt-4">
                    <Button variant="danger" className="w-full" disabled={busy} onClick={() => ask({ op: "revoke" })}>
                      <ShieldOff className="h-4 w-4" /> Revoke VIP
                    </Button>
                  </div>
                </div>
              </Card>
              <Card title={<CardTitle icon={<Sparkles className="h-4 w-4 text-gold" aria-hidden />}>VIP points</CardTitle>}>
                <div className="space-y-4 p-4">
                  <p className="text-sm text-muted">
                    Current balance: <span className="font-semibold text-cream">{s.points === undefined ? "not in the server's reply" : `${fmtCoins(s.points)} points`}</span>
                  </p>
                  <AmountForm key={`credit-${round}`} id="vip-credit" label="Credit points" button="Credit points" variant="ok" icon={<PlusCircle className="h-4 w-4" />} kind="points" disabled={busy} onSubmit={(n) => ask({ op: "credit", value: n })} />
                  <AmountForm key={`debit-${round}`} id="vip-debit" label="Debit points" button="Debit points" variant="danger" icon={<MinusCircle className="h-4 w-4" />} kind="points" disabled={busy} onSubmit={(n) => ask({ op: "debit", value: n })} />
                </div>
              </Card>
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending ? `${OP[pending.op].title}?` : ""}
        confirmLabel={pending ? OP[pending.op].title : ""}
        confirmVariant={pending ? OP[pending.op].variant : "danger"}
        busy={busy}
        error={dialogError}
        onClose={() => {
          setPending(null);
          setDialogError(null);
        }}
        onConfirm={run}
      >
        {pending && userId !== null ? (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted">User ID</dt>
              <dd className="font-mono">{userId}</dd>
              <dt className="text-muted">Operation</dt>
              <dd className="font-semibold">{OP[pending.op].title}</dd>
              {OP[pending.op].field === "days" ? (
                <>
                  <dt className="text-muted">Duration</dt>
                  <dd className="font-semibold">
                    {fmtCoins(pending.value!)} {pending.value === 1 ? "day" : "days"}
                  </dd>
                </>
              ) : null}
              {OP[pending.op].field === "points" ? (
                <>
                  <dt className="text-muted">Points</dt>
                  <dd className="font-semibold">{fmtCoins(pending.value!)}</dd>
                  <dt className="text-muted">Balance now</dt>
                  <dd>{s?.points === undefined ? "—" : fmtCoins(s.points)}</dd>
                </>
              ) : null}
            </dl>
            <p className={pending.op === "revoke" || pending.op === "debit" ? "text-[#ffb0b4]" : "text-muted"}>
              {pending.op === "revoke"
                ? `User ${userId} loses VIP right away. The server turns VIP off and clears its expiry date.`
                : pending.op === "debit"
                  ? "This takes VIP points away. The server refuses it if the user doesn't have enough."
                  : pending.op === "grant"
                    ? "The server sets the new expiry date."
                    : pending.op === "extend"
                      ? "The server works out the new expiry date."
                      : "The server adds these points to the user's balance."}
            </p>
          </>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

function CardTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      {icon}
      {children}
    </span>
  );
}

function StatusCard({ userId, load, onRetry }: { userId: number; load: Load; onRetry: () => void }) {
  const s = load.data;
  return (
    <Card
      title={`VIP status · user ${userId}`}
      action={
        <Button size="sm" variant="ghost" onClick={onRetry} busy={load.loading} aria-label="Reload VIP status">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      }
    >
      {load.error ? (
        <div className="p-4">
          <ErrorNote>{load.error.message}</ErrorNote>
          {load.error.kind !== "forbidden" && load.error.kind !== "not_found" ? (
            <Button size="sm" variant="danger" className="mt-3" onClick={onRetry}>
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          ) : null}
        </div>
      ) : !s ? (
        <Loading />
      ) : (
        <div className={`p-4 ${load.loading ? "opacity-60" : ""}`} data-testid="vip-status">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-4">
            <Stat label="User ID">
              <span className="font-mono">{s.userId ?? userId}</span>
            </Stat>
            <Stat label="VIP">
              {s.active === true ? (
                <Badge tone="gold">
                  <Crown className="h-3 w-3" aria-hidden /> Active
                </Badge>
              ) : s.active === false ? (
                <Badge>{s.expiresAt ? "Inactive" : "No VIP"}</Badge>
              ) : (
                <Badge>Not in reply</Badge>
              )}
            </Stat>
            <Stat label="Expires">
              {s.expiresAt ? (
                <span>
                  {time(s.expiresAt)} {isPast(s.expiresAt) ? <Badge tone="warn">Expired</Badge> : null}
                </span>
              ) : (
                <span className="text-muted">No expiry date</span>
              )}
            </Stat>
            <Stat label="VIP points">{s.points === undefined ? <span className="text-muted">—</span> : fmtCoins(s.points)}</Stat>
          </dl>
          {s.fields.length ? (
            <details className="mt-4 text-xs text-muted">
              <summary className="cursor-pointer select-none">All fields from the server</summary>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono">
                {s.fields.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt>{k}</dt>
                    <dd className="break-all text-cream/80">{v}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="text-sm text-cream">{children}</dd>
    </div>
  );
}

/** One number and a button. Checks for a positive whole number before asking to confirm. */
function AmountForm({
  id,
  label,
  hint,
  button,
  variant,
  icon,
  kind,
  disabled,
  onSubmit,
}: {
  id: string;
  label: string;
  hint?: string;
  button: string;
  variant: "ok" | "gold" | "danger";
  icon: ReactNode;
  kind: "days" | "points";
  disabled: boolean;
  onSubmit: (n: number) => void;
}) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = wholeNumber(raw, { min: 1, name: kind === "days" ? "the number of days" : "the points" });
    if (typeof n !== "number") return setError(n ?? "Enter a number.");
    if (n > 2_147_483_647) return setError("That number is too large.");
    setError(null);
    onSubmit(n);
  };
  return (
    <form onSubmit={submit} noValidate aria-label={button}>
      <Field id={id} label={label} error={error} hint={hint}>
        <div className="flex gap-2">
          <input
            id={id}
            className="field"
            inputMode="numeric"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={kind === "days" ? "e.g. 30" : "e.g. 100"}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-err` : undefined}
          />
          <Button type="submit" variant={variant} disabled={disabled} className="min-w-[150px]">
            {icon} {button}
          </Button>
        </div>
      </Field>
    </form>
  );
}

/**
 * Payment tickets (live backend): problems people raise with a payment. Answer here: the answer also reaches the person as a message from
 * Munshi ji (the payments desk) and in their ticket. You can also write a message to any person by their ID.
 */
import { useCallback, useEffect, useState } from "react";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Button, Card, Chips, Empty, ErrorNote, Loading, Modal, PageHeader } from "../components/ui";
import { NeedsBackend } from "../components/WalletParts";
import { mediaHref } from "../components/MediaParts";

type Status = "OPEN" | "ANSWERED" | "CLOSED";
type Person = { id: string; name: string; publicId: number };
type Row = { id: string; category: string; reference: string | null; status: Status; message: string; createdAt: string; updatedAt: string; user: Person };
type Msg = { id: string; from: "USER" | "ADMIN"; adminName?: string | null; body: string; createdAt: string };
type Detail = Row & { proofUrl: string | null; messages: Msg[] };
type Page = { total: number; page: number; size: number; open: number; items: Row[] };
const base = "/api/v1/admin/manage/payment-tickets";
const SIZE = 20;
const CATEGORY: Record<string, string> = { NOT_CREDITED: "Paid, but no coins", MONEY_DEDUCTED: "Money deducted, payment failed", MANUAL_TOPUP: "UPI top-up problem", REFUND: "Refund", OTHER: "Something else" };
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const tone = (s: Status) => (s === "OPEN" ? "warn" : s === "ANSWERED" ? "ok" : "muted");

export function PaymentTicketsPage() {
  if (!BACKEND_ENABLED) return <NeedsBackend what="Payment tickets" />;
  return <Live />;
}

function Live() {
  const { toast, version } = useAdmin();
  const [status, setStatus] = useState<"OPEN" | "ANSWERED" | "CLOSED" | "ALL">("OPEN");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

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
      setData(await apiRequest<Page>(`${base}?${qs.toString()}`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the tickets.");
    }
  }, [status, term, page]);
  useEffect(() => {
    void load();
  }, [load, version]);
  useEffect(() => {
    const t = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  return (
    <>
      <PageHeader title="Payment tickets" sub="Problems people raise with a payment. Your answer also reaches them as a message from Munshi ji." />
      <Card
        title={data ? `${data.total} ${status === "ALL" ? "tickets" : status.toLowerCase()}${data.open ? ` · ${data.open} open in total` : ""}` : "Tickets"}
        action={<input className="field h-9 w-56" placeholder="Search #, reference, name, ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tickets" />}
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
              { value: "OPEN", label: "Waiting for me" },
              { value: "ANSWERED", label: "Answered" },
              { value: "CLOSED", label: "Closed" },
              { value: "ALL", label: "All" },
            ]}
          />
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        {!data ? (
          <Loading />
        ) : !data.items.length ? (
          <Empty>No tickets here.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {data.items.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setOpenId(t.id)} className="flex w-full flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-cream/[0.03]">
                  <span className="min-w-0 flex-1 basis-60">
                    <span className="block font-semibold">
                      #{t.id} · {CATEGORY[t.category] ?? t.category}
                      {t.reference ? <span className="ml-2 font-mono text-xs font-normal text-muted">{t.reference}</span> : null}
                    </span>
                    <span className="block truncate text-sm text-muted">{t.message}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {t.user.name} · ID {t.user.publicId} · {when(t.updatedAt)}
                    </span>
                  </span>
                  <Badge tone={tone(t.status)}>{t.status === "OPEN" ? "Waiting for you" : t.status === "ANSWERED" ? "Answered" : "Closed"}</Badge>
                </button>
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

      <DirectMessage toast={toast} />
      <TicketModal id={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} toast={toast} />
    </>
  );
}

type Toast = (t: string, tone?: "ok" | "error") => void;

function TicketModal({ id, onClose, onChanged, toast }: { id: string | null; onClose: () => void; onChanged: () => void; toast: Toast }) {
  const [t, setT] = useState<Detail | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setT(null);
    setReply("");
    setError(null);
    if (!id) return;
    let live = true;
    apiRequest<Detail>(`${base}/${encodeURIComponent(id)}`)
      .then((d) => live && setT(d))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't open the ticket."));
    return () => {
      live = false;
    };
  }, [id]);

  const act = async (path: string, body: unknown, done: string) => {
    if (!id) return;
    setBusy(true);
    try {
      setT(await apiRequest<Detail>(`${base}/${encodeURIComponent(id)}/${path}`, { method: "POST", body }));
      toast(done);
      onChanged();
      setReply("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "That didn't work", "error");
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    const note = window.prompt("Add a short note for the person (optional). It is sent with the closing message.", "Solved. Closing this ticket.");
    if (note === null) return;
    void act("close", { note }, "Ticket closed");
  };

  return (
    <Modal open={Boolean(id)} onClose={onClose} title={t ? `Ticket #${t.id}` : "Ticket"} wide>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!t ? (
        error ? null : <Loading />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={tone(t.status)}>{t.status === "OPEN" ? "Waiting for you" : t.status === "ANSWERED" ? "Answered" : "Closed"}</Badge>
            <span className="font-semibold">{CATEGORY[t.category] ?? t.category}</span>
            {t.reference ? <span className="font-mono text-xs text-muted">{t.reference}</span> : null}
            <span className="text-xs text-muted">
              {t.user.name} · ID {t.user.publicId} · {when(t.createdAt)}
            </span>
          </div>
          {t.proofUrl ? (
            <a href={mediaHref(t.proofUrl) ?? t.proofUrl} target="_blank" rel="noreferrer" className="block w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaHref(t.proofUrl) ?? t.proofUrl} alt="Screenshot from the person" className="max-h-56 rounded-lg ring-1 ring-line" />
            </a>
          ) : null}
          <div className="max-h-[320px] space-y-2 overflow-y-auto">
            {t.messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === "ADMIN" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.from === "ADMIN" ? "bg-gold/90 text-ink" : "bg-cream/[0.08]"}`}>
                  <p className={`text-[11px] font-bold ${m.from === "ADMIN" ? "text-ink/70" : "text-muted"}`}>{m.from === "ADMIN" ? (m.adminName ?? "Staff") : t.user.name}</p>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-0.5 text-[10px] ${m.from === "ADMIN" ? "text-ink/60" : "text-muted"}`}>{when(m.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
          {t.status === "CLOSED" ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted">This ticket is closed.</p>
              <Button busy={busy} onClick={() => void act("reopen", {}, "Ticket reopened")}>
                Reopen
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-semibold">
                Your answer (the person gets it as a message from Munshi ji)
                <textarea className="field mt-1 min-h-[90px]" maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write the answer…" />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="danger" disabled={busy} onClick={close}>
                  Close ticket
                </Button>
                <Button variant="primary" busy={busy} disabled={!reply.trim()} onClick={() => void act("reply", { body: reply }, "Reply sent")}>
                  Send reply
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function DirectMessage({ toast }: { toast: Toast }) {
  const [pub, setPub] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await apiRequest(`${base}/message`, { method: "POST", body: { publicId: pub, title, body } });
      toast("Message sent");
      setBody("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't send", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Message a person from Munshi ji" className="mt-5">
      <div className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <label className="block text-sm font-semibold">
            Person&apos;s ID
            <input className="field mt-1" inputMode="numeric" placeholder="7-digit ID" value={pub} onChange={(e) => setPub(e.target.value.replace(/\D/g, "").slice(0, 7))} />
          </label>
          <label className="block text-sm font-semibold">
            Title (optional)
            <input className="field mt-1" maxLength={120} placeholder="For example: About your payment" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm font-semibold">
          Message
          <textarea className="field mt-1 min-h-[80px]" maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the message…" />
        </label>
        <Button variant="primary" busy={busy} disabled={pub.length !== 7 || !body.trim()} onClick={() => void send()}>
          Send
        </Button>
      </div>
    </Card>
  );
}

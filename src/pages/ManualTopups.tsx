/**
 * Manual UPI top-up ("Mukhiya ji"), live backend. For people whose Google Pay / Paytm doesn't like the payment gateway.
 *  - Set the UPI ID (and a QR picture) people pay, and switch it on.
 *  - People send the transaction ID (UTR) and a screenshot. Check the payment in your BANK (not just the screenshot), then Approve:
 *    the coins of the pack are added once. Reject if it isn't there; the person gets the reason in the Mukhiya ji chat.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { apiRequest, apiUpload } from "../lib/api";
import { Badge, Button, Card, Chips, Empty, ErrorNote, Loading, PageHeader, Toggle, fmtCoins } from "../components/ui";
import { NeedsBackend } from "../components/WalletParts";
import { mediaHref } from "../components/MediaParts";

type Status = "REQUESTED" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED";
type Item = {
  id: string;
  reference: string;
  status: Status;
  user: { id: string; publicId: number; name: string };
  packName: string;
  amountInr: number;
  coins: number;
  utr: string | null;
  sameUtrElsewhere: number;
  proofUrl: string | null;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
};
type Page = { total: number; page: number; size: number; waiting: number; items: Item[] };
type Settings = { enabled: boolean; upiId: string | null; payeeName: string | null; qrUrl: string | null; note: string | null };
const base = "/api/v1/admin/manage/manual-topups";
const SIZE = 20;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function ManualTopupsPage() {
  if (!BACKEND_ENABLED) return <NeedsBackend what="Manual top-ups" />;
  return <Live />;
}

function Live() {
  return (
    <>
      <PageHeader title="Manual top-ups (Mukhiya ji)" sub="People who couldn't pay with the gateway pay your UPI ID and send the transaction ID. Check it in your bank, then approve." />
      <SettingsCard />
      <Requests />
    </>
  );
}

function SettingsCard() {
  const { toast } = useAdmin();
  const [saved, setSaved] = useState<Settings | null>(null);
  const [f, setF] = useState({ enabled: false, upiId: "", payeeName: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qrInput = useRef<HTMLInputElement>(null);

  const apply = (s: Settings) => {
    setSaved(s);
    setF({ enabled: s.enabled, upiId: s.upiId ?? "", payeeName: s.payeeName ?? "", note: s.note ?? "" });
  };
  useEffect(() => {
    apiRequest<Settings>(`${base}/settings`).then(apply).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the settings."));
  }, []);

  const dirty = saved !== null && (saved.enabled !== f.enabled || (saved.upiId ?? "") !== f.upiId || (saved.payeeName ?? "") !== f.payeeName || (saved.note ?? "") !== f.note);
  const save = async () => {
    setBusy(true);
    try {
      apply(await apiRequest<Settings>(`${base}/settings`, { method: "PUT", body: f }));
      setError(null);
      toast("Saved");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  };
  const uploadQr = async (file?: File) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    try {
      await apiUpload<Settings>(`${base}/settings/qr`, form).promise;
      apply(await apiRequest<Settings>(`${base}/settings`));
      toast("QR saved");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't upload", "error");
    } finally {
      setBusy(false);
      if (qrInput.current) qrInput.current.value = "";
    }
  };

  return (
    <Card title="Your UPI details">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!saved && !error ? (
        <Loading />
      ) : (
        <div className="space-y-4 p-4">
          <Toggle checked={f.enabled} onChange={(v) => setF((x) => ({ ...x, enabled: v }))} label="Allow paying Mukhiya ji by UPI" hint="Users see 'Pay Mukhiya ji by UPI' in the wallet, in checkout and in the Mukhiya ji chat. Never shown in the Google Play build." />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              UPI ID
              <input className="field mt-1" placeholder="name@bank" value={f.upiId} onChange={(e) => setF((x) => ({ ...x, upiId: e.target.value }))} />
              <span className="mt-1 block text-xs font-normal text-muted">Use a business / merchant UPI ID if you have one.</span>
            </label>
            <label className="block text-sm font-semibold">
              Name shown to the payer
              <input className="field mt-1" placeholder="Panchayat" value={f.payeeName} onChange={(e) => setF((x) => ({ ...x, payeeName: e.target.value }))} />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Note under the payment steps (optional)
            <textarea className="field mt-1 min-h-[70px]" maxLength={500} placeholder="For example: Coins are added within 30 minutes (9 am to 10 pm)." value={f.note} onChange={(e) => setF((x) => ({ ...x, note: e.target.value }))} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {saved?.qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaHref(saved.qrUrl) ?? saved.qrUrl} alt="UPI QR" className="h-24 w-24 rounded-lg bg-white object-contain p-1" />
            ) : (
              <span className="text-xs text-muted">No QR picture yet (people can still pay the UPI ID).</span>
            )}
            <input ref={qrInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void uploadQr(e.target.files?.[0])} />
            <Button size="sm" busy={busy} onClick={() => qrInput.current?.click()}>
              {saved?.qrUrl ? "Change QR picture" : "Upload QR picture"}
            </Button>
          </div>
          <Button variant="primary" busy={busy} disabled={!dirty} onClick={() => void save()}>
            Save
          </Button>
        </div>
      )}
    </Card>
  );
}

function Requests() {
  const { toast, version } = useAdmin();
  const [status, setStatus] = useState<"SUBMITTED" | "APPROVED" | "REJECTED" | "REQUESTED" | "ALL">("SUBMITTED");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

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
      setError(e instanceof Error ? e.message : "Couldn't load the top-ups.");
    }
  }, [status, term, page]);
  useEffect(() => {
    void load();
  }, [load, version]);
  // New requests arrive while the page is open
  useEffect(() => {
    const t = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  const approve = async (i: Item) => {
    if (!window.confirm(`Did you see ${inr(i.amountInr)} with transaction ID ${i.utr} in your bank?\n\nApprove adds ${fmtCoins(i.coins)} coins to ${i.user.name}. This can't be undone.`)) return;
    setActing(i.id);
    try {
      await apiRequest(`${base}/${encodeURIComponent(i.id)}/approve`, { method: "POST" });
      toast(`${fmtCoins(i.coins)} coins added to ${i.user.name}`);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't approve", "error");
    } finally {
      setActing(null);
    }
  };
  const reject = async (i: Item) => {
    const reason = window.prompt(`Why can't this payment be verified? ${i.user.name} will read this.`, "I couldn't find this payment in my bank.");
    if (!reason || !reason.trim()) return;
    setActing(i.id);
    try {
      await apiRequest(`${base}/${encodeURIComponent(i.id)}/reject`, { method: "POST", body: { reason: reason.trim() } });
      toast("Rejected. The person was told why.");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't reject", "error");
    } finally {
      setActing(null);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const tone = (s: Status) => (s === "APPROVED" ? "ok" : s === "REJECTED" ? "coral" : s === "SUBMITTED" ? "warn" : "muted");

  return (
    <Card
      className="mt-5"
      title={data ? `${data.total} ${status === "ALL" ? "top-ups" : status.toLowerCase()}${data.waiting ? ` · ${data.waiting} waiting for you` : ""}` : "Top-ups"}
      action={<input className="field h-9 w-56" placeholder="Search UTR, name, ID, reference" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search top-ups" />}
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
            { value: "SUBMITTED", label: "Waiting for me" },
            { value: "APPROVED", label: "Approved" },
            { value: "REJECTED", label: "Rejected" },
            { value: "REQUESTED", label: "Not paid yet" },
            { value: "ALL", label: "All" },
          ]}
        />
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!data ? (
        <Loading />
      ) : !data.items.length ? (
        <Empty>Nothing here.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {data.items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-start gap-4 px-4 py-3">
              {i.proofUrl ? (
                <a href={mediaHref(i.proofUrl) ?? i.proofUrl} target="_blank" rel="noreferrer" className="shrink-0" title="Open the screenshot">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaHref(i.proofUrl) ?? i.proofUrl} alt="Payment screenshot" className="h-24 w-16 rounded-lg object-cover ring-1 ring-line" />
                </a>
              ) : (
                <span className="grid h-24 w-16 shrink-0 place-items-center rounded-lg bg-ink text-[10px] text-muted ring-1 ring-line">No proof</span>
              )}
              <span className="min-w-0 flex-1 basis-56">
                <span className="block font-semibold">
                  {i.user.name} <span className="font-normal text-muted">· ID {i.user.publicId}</span>
                </span>
                <span className="block text-sm">
                  {i.packName} · <b>{inr(i.amountInr)}</b> → {fmtCoins(i.coins)} coins
                </span>
                {i.utr ? (
                  <span className="mt-0.5 block font-mono text-sm">
                    UTR {i.utr}{" "}
                    <button type="button" className="text-xs font-sans text-gold" onClick={() => void navigator.clipboard?.writeText(i.utr ?? "")}>
                      copy
                    </button>
                  </span>
                ) : null}
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <Badge tone={tone(i.status)}>{i.status === "SUBMITTED" ? "Waiting for you" : i.status === "REQUESTED" ? "Not paid yet" : i.status.charAt(0) + i.status.slice(1).toLowerCase()}</Badge>
                  <span>Ref {i.reference}</span>
                  <span>{when(i.submittedAt ?? i.createdAt)}</span>
                  {i.reviewedBy ? <span>by {i.reviewedBy} · {when(i.reviewedAt)}</span> : null}
                  {i.sameUtrElsewhere > 0 ? <Badge tone="coral">Same UTR used {i.sameUtrElsewhere}× elsewhere</Badge> : null}
                </span>
                {i.rejectReason ? <span className="mt-1 block text-xs text-[#ff9095]">Reason: {i.rejectReason}</span> : null}
              </span>
              {i.status === "SUBMITTED" ? (
                <span className="flex gap-2">
                  <Button size="sm" variant="ok" busy={acting === i.id} onClick={() => void approve(i)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="danger" disabled={acting === i.id} onClick={() => void reject(i)}>
                    Reject
                  </Button>
                </span>
              ) : null}
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

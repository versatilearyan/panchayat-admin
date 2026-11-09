/** Send coins or a red packet to everyone in one click (Super Admin). */
import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { useAdmin } from "../context";
import { adminUsersService } from "../services/adminUsersService";
import { redPacketService } from "../services/redPacketService";
import { Button, Chips, ErrorNote, Modal, fmtCoins, useLoad } from "./ui";

export function GiveAllButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="gold" onClick={() => setOpen(true)}>
        <Gift className="h-4 w-4" /> Gift everyone
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="🎁 Gift everyone" wide>
        {open ? <GiveAllForm onClose={() => setOpen(false)} /> : null}
      </Modal>
    </>
  );
}

function GiveAllForm({ onClose }: { onClose: () => void }) {
  const { toast, changed } = useAdmin();
  const [kind, setKind] = useState<"coins" | "packet">("coins");
  const [coins, setCoins] = useState("100");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [audience, setAudience] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const products = useLoad(() => redPacketService.list(), []);
  const list = (products.data ?? []).filter((p) => p.active);
  const c = Math.round(Number(coins));
  const q = Math.round(Number(qty));
  const ok = kind === "coins" ? c >= 1 && c <= 1_000_000 : Boolean(productId) && q >= 1 && q <= 100;

  useEffect(() => {
    adminUsersService
      .audience()
      .then((a) => setAudience(a.recipients))
      .catch(() => {});
  }, []);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = kind === "coins" ? await adminUsersService.giveAllCoins(c, reason.trim()) : await adminUsersService.giveAllRedPacket(productId, q, reason.trim());
      toast(`Sending to ${fmtCoins(r.recipients)} people. It finishes in a moment.`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <div className="space-y-5">
      <Chips
        label="What to send"
        value={kind}
        onChange={(v) => {
          setKind(v);
          setConfirm(false);
        }}
        options={[
          { value: "coins", label: "Coins" },
          { value: "packet", label: "Red packet" },
        ]}
      />
      {kind === "coins" ? (
        <div>
          <label className="label" htmlFor="ga-coins">
            Coins for each person
          </label>
          <input id="ga-coins" className="field h-10 w-40" inputMode="numeric" value={coins} onChange={(e) => setCoins(e.target.value.replace(/\D/g, ""))} />
          <p className="mt-1 text-xs text-muted">Up to 1,000,000 each.</p>
        </div>
      ) : (
        <>
          <div>
            <span className="label">Red packet</span>
            <div className="grid grid-cols-2 gap-2">
              {list.map((p) => (
                <button
                  key={String(p.id)}
                  type="button"
                  aria-pressed={String(p.id) === productId}
                  onClick={() => setProductId(String(p.id))}
                  className={`rounded-xl px-3 py-2.5 text-left text-sm ring-1 transition ${String(p.id) === productId ? "bg-[#ff7a1a]/15 ring-[#ff7a1a]" : "ring-line-strong hover:bg-cream/5"}`}
                >
                  <span className="block font-semibold">{p.name}</span>
                  <span className="text-xs text-muted">{p.coinValue.toLocaleString("en-IN")} coins</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="ga-qty">
              How many each
            </label>
            <input id="ga-qty" className="field h-10 w-28" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
          </div>
        </>
      )}
      <div>
        <label className="label" htmlFor="ga-reason">
          Message they see (optional)
        </label>
        <input id="ga-reason" className="field h-10 w-full" maxLength={200} placeholder="e.g. Happy Diwali!" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <p className="rounded-2xl bg-ink px-4 py-3 text-sm ring-1 ring-line">
        Goes to <b>{audience === null ? "everyone" : `${fmtCoins(audience)} people`}</b> (not banned ones). Each gets a message from Sarpanch. This cannot be undone.
      </p>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        {confirm ? (
          <Button variant="danger" busy={busy} onClick={send}>
            Yes, send to everyone
          </Button>
        ) : (
          <Button variant="gold" disabled={!ok} onClick={() => setConfirm(true)}>
            Send to everyone
          </Button>
        )}
      </div>
    </div>
  );
}

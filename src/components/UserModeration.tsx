/** Ban or suspend an account, and put red packets in one person's Bag (the live backend). */
import { useState } from "react";
import { Ban } from "lucide-react";
import { useAdmin } from "../context";
import { adminUsersService, type AppUser } from "../services/adminUsersService";
import { redPacketService } from "../services/redPacketService";
import { Button, Chips, ErrorNote, Modal, useLoad } from "./ui";

const LENGTHS = [
  { value: 1, label: "1 day" },
  { value: 3, label: "3 days" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: -1, label: "Custom" },
  { value: 0, label: "Permanent" },
] as { value: number; label: string }[];

const who = (u: AppUser) => u.name || u.email || `#${u.id}`;

export function BanDialog({ user, onClose }: { user: AppUser | null; onClose: () => void }) {
  return (
    <Modal open={user !== null} onClose={onClose} title="Ban or suspend">
      {user ? <BanForm key={user.id} user={user} onClose={onClose} /> : null}
    </Modal>
  );
}

function BanForm({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const { changed, toast } = useAdmin();
  const [len, setLen] = useState(7);
  const [custom, setCustom] = useState("14");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const days = len === 0 ? null : len === -1 ? Math.round(Number(custom)) : len;
  const bad = len !== 0 && (!days || !Number.isFinite(days) || days < 1 || days > 3650);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminUsersService.ban(user.id, days, reason.trim());
      toast(days === null ? `${who(user)} is banned for good` : `${who(user)} is suspended for ${days} day${days === 1 ? "" : "s"}`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="rounded-2xl bg-ink px-3.5 py-3 text-sm ring-1 ring-line">
        <span className="font-semibold">{who(user)}</span> <span className="text-muted">· ID {user.publicId}</span>
        <span className="mt-1 block text-xs text-muted">They are signed out at once and cannot sign in, chat or join rooms. Sarpanch tells them why.</span>
      </p>
      <div>
        <span className="label">For how long</span>
        <Chips label="For how long" value={len} onChange={setLen} options={LENGTHS} />
        {len === -1 ? (
          <div className="mt-2 flex items-center gap-2">
            <input className="field h-10 w-24" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))} aria-label="Days" />
            <span className="text-sm text-muted">days (up to 3650)</span>
          </div>
        ) : null}
        {len === 0 ? <p className="mt-2 text-xs text-[#ff9095]">Permanent: stays until you unban them.</p> : null}
      </div>
      <div>
        <label className="label" htmlFor="ban-reason">
          Reason (the person sees it)
        </label>
        <input id="ban-reason" className="field h-10 w-full" maxLength={200} placeholder="e.g. Abuse in rooms" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="danger" busy={busy} disabled={bad} onClick={submit}>
          <Ban className="h-4 w-4" /> {len === 0 ? "Ban for good" : "Suspend"}
        </Button>
      </div>
    </div>
  );
}

export function RedPacketGiftDialog({ user, onClose }: { user: AppUser | null; onClose: () => void }) {
  return (
    <Modal open={user !== null} onClose={onClose} title="🧧 Give a red packet">
      {user ? <PacketForm key={user.id} user={user} onClose={onClose} /> : null}
    </Modal>
  );
}

function PacketForm({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const { toast } = useAdmin();
  const products = useLoad(() => redPacketService.list(), []);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = (products.data ?? []).filter((p) => p.active);
  const n = Math.round(Number(qty));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await redPacketService.grant(user.id, productId, n);
      toast(`Gave ${who(user)} ${n} red packet${n === 1 ? "" : "s"}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="rounded-2xl bg-ink px-3.5 py-3 text-sm ring-1 ring-line">
        <span className="font-semibold">{who(user)}</span> <span className="text-muted">· ID {user.publicId}</span>
      </p>
      <div>
        <span className="label">Red packet</span>
        {products.error ? <ErrorNote>{String(products.error)}</ErrorNote> : null}
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
        <label className="label" htmlFor="rp-qty">
          How many
        </label>
        <input id="rp-qty" className="field h-10 w-28" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="gold" busy={busy} disabled={!productId || !n || n < 1} onClick={submit}>
          Give
        </Button>
      </div>
    </div>
  );
}

/** Take coins or Charm away from a user (Super Admin): an amount, or all of it. */
export function RemoveDialog({ user, onClose }: { user: AppUser | null; onClose: () => void }) {
  return (
    <Modal open={user !== null} onClose={onClose} title="Remove coins or Charm">
      {user ? <RemoveForm key={user.id} user={user} onClose={onClose} /> : null}
    </Modal>
  );
}

function RemoveForm({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const { toast, changed } = useAdmin();
  const [what, setWhat] = useState<"coins" | "charm">("coins");
  const [all, setAll] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const have = what === "coins" ? user.coins : user.charm;
  const n = Math.round(Number(amount));
  const ok = all ? have > 0 : n >= 1;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = what === "coins" ? await adminUsersService.removeCoins(user.id, all ? null : n, reason.trim()) : await adminUsersService.removeCharm(user.id, all ? null : n, reason.trim());
      toast(`Removed ${r.removed.toLocaleString("en-IN")} ${what === "coins" ? "coins" : "Charm"} from ${who(user)}`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
      setSure(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="rounded-2xl bg-ink px-3.5 py-3 text-sm ring-1 ring-line">
        <span className="font-semibold">{who(user)}</span> <span className="text-muted">· ID {user.publicId}</span>
        <span className="mt-1 block text-xs text-muted">
          Has {user.coins.toLocaleString("en-IN")} coins and {user.charm.toLocaleString("en-IN")} Charm now.
        </span>
      </p>
      <Chips
        label="What to remove"
        value={what}
        onChange={(v) => {
          setWhat(v);
          setSure(false);
        }}
        options={[
          { value: "coins", label: "Coins" },
          { value: "charm", label: "Charm" },
        ]}
      />
      <div>
        <label className="label" htmlFor="rm-amount">
          How much
        </label>
        <div className="flex items-center gap-2">
          <input id="rm-amount" className="field h-10 w-40" inputMode="numeric" disabled={all} value={all ? "" : amount} placeholder={all ? "All of it" : "e.g. 50000"} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={all} onChange={(e) => (setAll(e.target.checked), setSure(false))} /> Remove all
          </label>
        </div>
        <p className="mt-1 text-xs text-muted">Can't take more than they have.</p>
      </div>
      <div>
        <label className="label" htmlFor="rm-why">
          Reason (saved in the log)
        </label>
        <input id="rm-why" className="field h-10 w-full" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        {sure ? (
          <Button variant="danger" busy={busy} onClick={submit}>
            Yes, remove {all ? "all" : n.toLocaleString("en-IN")} {what === "coins" ? "coins" : "Charm"}
          </Button>
        ) : (
          <Button variant="danger" disabled={!ok} onClick={() => setSure(true)}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

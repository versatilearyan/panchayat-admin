/** One dialog for every action on a user: coins, warn, mute, kick and ban. */
import { useEffect, useMemo, useState } from "react";
import { adminApi, COIN_LIMIT, MAX_COIN_CHANGE, type AdminRoom, type AdminUser, type Duration } from "../api";
import { useAdmin } from "../context";
import { Avatar, Button, Chips, ErrorNote, fmtCoins, Modal } from "./ui";

export type ActionKind = "add-coins" | "remove-coins" | "warn" | "mute" | "kick" | "ban";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const DURATIONS: Record<"mute" | "kick" | "ban", { value: Duration; label: string }[]> = {
  mute: [
    { value: 15 * MIN, label: "15 min" },
    { value: HOUR, label: "1 hour" },
    { value: DAY, label: "24 hours" },
    { value: 7 * DAY, label: "7 days" },
    { value: null, label: "Permanent" },
  ],
  kick: [
    { value: HOUR, label: "1 hour" },
    { value: DAY, label: "24 hours" },
    { value: 7 * DAY, label: "7 days" },
    { value: null, label: "Permanent" },
  ],
  ban: [
    { value: DAY, label: "24 hours" },
    { value: 7 * DAY, label: "7 days" },
    { value: 30 * DAY, label: "30 days" },
    { value: null, label: "Permanent" },
  ],
};

const MOD_REASONS = ["Spam", "Abusive language", "Harassment", "Inappropriate content", "Cheating or scams", "Impersonation", "Underage user"];
const COIN_REASONS_ADD = ["Event reward", "Compensation", "Refund", "Promotion", "Testing"];
const COIN_REASONS_REMOVE = ["Fraud reversal", "Chargeback", "Duplicate credit", "Mistake fix"];
const COIN_PRESETS = [100, 500, 1_000, 5_000, 10_000, 50_000];

const DEFAULT_WARNING = "Please keep Panchayat friendly and respectful. Another report may lead to a mute or ban.";

const TITLE: Record<ActionKind, string> = {
  "add-coins": "Add coins",
  "remove-coins": "Remove coins",
  warn: "Send a warning",
  mute: "Mute user",
  kick: "Kick from a room",
  ban: "Ban user",
};

export function ActionDialog({ kind, user, roomId, onClose }: { kind: ActionKind | null; user: AdminUser; roomId?: string; onClose: () => void }) {
  return (
    <Modal open={kind !== null} onClose={onClose} title={kind ? TITLE[kind] : ""}>
      {kind ? <ActionForm key={kind} kind={kind} user={user} roomId={roomId} onClose={onClose} /> : null}
    </Modal>
  );
}

function ActionForm({ kind, user, roomId, onClose }: { kind: ActionKind; user: AdminUser; roomId?: string; onClose: () => void }) {
  const { changed, toast, session } = useAdmin();
  const coinLimit = Math.min(MAX_COIN_CHANGE, COIN_LIMIT[session.role]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState(kind === "warn" ? DEFAULT_WARNING : "");
  const [duration, setDuration] = useState<Duration>(kind === "mute" ? HOUR : kind === "kick" ? DAY : kind === "ban" ? 7 * DAY : null);
  const [room, setRoom] = useState(roomId ?? "");
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kind === "kick") adminApi.listRooms().then(setRooms).catch(() => setError("Couldn't load rooms"));
  }, [kind]);

  const isCoins = kind === "add-coins" || kind === "remove-coins";
  const reasons = kind === "add-coins" ? COIN_REASONS_ADD : kind === "remove-coins" ? COIN_REASONS_REMOVE : MOD_REASONS;
  const n = Number(amount.replace(/[,\s]/g, ""));
  const validAmount = Number.isInteger(n) && n > 0 && n <= coinLimit;
  const after = kind === "add-coins" ? user.coins + (validAmount ? n : 0) : user.coins - (validAmount ? n : 0);
  // Permanent bans need the user's ID typed out, so they can't happen by accident
  const needsConfirm = kind === "ban" && duration === null;
  const roomsSorted = useMemo(() => [...rooms].sort((a, b) => Number(b.seated.includes(user.id)) - Number(a.seated.includes(user.id)) || a.name.localeCompare(b.name)), [rooms, user.id]);

  const canSubmit =
    reason.trim().length > 0 &&
    (!isCoins || (validAmount && after >= 0)) &&
    (kind !== "warn" || message.trim().length > 0) &&
    (kind !== "kick" || Boolean(room)) &&
    (!needsConfirm || confirm.trim() === user.uid);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (kind === "add-coins") await adminApi.adjustCoins(user.id, n, reason);
      else if (kind === "remove-coins") await adminApi.adjustCoins(user.id, -n, reason);
      else if (kind === "warn") await adminApi.warn(user.id, reason, message);
      else if (kind === "mute") await adminApi.mute(user.id, reason, duration);
      else if (kind === "kick") await adminApi.kick(user.id, room, reason, duration);
      else await adminApi.ban(user.id, reason, duration, message);
      const done: Record<ActionKind, string> = {
        "add-coins": `Added ${fmtCoins(n)} coins to ${user.name}`,
        "remove-coins": `Removed ${fmtCoins(n)} coins from ${user.name}`,
        warn: `Warning sent to ${user.name}`,
        mute: `${user.name} is muted`,
        kick: `${user.name} was kicked from ${rooms.find((r) => r.id === room)?.name ?? "the room"}`,
        ban: `${user.name} is banned`,
      };
      toast(done[kind]);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-2xl bg-ink px-3.5 py-3 ring-1 ring-line">
        <Avatar name={user.name} color={user.color} photoUrl={user.photoUrl} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="text-xs text-muted">
            ID {user.uid} · {fmtCoins(user.coins)} coins
          </p>
        </div>
      </div>

      {isCoins ? (
        <div>
          <label className="label" htmlFor="amount">
            Coins to {kind === "add-coins" ? "add" : "remove"}
          </label>
          <input id="amount" inputMode="numeric" className="field font-display text-lg font-bold" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COIN_PRESETS.filter((p) => p <= coinLimit).map((p) => (
              <button key={p} type="button" onClick={() => setAmount(String(p))} className="h-7 rounded-full px-2.5 text-xs font-semibold text-gold ring-1 ring-gold/30 hover:bg-gold/10">
                {kind === "add-coins" ? "+" : "−"}
                {fmtCoins(p)}
              </button>
            ))}
          </div>
          <p className={`mt-2 text-xs ${after < 0 || n > coinLimit ? "text-[#ff9095]" : "text-muted"}`}>
            {n > coinLimit
              ? `You can change up to ${fmtCoins(coinLimit)} coins at once.`
              : after < 0
                ? `${user.name} only has ${fmtCoins(user.coins)} coins.`
                : `New balance: ${fmtCoins(after)} coins`}
          </p>
        </div>
      ) : null}

      {kind === "kick" ? (
        <div>
          <label className="label" htmlFor="room">
            Room
          </label>
          <select id="room" className="field" value={room} onChange={(e) => setRoom(e.target.value)}>
            <option value="">Pick a room…</option>
            {roomsSorted.map((r) => (
              <option key={r.id} value={r.id} disabled={r.hostId === user.id}>
                {r.name} · {r.code}
                {r.seated.includes(user.id) ? " (on mic now)" : ""}
                {r.hostId === user.id ? " (owner)" : ""}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {kind === "mute" || kind === "kick" || kind === "ban" ? (
        <div>
          <span className="label">How long</span>
          <Chips label="How long" options={DURATIONS[kind]} value={duration} onChange={setDuration} />
          {kind === "mute" ? <p className="mt-2 text-xs text-muted">Muted users can't speak on mic, chat in rooms or send messages.</p> : null}
          {kind === "kick" ? <p className="mt-2 text-xs text-muted">They're removed from the room now and can't rejoin it until this ends.</p> : null}
          {kind === "ban" ? <p className="mt-2 text-xs text-muted">Banned users are signed out and can't use Panchayat until this ends.</p> : null}
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="reason">
          Reason <span className="normal-case tracking-normal text-muted/70">(for the activity log)</span>
        </label>
        <input id="reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={isCoins ? "Why are coins changing?" : "What did they do?"} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {reasons.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className="h-7 rounded-full px-2.5 text-xs font-medium text-muted ring-1 ring-line-strong hover:text-cream">
              {r}
            </button>
          ))}
        </div>
      </div>

      {kind === "warn" || kind === "ban" ? (
        <div>
          <label className="label" htmlFor="msg">
            Message to the user {kind === "ban" ? <span className="normal-case tracking-normal text-muted/70">(optional)</span> : null}
          </label>
          <textarea id="msg" rows={3} className="field resize-none" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={kind === "ban" ? "Shown on their suspended account screen" : undefined} />
        </div>
      ) : null}

      {needsConfirm ? (
        <div>
          <label className="label" htmlFor="confirm">
            Type {user.uid} to confirm a permanent ban
          </label>
          <input id="confirm" inputMode="numeric" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
      ) : null}

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button
          variant={kind === "add-coins" ? "gold" : kind === "remove-coins" || kind === "warn" ? "soft" : "primary"}
          onClick={submit}
          disabled={!canSubmit}
          busy={busy}
          className="flex-[1.4]"
        >
          {kind === "add-coins" ? `Add ${validAmount ? fmtCoins(n) : ""} coins` : kind === "remove-coins" ? `Remove ${validAmount ? fmtCoins(n) : ""} coins` : TITLE[kind].replace(" user", "")}
        </Button>
      </div>
    </div>
  );
}

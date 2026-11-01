/** Side panel with everything about one user and every action you can take on them. */
import { useEffect, useState } from "react";
import { BadgeCheck, Ban, Coins, Crown, PenLine, DoorOpen, Gift, MessageSquareWarning, MicOff, MinusCircle, ShieldCheck, Undo2, Volume2, X } from "lucide-react";
import { adminApi, type AdminUserDetail, type Grant, type Sanction } from "../api";
import { useAdmin } from "../context";
import { ActionDialog, type ActionKind } from "./ActionDialog";
import { GrantDialog, type GrantKind } from "./GrantDialog";
import { RenameDialog } from "./RenameDialog";
import { Avatar, Badge, Button, Chips, Empty, ErrorNote, fmtCoins, fmtDate, Loading, StatusBadge, timeAgo, untilText, useLoad } from "./ui";

type Tab = "history" | "coins" | "grants" | "reports" | "note";

export function UserDrawer() {
  const { userId, openUser } = useAdmin();
  useEffect(() => {
    if (!userId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector("[role=dialog] [role=dialog]") && openUser(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userId, openUser]);
  if (!userId) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="User details">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/55" onClick={() => openUser(null)} />
      <div className="scroll-thin relative h-full w-full overflow-y-auto border-l border-line-strong bg-ink-2 shadow-2xl sm:max-w-[520px]">
        <Detail key={userId} userId={userId} />
      </div>
    </div>
  );
}

const SANCTION_LABEL: Record<Sanction["kind"], string> = { ban: "Ban", mute: "Mute", warn: "Warning", kick: "Kick" };

function Detail({ userId }: { userId: string }) {
  const { openUser, version, changed, toast, can } = useAdmin();
  const [grant, setGrant] = useState<GrantKind | null>(null);
  const [renaming, setRenaming] = useState(false);
  const { data: user, error, loading } = useLoad(() => adminApi.getUser(userId), [userId, version]);
  const [action, setAction] = useState<ActionKind | null>(null);
  const [tab, setTab] = useState<Tab>("history");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast(done);
      changed();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(null);
    }
  };

  if (loading && !user) return <Loading />;
  if (error || !user) return <div className="p-5">{error ? <ErrorNote>{error}</ErrorNote> : null}</div>;

  const noteValue = note ?? user.note;

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-ink-2/95 px-5 pt-5 pb-4 backdrop-blur">
        <div className="flex items-start gap-3.5">
          <Avatar name={user.name} color={user.color} photoUrl={user.photoUrl} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-xl font-bold">{user.name}</h2>
              {user.official ? (
                <Badge tone="gold">
                  <BadgeCheck className="h-3.5 w-3.5" /> Official
                </Badge>
              ) : (
                <StatusBadge status={user.status} />
              )}
              {can("users.rename") && !user.official ? (
                <button type="button" onClick={() => setRenaming(true)} title="Change name or username" aria-label="Change name or username" className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-cream/5 hover:text-cream">
                  <PenLine className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {user.warnings ? <Badge tone="warn">{user.warnings} warning{user.warnings > 1 ? "s" : ""}</Badge> : null}
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {user.handle} · ID {user.uid}
              {user.city ? ` · ${user.city}` : ""}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${user.online && !user.ban ? "bg-ok" : "bg-muted/50"}`} />
              {user.online && !user.ban ? "Online" : "Offline"}
            </p>
          </div>
          <button type="button" onClick={() => openUser(null)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-cream/[0.07] hover:bg-cream/[0.12]">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="space-y-5 px-5 py-5">
        {user.bio ? <p className="text-sm leading-relaxed text-cream/85">{user.bio}</p> : null}

        <dl className="grid grid-cols-4 gap-2">
          {[
            ["Coins", fmtCoins(user.coins)],
            ["Level", `Lv.${user.level}`],
            ["VIP", user.vip ? `VIP ${user.vip}` : "None"],
            ["Followers", user.followers.toLocaleString("en-IN")],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-ink px-2.5 py-2.5 ring-1 ring-line">
              <dt className="text-[10px] font-bold tracking-wider text-muted uppercase">{k}</dt>
              <dd className={`mt-0.5 truncate font-display text-[15px] font-bold ${k === "Coins" ? "text-gold" : ""}`}>{v}</dd>
            </div>
          ))}
        </dl>

        {/* Actions */}
        {user.official ? (
          <p className="rounded-xl bg-gold/10 px-3.5 py-2.5 text-sm text-gold">This is the official Sarpanch account. It can't be moderated. Its profile and messages are managed on the Sarpanch page.</p>
        ) : null}
        <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${user.official ? "hidden" : ""}`}>
          {can("users.coins") ? (
            <>
              <Button variant="gold" onClick={() => setAction("add-coins")}>
                <Coins className="h-4 w-4" /> Add coins
              </Button>
              <Button onClick={() => setAction("remove-coins")}>
                <MinusCircle className="h-4 w-4" /> Remove coins
              </Button>
            </>
          ) : null}
          {can("users.vip") ? (
            <Button variant="gold" onClick={() => setGrant("vip")}>
              <Crown className="h-4 w-4" /> Give VIP
            </Button>
          ) : null}
          {can("users.items") ? (
            <Button onClick={() => setGrant("item")}>
              <Gift className="h-4 w-4" /> Give item
            </Button>
          ) : null}
          <Button onClick={() => setAction("warn")}>
            <MessageSquareWarning className="h-4 w-4" /> Warn
          </Button>
          {user.mute ? (
            <Button variant="ok" busy={busy === "unmute"} onClick={() => run("unmute", () => adminApi.unmute(user.id), `${user.name} is unmuted`)}>
              <Volume2 className="h-4 w-4" /> Unmute
            </Button>
          ) : (
            <Button onClick={() => setAction("mute")}>
              <MicOff className="h-4 w-4" /> Mute
            </Button>
          )}
          <Button onClick={() => setAction("kick")}>
            <DoorOpen className="h-4 w-4" /> Kick
          </Button>
          {!can("users.ban") ? null : user.ban ? (
            <Button variant="ok" busy={busy === "unban"} onClick={() => run("unban", () => adminApi.unban(user.id), `${user.name} is unbanned`)}>
              <ShieldCheck className="h-4 w-4" /> Unban
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setAction("ban")}>
              <Ban className="h-4 w-4" /> Ban
            </Button>
          )}
        </div>

        {/* What's in force right now */}
        {user.ban || user.mute || user.kicks.length ? (
          <section className="rounded-2xl border border-coral/25 bg-coral/[0.05]">
            <h3 className="border-b border-coral/15 px-4 py-2.5 text-xs font-bold tracking-wider text-[#ff9095] uppercase">In force now</h3>
            <ul className="divide-y divide-line">
              {[user.ban, user.mute, ...user.kicks].filter((s): s is Sanction => Boolean(s)).map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {SANCTION_LABEL[s.kind]}
                      {s.kind === "kick" ? <RoomName id={s.roomId} /> : null} · <span className="font-normal text-muted">{untilText(s)}</span>
                    </p>
                    <p className="truncate text-xs text-muted">
                      {s.reason} · by {s.by}
                    </p>
                  </div>
                  {can(s.kind === "ban" ? "users.ban" : s.kind === "mute" ? "users.mute" : "users.kick") ? (
                    <Button size="sm" variant="ghost" busy={busy === s.id} onClick={() => run(s.id, () => adminApi.liftSanction(s.id), "Lifted")}>
                      <Undo2 className="h-3.5 w-3.5" /> Lift
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Chips
          label="Details"
          value={tab}
          onChange={setTab}
          options={[
            { value: "history", label: `History (${user.sanctions.length})` },
            ...(can("users.coins") ? [{ value: "coins" as Tab, label: `Coins (${user.coinTxs.length})` }] : []),
            ...(can("users.vip") || can("users.items") ? [{ value: "grants" as Tab, label: `VIP & items (${user.grants.length})` }] : []),
            { value: "reports", label: `Reports (${user.reports.length})` },
            { value: "note", label: "Private note" },
          ]}
        />

        {tab === "history" ? <History user={user} /> : null}
        {tab === "coins" ? (
          user.coinTxs.length ? (
            <ul className="divide-y divide-line rounded-2xl bg-ink ring-1 ring-line">
              {user.coinTxs.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`w-24 shrink-0 font-display text-[15px] font-bold ${t.amount > 0 ? "text-gold" : "text-[#ff9095]"}`}>
                    {t.amount > 0 ? "+" : "−"}
                    {fmtCoins(Math.abs(t.amount))}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{t.reason}</p>
                    <p className="text-xs text-muted">
                      {t.by} · {fmtDate(t.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No coin changes by admins yet.</Empty>
          )
        ) : null}
        {tab === "grants" ? <Grants user={user} busy={busy} onRevoke={(g) => run(g.id, () => adminApi.revokeGrant(g.id), `Took back ${g.label}`)} canRevoke={(g) => can(g.kind === "vip" ? "users.vip" : "users.items")} /> : null}
        {tab === "reports" ? (
          user.reports.length ? (
            <ul className="divide-y divide-line rounded-2xl bg-ink ring-1 ring-line">
              {user.reports.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-sm font-semibold">{r.reason}</p>
                    <Badge tone={r.status === "open" ? "coral" : "muted"}>{r.status}</Badge>
                  </div>
                  {r.note ? <p className="mt-1 text-sm text-cream/80">“{r.note}”</p> : null}
                  <p className="mt-1 text-xs text-muted">{timeAgo(r.createdAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nobody has reported {user.name}.</Empty>
          )
        ) : null}
        {tab === "note" ? (
          <div>
            <textarea
              rows={5}
              className="field resize-none"
              placeholder="Only admins see this. E.g. context from past reports."
              value={noteValue}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Private note"
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant="soft"
                disabled={note === null || note === user.note}
                busy={busy === "note"}
                onClick={() => run("note", () => adminApi.setNote(user.id, noteValue).then(() => setNote(null)), "Note saved")}
              >
                Save note
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <ActionDialog kind={action} user={user} onClose={() => setAction(null)} />
      <GrantDialog kind={grant} user={user} onClose={() => setGrant(null)} />
      {renaming ? <RenameDialog user={user} onClose={() => setRenaming(false)} /> : null}
    </>
  );
}

function Grants({ user, busy, onRevoke, canRevoke }: { user: AdminUserDetail; busy: string | null; onRevoke: (g: Grant) => void; canRevoke: (g: Grant) => boolean }) {
  if (!user.grants.length) return <Empty>No VIP or items given by staff yet.</Empty>;
  const now = Date.now();
  return (
    <ul className="divide-y divide-line rounded-2xl bg-ink ring-1 ring-line">
      {user.grants.map((g) => {
        const active = !g.revokedAt && (g.expiresAt === null || g.expiresAt > now);
        return (
          <li key={g.id} className="flex items-center gap-3 px-4 py-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold/10 text-gold">{g.kind === "vip" ? <Crown className="h-4 w-4" /> : <Gift className="h-4 w-4" />}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {g.label} <span className="font-normal text-muted">· {g.expiresAt === null ? "forever" : `until ${fmtDate(g.expiresAt)}`}</span>
              </p>
              <p className="truncate text-xs text-muted">
                {g.reason} · by {g.by} · {fmtDate(g.createdAt)}
                {g.revokedAt ? ` · taken back by ${g.revokedBy}` : !active ? " · ended" : ""}
              </p>
            </div>
            {active && canRevoke(g) ? (
              <Button size="sm" variant="ghost" busy={busy === g.id} onClick={() => onRevoke(g)}>
                <Undo2 className="h-3.5 w-3.5" /> Take back
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function History({ user }: { user: AdminUserDetail }) {
  if (!user.sanctions.length) return <Empty>No warnings, mutes, kicks or bans. Clean record.</Empty>;
  const now = Date.now();
  return (
    <ul className="divide-y divide-line rounded-2xl bg-ink ring-1 ring-line">
      {user.sanctions.map((s) => {
        const state = s.liftedAt ? `Lifted by ${s.liftedBy}` : s.kind === "warn" ? (s.acknowledgedAt ? "Seen" : "Sent") : s.expiresAt !== null && s.expiresAt <= now ? "Ended" : "Active";
        return (
          <li key={s.id} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <Badge tone={s.kind === "ban" ? "coral" : s.kind === "mute" ? "warn" : s.kind === "kick" ? "info" : "gold"}>{SANCTION_LABEL[s.kind]}</Badge>
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                {s.reason}
                {s.kind === "kick" ? <RoomName id={s.roomId} /> : null}
              </p>
              <span className={`text-xs font-semibold ${state === "Active" ? "text-[#ff9095]" : "text-muted"}`}>{state}</span>
            </div>
            {s.message ? <p className="mt-1 text-sm text-cream/75">“{s.message}”</p> : null}
            <p className="mt-1 text-xs text-muted">
              {s.by} · {fmtDate(s.createdAt)}
              {s.kind !== "warn" ? ` · ${s.expiresAt === null ? "permanent" : `ends ${fmtDate(s.expiresAt)}`}` : ""}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** Room names for kicks. Loaded once and shared. */
let roomNames: Promise<Record<string, string>> | null = null;
function RoomName({ id }: { id?: string }) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    roomNames ??= adminApi.listRooms().then((rs) => Object.fromEntries(rs.map((r) => [r.id, r.name])));
    roomNames.then((m) => id && setName(m[id] ?? null)).catch(() => undefined);
  }, [id]);
  return name ? <span className="font-normal text-muted"> · {name}</span> : null;
}

import { useMemo, useState } from "react";
import { Crown, DoorOpen, Lock, Pencil, Plus, Power, Search, Trash2, Undo2 } from "lucide-react";
import { adminApi, type AdminRoom, type AdminUser, type RoomInput } from "../api";
import { useAdmin } from "../context";
import { ActionDialog } from "../components/ActionDialog";
import { Avatar, Badge, Button, Card, Chips, Empty, ErrorNote, Loading, Modal, PageHeader, Toggle, untilText, useLoad } from "../components/ui";

/** Room categories used in the app (lib/app/data.ts). */
const CATEGORIES = ["Chai Adda", "Music", "Movies", "Bollywood", "Poetry", "Comedy", "Cricket", "Gaming", "Study", "Devotional"];

export function RoomsPage() {
  const { version, openUser, changed, toast, can } = useAdmin();
  const [form, setForm] = useState<AdminRoom | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const rooms = useLoad(() => adminApi.listRooms(), [version]);
  const users = useLoad(() => adminApi.listUsers(), [version]);
  const [q, setQ] = useState("");
  const [kick, setKick] = useState<{ user: AdminUser; roomId: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const userOf = (id: string) => users.data?.find((u) => u.id === id);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rooms.data ?? []).filter((r) => !term || r.name.toLowerCase().includes(term) || r.code.includes(term) || (userOf(r.hostId)?.name.toLowerCase().includes(term) ?? false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms.data, users.data, q]);

  const letBack = async (id: string) => {
    setBusy(id);
    try {
      await adminApi.liftSanction(id);
      toast("They can join the room again");
      changed();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(null);
    }
  };

  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast(done);
      changed();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(null);
      setConfirmDelete(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Rooms"
        sub="Create official rooms, edit or close any room, and see who's on mic. Kick someone from one room without banning them everywhere."
        right={
          can("rooms.create") ? (
            <Button variant="primary" onClick={() => setForm("new")}>
              <Plus className="h-4 w-4" /> Create room
            </Button>
          ) : null
        }
      />
      <div className="relative mb-4 md:w-96">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input className="field pl-9" placeholder="Room name, room ID or owner" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search rooms" />
      </div>
      {rooms.error ? <ErrorNote>{rooms.error}</ErrorNote> : null}
      {rooms.loading && !rooms.data ? (
        <Loading />
      ) : list.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((r) => {
            const host = userOf(r.hostId);
            return (
              <Card key={r.id}>
                <div className="flex items-start gap-3 border-b border-line px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-display text-[15px] font-bold">{r.name}</span>
                      {r.live ? <Badge tone="ok">Live</Badge> : <Badge>Closed</Badge>}
                      {r.isPrivate ? (
                        <Badge tone="info">
                          <Lock className="h-3 w-3" /> Private
                        </Badge>
                      ) : null}
                      {r.vipOnly ? (
                        <Badge tone="gold">
                          <Crown className="h-3 w-3" /> VIP only
                        </Badge>
                      ) : null}
                      {r.createdBy ? <Badge tone="coral">Made by {r.createdBy}</Badge> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Room ID {r.code} · Owner {host?.name ?? r.hostId} · {r.members} members
                      {r.category ? ` · ${r.category}` : ""}
                      {r.seats ? ` · ${r.seats} seats` : ""}
                    </p>
                  </div>
                  {can("rooms.edit") ? (
                    <div className="flex shrink-0 gap-1">
                      <button type="button" title="Edit room" aria-label={`Edit ${r.name}`} onClick={() => setForm(r)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-cream/5 hover:text-cream">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title={r.live ? "Close room" : "Reopen room"}
                        aria-label={r.live ? `Close ${r.name}` : `Reopen ${r.name}`}
                        disabled={busy === `live-${r.id}`}
                        onClick={() => act(`live-${r.id}`, () => adminApi.updateRoom(r.id, { live: !r.live }), r.live ? `${r.name} is closed` : `${r.name} is open again`)}
                        className={`grid h-8 w-8 place-items-center rounded-lg hover:bg-cream/5 ${r.live ? "text-muted hover:text-[#ff9095]" : "text-ok"}`}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                      {can("rooms.delete") ? (
                        confirmDelete === r.id ? (
                          <Button size="sm" variant="danger" busy={busy === `del-${r.id}`} onClick={() => act(`del-${r.id}`, () => adminApi.deleteRoom(r.id), `${r.name} deleted`)}>
                            Delete?
                          </Button>
                        ) : (
                          <button type="button" title="Delete room" aria-label={`Delete ${r.name}`} onClick={() => setConfirmDelete(r.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-cream/5 hover:text-[#ff9095]">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <ul className="divide-y divide-line">
                  {r.seated.map((id) => {
                    const u = userOf(id);
                    if (!u) return null;
                    const kicked = r.kicked.some((k) => k.userId === id);
                    return (
                      <li key={id} className="flex items-center gap-3 px-4 py-2.5">
                        <button type="button" onClick={() => openUser(id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                          <Avatar name={u.name} color={u.color} size={30} />
                          <span className="truncate text-sm font-semibold">{u.name}</span>
                          {id === r.hostId ? <Badge tone="gold">Owner</Badge> : null}
                          {u.mute ? <Badge tone="warn">Muted</Badge> : null}
                          {u.ban ? <Badge tone="coral">Banned</Badge> : null}
                          {kicked ? <Badge tone="info">Kicked</Badge> : null}
                        </button>
                        {id !== r.hostId && !kicked && can("users.kick") ? (
                          <Button size="sm" variant="ghost" onClick={() => setKick({ user: u, roomId: r.id })}>
                            <DoorOpen className="h-3.5 w-3.5" /> Kick
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {r.kicked.length ? (
                  <div className="border-t border-line bg-ink/60 px-4 py-3">
                    <p className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">Kicked from this room</p>
                    <ul className="space-y-2">
                      {r.kicked.map((k) => (
                        <li key={k.id} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm">
                            <button type="button" className="font-semibold hover:underline" onClick={() => openUser(k.userId)}>
                              {userOf(k.userId)?.name ?? k.userId}
                            </button>
                            <span className="text-muted"> · {k.reason} · {untilText(k)}</span>
                          </span>
                          <Button size="sm" variant="soft" busy={busy === k.id} onClick={() => letBack(k.id)}>
                            <Undo2 className="h-3.5 w-3.5" /> Let back in
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <Empty>No rooms match “{q}”.</Empty>
        </Card>
      )}
      {kick ? <ActionDialog kind="kick" user={kick.user} roomId={kick.roomId} onClose={() => setKick(null)} /> : null}
      <Modal open={form !== null} onClose={() => setForm(null)} title={form === "new" ? "Create a room" : form ? `Edit ${form.name}` : ""} wide>
        {form ? <RoomForm key={form === "new" ? "new" : form.id} room={form === "new" ? null : form} users={users.data ?? []} onClose={() => setForm(null)} /> : null}
      </Modal>
    </>
  );
}

function RoomForm({ room, users, onClose }: { room: AdminRoom | null; users: AdminUser[]; onClose: () => void }) {
  const { changed, toast } = useAdmin();
  const [f, setF] = useState<RoomInput>({
    name: room?.name ?? "",
    hostId: room?.hostId ?? "",
    topic: room?.topic ?? "",
    category: room?.category ?? "Chai Adda",
    seats: room?.seats ?? 10,
    isPrivate: room?.isPrivate ?? false,
    password: room?.password ?? "",
    vipOnly: room?.vipOnly ?? false,
    announcement: room?.announcement ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof RoomInput>(k: K, v: RoomInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const sortedUsers = useMemo(() => [...users].sort((a, b) => a.name.localeCompare(b.name)), [users]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = room ? await adminApi.updateRoom(room.id, f) : await adminApi.createRoom(f);
      toast(room ? `${saved.name} saved` : `${saved.name} is live. Room ID ${saved.code}`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor="rm-name">
          Room name
        </label>
        <input id="rm-name" className="field" maxLength={40} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Panchayat Official Mehfil" autoFocus={!room} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="rm-host">
            Owner
          </label>
          <select id="rm-host" className="field" value={f.hostId} onChange={(e) => set("hostId", e.target.value)}>
            <option value="">Pick a user…</option>
            {sortedUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · ID {u.uid}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="rm-cat">
            Category
          </label>
          <select id="rm-cat" className="field" value={f.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="rm-topic">
          Topic <span className="normal-case tracking-normal text-muted/70">(optional)</span>
        </label>
        <input id="rm-topic" className="field" value={f.topic ?? ""} onChange={(e) => set("topic", e.target.value)} placeholder="What's this room about?" />
      </div>
      <div>
        <span className="label">Mic seats</span>
        <Chips label="Mic seats" value={f.seats} onChange={(v) => set("seats", v)} options={[6, 9, 10, 12, 15].map((n) => ({ value: n, label: String(n) }))} />
      </div>
      <div className="space-y-3">
        <Toggle checked={f.isPrivate} onChange={(v) => set("isPrivate", v)} label="Private room" hint="People need a password to join." />
        {f.isPrivate ? (
          <input
            className="field w-48"
            inputMode="numeric"
            maxLength={6}
            aria-label="Room password"
            placeholder="4 to 6 digits"
            value={f.password ?? ""}
            onChange={(e) => set("password", e.target.value.replace(/\D/g, ""))}
          />
        ) : null}
        <Toggle checked={f.vipOnly} onChange={(v) => set("vipOnly", v)} label="VIP only" hint="Only VIP users can join." />
      </div>
      <div>
        <label className="label" htmlFor="rm-ann">
          Pinned announcement <span className="normal-case tracking-normal text-muted/70">(optional)</span>
        </label>
        <textarea id="rm-ann" rows={2} className="field resize-none" value={f.announcement ?? ""} onChange={(e) => set("announcement", e.target.value)} />
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button variant="primary" busy={busy} onClick={save} disabled={f.name.trim().length < 3 || !f.hostId} className="flex-[1.4]">
          {room ? "Save" : "Create room"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Rooms, live from the backend (/api/v1/admin/rooms).
 *
 * Create a room for any user (it shows up for everyone in the app like any other room), edit or close any
 * room, and make any user an admin of a room: admins can moderate seats, the mic queue, kick and ban there.
 */
import { useCallback, useEffect, useState } from "react";
import { Lock, Pencil, Plus, Power, Search, ShieldPlus, X } from "lucide-react";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorNote, Loading, Modal, PageHeader } from "../components/ui";

type RoomAdminUser = { userId: number; name: string; publicId?: number };
type LiveRoom = {
  id: number;
  name: string;
  description?: string | null;
  category?: string | null;
  roomType: string;
  isPrivate: boolean;
  maxParticipants: number;
  status: string;
  ownerId: number;
  owner?: string;
  ownerPublicId?: number;
  online: number;
  createdAt?: string;
  admins: RoomAdminUser[];
};
type FoundUser = { id: number; publicId: number; name: string; email: string };

const CATEGORIES = ["Chai Adda", "Music", "Movies", "Bollywood", "Poetry", "Comedy", "Cricket", "Gaming", "Study", "Devotional"];
const base = "/api/v1/admin/rooms";

/** Search real users by name, email or ID. */
function UserPicker({ onPick, placeholder = "Search a user by name, email or ID" }: { onPick: (u: FoundUser) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<FoundUser[]>([]);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRows([]);
      return;
    }
    const t = window.setTimeout(() => {
      apiRequest<{ content: FoundUser[] }>(`/api/v1/admin/users?q=${encodeURIComponent(term)}&size=8`)
        .then((r) => setRows(r.content ?? []))
        .catch(() => setRows([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input className="field pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label="Search users" />
      </div>
      {rows.length ? (
        <ul className="mt-1 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {rows.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-cream/5"
                onClick={() => {
                  onPick(u);
                  setQ("");
                  setRows([]);
                }}
              >
                <span className="truncate font-semibold">{u.name}</span>
                <span className="shrink-0 text-xs text-muted">ID {u.publicId}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function RoomsLivePage() {
  const { toast, version } = useAdmin();
  const [rooms, setRooms] = useState<LiveRoom[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<LiveRoom | "new" | null>(null);
  const [adminsOf, setAdminsOf] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    apiRequest<LiveRoom[]>(`${base}?q=${encodeURIComponent(q.trim())}`)
      .then((r) => {
        setRooms(r);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load rooms"));
  }, [q]);
  useEffect(() => {
    const t = window.setTimeout(load, q ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [load, q, version]);

  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast(done);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(null);
    }
  };

  const room = adminsOf === null ? null : rooms?.find((r) => r.id === adminsOf) ?? null;

  return (
    <>
      <PageHeader
        title="Rooms"
        sub="Create a room for any user: it shows in the app's room list for everyone. Edit or close any room, and make any user an admin of a room."
        right={
          <Button variant="primary" onClick={() => setForm("new")}>
            <Plus className="h-4 w-4" /> Create room
          </Button>
        }
      />
      <div className="relative mb-4 md:w-96">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input className="field pl-9" placeholder="Room name, room ID or owner" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search rooms" />
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!rooms && !error ? (
        <Loading />
      ) : rooms && rooms.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {rooms.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-display text-[15px] font-bold">{r.name}</span>
                    {r.status === "ACTIVE" ? <Badge tone="ok">Live</Badge> : <Badge>Closed</Badge>}
                    {r.isPrivate ? (
                      <Badge tone="info">
                        <Lock className="h-3 w-3" /> Private
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Room ID {r.id} · Owner {r.owner ?? r.ownerId} · {r.online} inside · {r.maxParticipants} seats{r.category ? ` · ${r.category}` : ""}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-bold text-muted uppercase">Admins</span>
                    {r.admins.length ? (
                      r.admins.map((a) => (
                        <span key={a.userId} className="inline-flex items-center gap-1 rounded-full bg-cream/8 px-2 py-0.5 font-semibold">
                          {a.name}
                          <button type="button" aria-label={`Remove ${a.name} as admin`} className="text-muted hover:text-[#ff9095]" disabled={busy === `rm-${r.id}-${a.userId}`} onClick={() => act(`rm-${r.id}-${a.userId}`, () => apiRequest(`${base}/${r.id}/admins/${a.userId}`, { method: "DELETE" }), `${a.name} is no longer an admin`)}>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-muted">none yet</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" title="Make a user admin" aria-label={`Add an admin to ${r.name}`} onClick={() => setAdminsOf(r.id)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-cream/5 hover:text-cream">
                    <ShieldPlus className="h-4 w-4" />
                  </button>
                  <button type="button" title="Edit room" aria-label={`Edit ${r.name}`} onClick={() => setForm(r)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-cream/5 hover:text-cream">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={r.status === "ACTIVE" ? "Close room" : "Reopen room"}
                    aria-label={r.status === "ACTIVE" ? `Close ${r.name}` : `Reopen ${r.name}`}
                    disabled={busy === `live-${r.id}`}
                    onClick={() =>
                      window.confirm(r.status === "ACTIVE" ? `Close ${r.name}? Everyone inside is removed.` : `Open ${r.name} again?`) &&
                      act(`live-${r.id}`, () => (r.status === "ACTIVE" ? apiRequest(`${base}/${r.id}`, { method: "DELETE" }) : apiRequest(`${base}/${r.id}/reopen`, { method: "POST" })), r.status === "ACTIVE" ? `${r.name} is closed` : `${r.name} is open again`)
                    }
                    className={`grid h-8 w-8 place-items-center rounded-lg hover:bg-cream/5 ${r.status === "ACTIVE" ? "text-muted hover:text-[#ff9095]" : "text-ok"}`}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Empty>No rooms yet.</Empty>
        </Card>
      )}

      <Modal open={form !== null} onClose={() => setForm(null)} title={form === "new" ? "Create a room" : form ? `Edit ${form.name}` : ""} wide>
        {form ? (
          <RoomForm
            key={form === "new" ? "new" : form.id}
            room={form === "new" ? null : form}
            onClose={() => setForm(null)}
            onSaved={() => {
              setForm(null);
              load();
            }}
          />
        ) : null}
      </Modal>

      <Modal open={room !== null} onClose={() => setAdminsOf(null)} title={room ? `Admins of ${room.name}` : ""}>
        {room ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">Pick any user to make them an admin of this room. They can moderate seats, the mic queue, kick and ban there.</p>
            <UserPicker
              onPick={(u) =>
                void act(`add-${room.id}-${u.id}`, () => apiRequest(`${base}/${room.id}/admins`, { method: "POST", body: { userId: u.id } }), `${u.name} is now an admin of ${room.name}`)
              }
            />
            <ul className="space-y-2">
              {room.admins.map((a) => (
                <li key={a.userId} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm">
                  <span className="font-semibold">{a.name}</span>
                  <Button size="sm" variant="danger" onClick={() => act(`rm-${room.id}-${a.userId}`, () => apiRequest(`${base}/${room.id}/admins/${a.userId}`, { method: "DELETE" }), `${a.name} is no longer an admin`)}>
                    Remove
                  </Button>
                </li>
              ))}
              {!room.admins.length ? <li className="text-sm text-muted">No admins yet.</li> : null}
            </ul>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function RoomForm({ room, onClose, onSaved }: { room: LiveRoom | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useAdmin();
  const [name, setName] = useState(room?.name ?? "");
  const [description, setDescription] = useState(room?.description ?? "");
  const [category, setCategory] = useState(room?.category ?? "Chai Adda");
  const [seats, setSeats] = useState(String(room?.maxParticipants ?? 10));
  const [isPrivate, setIsPrivate] = useState(room?.isPrivate ?? false);
  const [password, setPassword] = useState("");
  const [owner, setOwner] = useState<{ id: number; name: string } | null>(room ? { id: room.ownerId, name: room.owner ?? String(room.ownerId) } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const body = { name: name.trim(), description, category, maxParticipants: Number(seats), isPrivate, password: isPrivate && password ? password : undefined, ownerId: owner?.id };
      if (room) await apiRequest(`${base}/${room.id}`, { method: "PATCH", body });
      else await apiRequest(`${base}`, { method: "POST", body });
      toast(room ? "Room saved" : "Room created. Everyone can see it in the app now.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor="lr-name">
          Room name
        </label>
        <input id="lr-name" className="field" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Panchayat Official Mehfil" autoFocus={!room} />
      </div>
      <div>
        <span className="label">Owner</span>
        {owner ? (
          <p className="mb-2 flex items-center gap-2 text-sm">
            <Badge tone="gold">{owner.name}</Badge>
            <button type="button" className="text-xs text-muted underline" onClick={() => setOwner(null)}>
              change
            </button>
          </p>
        ) : (
          <UserPicker onPick={(u) => setOwner({ id: u.id, name: u.name })} placeholder="Search the user who will own this room" />
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="lr-cat">
            Category
          </label>
          <select id="lr-cat" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="lr-seats">
            Capacity (2 to 50)
          </label>
          <input id="lr-seats" className="field" inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, ""))} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="lr-desc">
          About <span className="normal-case tracking-normal text-muted/70">(optional)</span>
        </label>
        <textarea id="lr-desc" rows={2} maxLength={500} className="field resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} /> Private room (needs a 4 digit password, hidden from the list)
        </label>
        {isPrivate ? <input className="field w-40" inputMode="numeric" maxLength={4} aria-label="Room password" placeholder="4 digits" value={password} onChange={(e) => setPassword(e.target.value.replace(/\D/g, ""))} /> : null}
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button variant="primary" busy={busy} onClick={save} disabled={name.trim().length < 3 || !owner} className="flex-[1.4]">
          {room ? "Save" : "Create room"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Demo implementation of the admin API.
 *
 * Users and rooms come from seed.ts. Everything admins do (coins, bans,
 * mutes, warnings, kicks, notes, report decisions and the activity log) is
 * saved as one JSON object in localStorage, so it survives reloads in this
 * browser only. The rules here are the ones the backend should enforce too.
 */
import { AdminError, MAX_COIN_CHANGE } from "./errors";
import { checkUpload, clearLocalFiles, deleteLocalFile, saveLocalFile } from "./files";
import type { AdminApi } from "./index";
import { can, COIN_LIMIT, ROLE_LABEL, type Permission, type Role, type StaffMember } from "./roles";
import { seedRedPackets } from "./catalog-seed";
import { SEED_ROOMS, SEED_USERS, seedDb, type SeedUser } from "./seed";
import { actorName, getSession, OLD_SHARED_PASSWORD, startingPassword } from "./session";
import type { AdminDb, AdminRoom, AdminUser, AuditAction, AuditEntry, CoinTx, Duration, GiftItem, Grant, Product, Report, Sanction, SanctionKind, SarpanchMessage, StoredRoom } from "./types";

const KEY = "panchayat-admin-demo-v1";

let seq = 1;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function readDb(): AdminDb {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const db = { ...seedDb(), ...(JSON.parse(raw) as Partial<AdminDb>) };
      // Saved before red packet prices existed: start them at the app's prices
      // (or saved with coin prices from before they moved to rupees)
      if (!Array.isArray(db.pricing.redPackets) || db.pricing.redPackets.some((r) => typeof r.priceInr !== "number")) db.pricing = { ...db.pricing, redPackets: seedRedPackets() };
      // Accounts saved with the old shared password (or none) get their own one from .env.local
      return { ...db, staff: db.staff.map((s) => (s.password === OLD_SHARED_PASSWORD || !s.password ? { ...s, password: startingPassword(s.username) } : s)) };
    }
  } catch {
    /* unreadable: start from the seed */
  }
  return seedDb();
}

/** Read, change and save in one step. */
function updateDb(change: (db: AdminDb) => AdminDb) {
  const next = change(readDb());
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    throw new AdminError("Couldn't save. Browser storage is full or blocked.");
  }
  return next;
}

const isActive = (s: Sanction, now = Date.now()) => !s.liftedAt && (s.expiresAt === null || s.expiresAt > now);

function activeOf(db: AdminDb, userId: string, kind: SanctionKind, now = Date.now()) {
  return db.sanctions.filter((s) => s.userId === userId && s.kind === kind && isActive(s, now)).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

/* ---------------- staff and permissions ---------------- */

/** The signed-in staff member, read fresh so role changes and disabled accounts apply at once. */
function me(db: AdminDb): StaffMember {
  const session = getSession();
  // Signed in through the backend: it owns staff accounts, so use the role it gave us
  if (session?.token) return { username: session.username, name: session.name, role: session.role, title: session.title, active: true, createdAt: 0 };
  const username = session?.username;
  const m = db.staff.find((x) => x.username === username);
  if (!m || !m.active) throw new AdminError("Your staff account is disabled or was removed. Sign out and contact the panel owner.");
  return m;
}

/** Same check the backend makes on every request. */
function requirePerm(p: Permission, db = readDb()) {
  const m = me(db);
  // Never say which role could do it: staff only learn about their own options
  if (!can(m.role, p)) throw new AdminError("You don't have access to this.");
  return m;
}

/**
 * Which log entries each role sees. Staff only see actions they can take
 * themselves, so nobody learns what other roles are allowed to do.
 */
const AUDIT_PERMISSION: Record<AuditAction, Permission | null> = {
  ban: "users.ban",
  unban: "users.ban",
  mute: "users.mute",
  unmute: "users.mute",
  warn: "users.warn",
  kick: "users.kick",
  unkick: "users.kick",
  report: "reports.handle",
  note: null,
  coins: "users.coins",
  vip: "users.vip",
  item: "users.items",
  room: "rooms.edit",
  gift: "gifts.manage",
  product: "store.manage",
  pricing: "pricing.edit",
  staff: "staff.manage",
  settings: "settings.edit",
  profile: "users.rename",
  sarpanch: "sarpanch.manage",
};
const auditVisible = (role: Role, a: AuditAction) => AUDIT_PERMISSION[a] === null || can(role, AUDIT_PERMISSION[a]!);

const isGrantActive = (g: Grant, now = Date.now()) => !g.revokedAt && (g.expiresAt === null || g.expiresAt > now);

function toAdminUser(seed: SeedUser, db: AdminDb, now = Date.now()): AdminUser {
  const { bio: _bio, coins: base, ...rest } = seed;
  const vipGrant = db.grants.filter((g) => g.userId === seed.id && g.kind === "vip" && isGrantActive(g, now)).sort((a, b) => (b.vipLevel ?? 0) - (a.vipLevel ?? 0))[0] ?? null;
  const coins = base + db.coinTxs.filter((t) => t.userId === seed.id).reduce((s, t) => s + t.amount, 0);
  const ban = activeOf(db, seed.id, "ban", now);
  const mute = activeOf(db, seed.id, "mute", now);
  const edits = seed.official ? { name: db.sarpanch.name, handle: db.sarpanch.handle } : (db.profileEdits[seed.id] ?? {});
  return {
    ...rest,
    ...edits,
    vip: Math.max(rest.vip, vipGrant?.vipLevel ?? 0),
    vipGrant,
    coins: Math.max(0, coins),
    ban,
    mute,
    kicks: db.sanctions.filter((s) => s.userId === seed.id && s.kind === "kick" && isActive(s, now)),
    warnings: db.sanctions.filter((s) => s.userId === seed.id && s.kind === "warn" && !s.liftedAt).length,
    openReports: db.reports.filter((r) => r.userId === seed.id && r.status === "open").length,
    status: ban ? "banned" : mute ? "muted" : "active",
  };
}

function seedUser(id: string) {
  const s = SEED_USERS.find((u) => u.id === id);
  if (!s) throw new AdminError("User not found");
  return s;
}

/** Current display name, including renames made from the panel. */
function nameOf(id: string) {
  const db = readDb();
  if (id === SARPANCH_ID) return db.sarpanch.name;
  return db.profileEdits[id]?.name ?? SEED_USERS.find((u) => u.id === id)?.name ?? id;
}

export const SARPANCH_ID = "sarpanch";
/** Names only the official account may use. */
const RESERVED_HANDLES = ["sarpanch", "panchayat", "admin", "official", "support", "moderator"];

function checkHandle(raw: string, userId: string, db: AdminDb) {
  const handle = raw.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_.]{3,20}$/.test(handle)) throw new AdminError("Usernames are 3 to 20 letters, numbers, dots or underscores");
  if (userId !== SARPANCH_ID && RESERVED_HANDLES.some((r) => handle.includes(r))) throw new AdminError(`@${handle} is reserved for the official account`);
  const taken = SEED_USERS.some((s) => s.id !== userId && toAdminUser(s, db).handle.toLowerCase() === `@${handle}`);
  if (taken) throw new AdminError(`@${handle} is already taken`);
  return `@${handle}`;
}
const roomName = (id?: string) => allRooms(readDb()).find((r) => r.id === id)?.name ?? "a room";

/** Sample rooms (with any edits from the panel) plus rooms created in the panel. */
function allRooms(db: AdminDb): StoredRoom[] {
  const seedIds = new Set(SEED_ROOMS.map((r) => r.id));
  return [...SEED_ROOMS.map((r) => db.rooms.find((x) => x.id === r.id) ?? r), ...db.rooms.filter((r) => !seedIds.has(r.id))].filter((r) => !db.deletedRooms.includes(r.id));
}

function withKicks(r: StoredRoom, db: AdminDb, now = Date.now()): AdminRoom {
  return { ...r, kicked: db.sanctions.filter((s) => s.kind === "kick" && s.roomId === r.id && isActive(s, now)) };
}

const coinText = (n: number) => n.toLocaleString("en-IN");
const daysText = (d: number | null) => (d === null ? "forever" : `for ${d} day${d === 1 ? "" : "s"}`);

function wholeCoins(n: number, what: string) {
  if (!Number.isInteger(n) || n < 0) throw new AdminError(`${what} must be a whole number of coins`);
  if (n > 100_000_000) throw new AdminError(`${what} looks too high. Check for an extra zero.`);
  return n;
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "item";

function uniqueId(base: string, taken: string[]) {
  let id = base;
  for (let i = 2; taken.includes(id); i++) id = `${base}-${i}`;
  return id;
}

/** A short wait so loading states show, like a real network call. */
const delay = <T,>(v: T) => new Promise<T>((r) => window.setTimeout(() => r(v), 150));

function audit(db: AdminDb, action: AuditAction, detail: string, userId?: string): AdminDb {
  const entry: AuditEntry = { id: newId("log"), at: Date.now(), by: actorName(), action, userId, detail };
  return { ...db, audit: [entry, ...db.audit].slice(0, 1000) };
}

export function durationText(d: Duration) {
  if (d === null) return "permanently";
  const h = d / 3_600_000;
  return h < 1 ? `for ${Math.round(d / 60_000)} min` : h < 48 ? `for ${Math.round(h)} h` : `for ${Math.round(h / 24)} days`;
}

function requireReason(reason: string) {
  if (!reason.trim()) throw new AdminError("Add a reason. It's saved in the activity log.");
  return reason.trim();
}

const SANCTION_PERM: Record<SanctionKind, Permission> = { ban: "users.ban", mute: "users.mute", warn: "users.warn", kick: "users.kick" };

function addSanction(userId: string, kind: SanctionKind, reason: string, duration: Duration, extra: Partial<Sanction>, detail: string): Sanction {
  requirePerm(SANCTION_PERM[kind]);
  if (seedUser(userId).official) throw new AdminError("The Sarpanch account is official and can't be warned, muted, kicked or banned.");
  const now = Date.now();
  const s: Sanction = { id: newId(kind), userId, kind, reason: requireReason(reason), createdAt: now, expiresAt: duration === null ? null : now + duration, by: actorName(), ...extra };
  updateDb((db) => {
    // A new ban or mute replaces the current one; a new kick replaces one from the same room
    const replaced = db.sanctions.map((x) =>
      x.userId === userId && x.kind === kind && x.kind !== "warn" && (kind !== "kick" || x.roomId === extra.roomId) && isActive(x, now) ? { ...x, liftedAt: now, liftedBy: s.by } : x,
    );
    return audit({ ...db, sanctions: [s, ...replaced] }, kind, detail, userId);
  });
  return s;
}

function liftKind(userId: string, kind: "ban" | "mute") {
  requirePerm(SANCTION_PERM[kind]);
  const now = Date.now();
  let found = false;
  updateDb((db) => {
    const sanctions = db.sanctions.map((s) => {
      if (s.userId === userId && s.kind === kind && isActive(s, now)) {
        found = true;
        return { ...s, liftedAt: now, liftedBy: actorName() };
      }
      return s;
    });
    return found ? audit({ ...db, sanctions }, kind === "ban" ? "unban" : "unmute", `${kind === "ban" ? "Unbanned" : "Unmuted"} ${nameOf(userId)}`, userId) : db;
  });
  if (!found) throw new AdminError(kind === "ban" ? "This user isn't banned" : "This user isn't muted");
}

export const localApi: AdminApi = {
  mode: "local",

  async login(username, password) {
    const u = username.trim().toLowerCase();
    if (!u) throw new AdminError("Enter your username");
    const m = readDb().staff.find((x) => x.username === u);
    if (m && !m.password) throw new AdminError("No password is set for this account yet. Add it to .env.local and restart the panel.");
    if (!m || m.password !== password) throw new AdminError("Wrong username or password");
    if (!m.active) throw new AdminError("This account is disabled.");
    return delay({ username: m.username, name: m.name, role: m.role, title: m.title });
  },

  async stats() {
    const db = readDb();
    const users = SEED_USERS.map((s) => toAdminUser(s, db));
    const weekAgo = Date.now() - 7 * 86_400_000;
    const today = new Date().setHours(0, 0, 0, 0);
    return delay({
      users: users.length,
      online: users.filter((u) => u.online && !u.ban).length,
      banned: users.filter((u) => u.ban).length,
      muted: users.filter((u) => u.mute).length,
      openReports: db.reports.filter((r) => r.status === "open").length,
      coinsGranted7d: db.coinTxs.filter((t) => t.createdAt >= weekAgo && t.amount > 0).reduce((s, t) => s + t.amount, 0),
      actionsToday: db.audit.filter((a) => a.at >= today && auditVisible(me(db).role, a.action)).length,
    });
  },

  async listUsers(q = "", filter = "all") {
    const db = readDb();
    const term = q.trim().toLowerCase().replace(/^@/, "");
    return delay(
      SEED_USERS.map((s) => toAdminUser(s, db))
        .filter((u) => !term || u.name.toLowerCase().includes(term) || u.handle.toLowerCase().includes(term) || u.uid.includes(term))
        .filter((u) =>
          filter === "all" ? true
          : filter === "active" ? u.status === "active"
          : filter === "banned" ? Boolean(u.ban)
          : filter === "muted" ? Boolean(u.mute)
          : filter === "warned" ? u.warnings > 0
          : u.openReports > 0,
        ),
    );
  },

  async getUser(id) {
    const db = readDb();
    const s = seedUser(id);
    return delay({
      ...toAdminUser(s, db),
      bio: s.official ? db.sarpanch.bio : s.bio,
      sanctions: db.sanctions.filter((x) => x.userId === id).sort((a, b) => b.createdAt - a.createdAt),
      coinTxs: db.coinTxs.filter((t) => t.userId === id).sort((a, b) => b.createdAt - a.createdAt),
      reports: db.reports.filter((r) => r.userId === id).sort((a, b) => b.createdAt - a.createdAt),
      note: db.notes[id] ?? "",
      grants: db.grants.filter((g) => g.userId === id).sort((a, b) => b.createdAt - a.createdAt),
    });
  },

  async adjustCoins(userId, amount, reason) {
    const staff = requirePerm("users.coins");
    const limit = Math.min(MAX_COIN_CHANGE, COIN_LIMIT[staff.role]);
    if (!Number.isInteger(amount) || amount === 0) throw new AdminError("Enter a whole number of coins");
    if (Math.abs(amount) > limit) throw new AdminError(`The most you can change at once is ${limit.toLocaleString("en-IN")} coins`);
    const why = requireReason(reason);
    const user = toAdminUser(seedUser(userId), readDb());
    if (user.coins + amount < 0) throw new AdminError(`${user.name} only has ${user.coins.toLocaleString("en-IN")} coins`);
    const tx: CoinTx = { id: newId("tx"), userId, amount, reason: why, createdAt: Date.now(), by: actorName() };
    const abs = Math.abs(amount).toLocaleString("en-IN");
    updateDb((db) => audit({ ...db, coinTxs: [tx, ...db.coinTxs] }, "coins", `${amount > 0 ? `Added ${abs} coins to` : `Removed ${abs} coins from`} ${user.name}: ${why}`, userId));
    return delay(tx);
  },

  async ban(userId, reason, duration, message) {
    return delay(addSanction(userId, "ban", reason, duration, { message: message?.trim() || undefined }, `Banned ${nameOf(userId)} ${durationText(duration)}: ${reason.trim()}`));
  },
  async unban(userId) {
    liftKind(userId, "ban");
    return delay(undefined);
  },
  async mute(userId, reason, duration) {
    return delay(addSanction(userId, "mute", reason, duration, {}, `Muted ${nameOf(userId)} ${durationText(duration)}: ${reason.trim()}`));
  },
  async unmute(userId) {
    liftKind(userId, "mute");
    return delay(undefined);
  },
  async warn(userId, reason, message) {
    if (!message.trim()) throw new AdminError("Write the message the user will see");
    return delay(addSanction(userId, "warn", reason, null, { message: message.trim() }, `Warned ${nameOf(userId)}: ${reason.trim()}`));
  },
  async kick(userId, roomId, reason, duration) {
    const room = allRooms(readDb()).find((r) => r.id === roomId);
    if (!room) throw new AdminError("Pick a room");
    if (room.hostId === userId) throw new AdminError("You can't kick the owner from their own room. Ban or mute them instead.");
    return delay(addSanction(userId, "kick", reason, duration, { roomId }, `Kicked ${nameOf(userId)} from ${room.name} ${durationText(duration)}: ${reason.trim()}`));
  },
  async liftSanction(id) {
    const found = readDb().sanctions.find((x) => x.id === id);
    if (found) requirePerm(SANCTION_PERM[found.kind]);
    updateDb((db) => {
      const s = db.sanctions.find((x) => x.id === id);
      if (!s || s.liftedAt) return db;
      const action: AuditAction = s.kind === "ban" ? "unban" : s.kind === "mute" ? "unmute" : s.kind === "kick" ? "unkick" : "warn";
      const detail =
        s.kind === "kick" ? `Let ${nameOf(s.userId)} back into ${roomName(s.roomId)}`
        : s.kind === "warn" ? `Withdrew a warning for ${nameOf(s.userId)}`
        : `${s.kind === "ban" ? "Unbanned" : "Unmuted"} ${nameOf(s.userId)}`;
      return audit({ ...db, sanctions: db.sanctions.map((x) => (x.id === id ? { ...x, liftedAt: Date.now(), liftedBy: actorName() } : x)) }, action, detail, s.userId);
    });
    return delay(undefined);
  },
  async setNote(userId, note) {
    me(readDb());
    updateDb((db) => audit({ ...db, notes: { ...db.notes, [userId]: note.trim() } }, "note", `Updated the private note on ${nameOf(userId)}`, userId));
    return delay(undefined);
  },

  async listRooms() {
    const db = readDb();
    const now = Date.now();
    return delay(allRooms(db).map((r) => withKicks(r, db, now)));
  },

  async listReports(status) {
    const db = readDb();
    return delay(db.reports.filter((r) => !status || r.status === status).sort((a, b) => b.createdAt - a.createdAt));
  },
  async setReportStatus(id, status) {
    requirePerm("reports.handle");
    let out: Report | undefined;
    updateDb((db) => {
      const r = db.reports.find((x) => x.id === id);
      if (!r) return db;
      const updated: Report = { ...r, status, handledBy: actorName(), handledAt: Date.now() };
      out = updated;
      const label = status === "resolved" ? "Resolved" : status === "dismissed" ? "Dismissed" : "Reopened";
      return audit({ ...db, reports: db.reports.map((x) => (x.id === id ? updated : x)) }, "report", `${label} a report on ${nameOf(r.userId)} (${r.reason})`, r.userId);
    });
    if (!out) throw new AdminError("Report not found");
    return delay(out);
  },

  async listAudit(limit = 200) {
    const db = readDb();
    const role = me(db).role;
    return delay(db.audit.filter((e) => auditVisible(role, e.action)).slice(0, limit));
  },

  async resetDemo() {
    requirePerm("demo.reset");
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* nothing saved */
    }
    await clearLocalFiles();
    return delay(undefined);
  },

  /* ---------------- VIP and items ---------------- */

  async grantVip(userId, level, days, reason) {
    requirePerm("users.vip");
    const user = seedUser(userId);
    const why = requireReason(reason);
    if (!Number.isInteger(level) || level < 1 || level > 10) throw new AdminError("Pick a VIP level from 1 to 10");
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) throw new AdminError("Pick how many days, from 1 to 3650");
    const now = Date.now();
    const g: Grant = { id: newId("vip"), userId, kind: "vip", vipLevel: level, label: `VIP ${level}`, reason: why, createdAt: now, expiresAt: days === null ? null : now + days * 86_400_000, by: actorName() };
    updateDb((db) => {
      // A new VIP grant replaces the current one
      const grants = db.grants.map((x) => (x.userId === userId && x.kind === "vip" && isGrantActive(x, now) ? { ...x, revokedAt: now, revokedBy: g.by } : x));
      return audit({ ...db, grants: [g, ...grants] }, "vip", `Gave ${user.name} VIP ${level} ${daysText(days)}: ${why}`, userId);
    });
    return delay(g);
  },

  async grantItem(userId, productId, days, reason) {
    const db0 = readDb();
    requirePerm("users.items", db0);
    const user = seedUser(userId);
    const why = requireReason(reason);
    const product = db0.products.find((x) => x.id === productId);
    if (!product) throw new AdminError("Pick an item");
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) throw new AdminError("Pick how many days, from 1 to 3650");
    const now = Date.now();
    const g: Grant = { id: newId("item"), userId, kind: "item", productId, label: product.name, reason: why, createdAt: now, expiresAt: days === null ? null : now + days * 86_400_000, by: actorName() };
    updateDb((db) => audit({ ...db, grants: [g, ...db.grants] }, "item", `Gave ${user.name} ${KIND_NAME[product.kind]} “${product.name}” ${daysText(days)}: ${why}`, userId));
    return delay(g);
  },

  async revokeGrant(id) {
    const g = readDb().grants.find((x) => x.id === id);
    if (!g) throw new AdminError("Not found");
    requirePerm(g.kind === "vip" ? "users.vip" : "users.items");
    updateDb((db) =>
      audit(
        { ...db, grants: db.grants.map((x) => (x.id === id ? { ...x, revokedAt: Date.now(), revokedBy: actorName() } : x)) },
        g.kind === "vip" ? "vip" : "item",
        `Took back ${g.label} from ${nameOf(g.userId)}`,
        g.userId,
      ),
    );
    return delay(undefined);
  },

  /* ---------------- rooms ---------------- */

  async createRoom(input) {
    const db0 = readDb();
    requirePerm("rooms.create", db0);
    const name = input.name.trim();
    if (name.length < 3) throw new AdminError("Give the room a name (3 letters or more)");
    if (name.length > 40) throw new AdminError("Room names can be up to 40 letters");
    seedUser(input.hostId);
    if (input.seats < 2 || input.seats > 20) throw new AdminError("Seats must be between 2 and 20");
    if (input.isPrivate && !/^\d{4,6}$/.test(input.password ?? "")) throw new AdminError("Private rooms need a 4 to 6 digit password");
    const rooms = allRooms(db0);
    let code = "";
    do code = String(100_000 + Math.floor(Math.random() * 900_000));
    while (rooms.some((r) => r.code === code));
    const now = Date.now();
    const room: StoredRoom = {
      id: uniqueId(`r-${slug(name)}`, rooms.map((r) => r.id)),
      code,
      name,
      hostId: input.hostId,
      topic: input.topic?.trim() || undefined,
      category: input.category,
      seats: input.seats,
      isPrivate: input.isPrivate,
      password: input.isPrivate ? input.password : undefined,
      vipOnly: input.vipOnly,
      announcement: input.announcement?.trim() || undefined,
      members: 0,
      live: true,
      seated: [input.hostId],
      createdBy: actorName(),
      createdAt: now,
    };
    const db = updateDb((d) => audit({ ...d, rooms: [...d.rooms, room] }, "room", `Created room “${name}” (ID ${code}) for ${nameOf(input.hostId)}`, input.hostId));
    return delay(withKicks(room, db));
  },

  async updateRoom(id, patch) {
    const db0 = readDb();
    requirePerm("rooms.edit", db0);
    const cur = allRooms(db0).find((r) => r.id === id);
    if (!cur) throw new AdminError("Room not found");
    const next: StoredRoom = { ...cur, ...patch, name: patch.name?.trim() || cur.name };
    if (patch.hostId) {
      seedUser(patch.hostId);
      if (!next.seated.includes(patch.hostId)) next.seated = [patch.hostId, ...next.seated];
    }
    if (next.isPrivate && !/^\d{4,6}$/.test(next.password ?? "")) throw new AdminError("Private rooms need a 4 to 6 digit password");
    if (!next.isPrivate) next.password = undefined;
    const what = patch.live === false ? "Closed" : patch.live === true ? "Reopened" : "Edited";
    const db = updateDb((d) => audit({ ...d, rooms: [...d.rooms.filter((r) => r.id !== id), next] }, "room", `${what} room “${next.name}” (ID ${next.code})`));
    return delay(withKicks(next, db));
  },

  async deleteRoom(id) {
    const db0 = readDb();
    requirePerm("rooms.delete", db0);
    const cur = allRooms(db0).find((r) => r.id === id);
    if (!cur) throw new AdminError("Room not found");
    updateDb((d) => audit({ ...d, rooms: d.rooms.filter((r) => r.id !== id), deletedRooms: [...d.deletedRooms, id] }, "room", `Deleted room “${cur.name}” (ID ${cur.code})`));
    return delay(undefined);
  },

  /* ---------------- gifts ---------------- */

  async listGifts() {
    return delay([...readDb().gifts].sort((a, b) => a.sort - b.sort || a.cost - b.cost));
  },

  async saveGift(input) {
    const db0 = readDb();
    const staff = requirePerm("gifts.manage", db0);
    const name = input.name.trim();
    if (!name) throw new AdminError("Give the gift a name");
    wholeCoins(input.cost, "The price");
    if (input.cost < 1) throw new AdminError("A gift costs at least 1 coin");
    const cur = input.id ? db0.gifts.find((x) => x.id === input.id) : undefined;
    if (input.id && !cur) throw new AdminError("Gift not found");
    if (cur && cur.cost !== input.cost && !can(staff.role, "pricing.edit")) throw new AdminError("You can't change the price of an existing gift");
    if (db0.gifts.some((x) => x.id !== cur?.id && x.name.toLowerCase() === name.toLowerCase())) throw new AdminError(`There's already a gift called “${name}”`);
    const gift: GiftItem = {
      ...cur,
      ...input,
      id: cur?.id ?? uniqueId(slug(name), db0.gifts.map((x) => x.id)),
      name,
      blurb: input.blurb?.trim() || undefined,
      builtIn: cur?.builtIn,
      updatedAt: Date.now(),
      updatedBy: actorName(),
    };
    // Replaced files are removed from this browser
    if (cur?.svga && cur.svga !== gift.svga) void deleteLocalFile(cur.svga);
    if (cur?.icon && cur.icon !== gift.icon) void deleteLocalFile(cur.icon);
    const detail = !cur
      ? `Added gift “${name}” at ${coinText(gift.cost)} coins${gift.svga ? " with an SVGA animation" : ""}`
      : cur.cost !== gift.cost
        ? `Changed the price of “${name}” from ${coinText(cur.cost)} to ${coinText(gift.cost)} coins`
        : cur.active !== gift.active
          ? `${gift.active ? "Showed" : "Hid"} gift “${name}”`
          : Boolean(cur.comingSoon) !== Boolean(gift.comingSoon)
            ? `${gift.comingSoon ? "Marked" : "Released"} gift “${name}”${gift.comingSoon ? " as coming soon" : ": people can send it now"}`
          : `Edited gift “${name}”`;
    updateDb((db) => audit({ ...db, gifts: cur ? db.gifts.map((x) => (x.id === cur.id ? gift : x)) : [...db.gifts, gift] }, cur && cur.cost !== gift.cost ? "pricing" : "gift", detail));
    return delay(gift);
  },

  async setGiftsComingSoon(ids, comingSoon) {
    const db0 = readDb();
    requirePerm("gifts.manage", db0);
    const now = Date.now();
    const changed = db0.gifts.filter((g) => ids.includes(g.id) && Boolean(g.comingSoon) !== comingSoon);
    if (!changed.length) return delay(0);
    updateDb((db) =>
      audit(
        { ...db, gifts: db.gifts.map((g) => (changed.some((c) => c.id === g.id) ? { ...g, comingSoon, updatedAt: now, updatedBy: actorName() } : g)) },
        "gift",
        comingSoon ? `Marked ${changed.length} gift${changed.length === 1 ? "" : "s"} as coming soon` : `Released ${changed.length} coming-soon gift${changed.length === 1 ? "" : "s"}`,
      ),
    );
    return delay(changed.length);
  },

  async deleteGift(id) {
    const db0 = readDb();
    requirePerm("gifts.delete", db0);
    const cur = db0.gifts.find((x) => x.id === id);
    if (!cur) throw new AdminError("Gift not found");
    if (cur.builtIn) throw new AdminError("Gifts built into the app can't be deleted. Hide it instead.");
    await deleteLocalFile(cur.svga);
    await deleteLocalFile(cur.icon);
    updateDb((db) => audit({ ...db, gifts: db.gifts.filter((x) => x.id !== id) }, "gift", `Deleted gift “${cur.name}”`));
    return delay(undefined);
  },

  /* ---------------- shop products ---------------- */

  async listProducts() {
    return delay(readDb().products);
  },

  async saveProduct(input) {
    const db0 = readDb();
    const staff = requirePerm("store.manage", db0);
    const name = input.name.trim();
    if (!name) throw new AdminError("Give it a name");
    if (!input.prices.length) throw new AdminError("Add at least one price");
    input.prices.forEach((p) => {
      wholeCoins(p.coins, "Each price");
      if (p.days !== null && (!Number.isInteger(p.days) || p.days < 1)) throw new AdminError("Rental days must be 1 or more");
    });
    if (new Set(input.prices.map((p) => p.days)).size !== input.prices.length) throw new AdminError("Two prices have the same number of days");
    const cur = input.id ? db0.products.find((x) => x.id === input.id) : undefined;
    if (input.id && !cur) throw new AdminError("Product not found");
    const priceKey = (ps: Product["prices"]) => JSON.stringify([...ps].sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9)));
    const priceChanged = cur && priceKey(cur.prices) !== priceKey(input.prices);
    if (priceChanged && !can(staff.role, "pricing.edit")) throw new AdminError("You can't change prices of existing items");
    const product: Product = {
      ...cur,
      ...input,
      id: cur?.id ?? uniqueId(slug(name), db0.products.map((x) => x.id)),
      name,
      prices: [...input.prices].sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9)),
      builtIn: cur?.builtIn,
      updatedAt: Date.now(),
      updatedBy: actorName(),
    };
    if (cur?.svga && cur.svga !== product.svga) void deleteLocalFile(cur.svga);
    if (cur?.image && cur.image !== product.image) void deleteLocalFile(cur.image);
    const priceList = product.prices.map((p) => `${coinText(p.coins)}${p.days === null ? "" : `/${p.days}d`}`).join(", ");
    const detail = !cur
      ? `Added ${KIND_NAME[product.kind]} “${name}” (${priceList})`
      : priceChanged
        ? `Changed the price of ${KIND_NAME[product.kind]} “${name}” to ${priceList}`
        : cur.active !== product.active
          ? `${product.active ? "Put" : "Took"} ${KIND_NAME[product.kind]} “${name}” ${product.active ? "back in" : "out of"} the Shop`
          : `Edited ${KIND_NAME[product.kind]} “${name}”`;
    updateDb((db) => audit({ ...db, products: cur ? db.products.map((x) => (x.id === cur.id ? product : x)) : [...db.products, product] }, priceChanged ? "pricing" : "product", detail));
    return delay(product);
  },

  async deleteProduct(id) {
    const db0 = readDb();
    requirePerm("store.delete", db0);
    const cur = db0.products.find((x) => x.id === id);
    if (!cur) throw new AdminError("Not found");
    if (cur.builtIn) throw new AdminError("Items built into the app can't be deleted. Take it out of the Shop instead.");
    await deleteLocalFile(cur.svga);
    await deleteLocalFile(cur.image);
    updateDb((db) => audit({ ...db, products: db.products.filter((x) => x.id !== id) }, "product", `Deleted ${KIND_NAME[cur.kind]} “${cur.name}”`));
    return delay(undefined);
  },

  async uploadFile(file, kind) {
    const db = readDb();
    if (!can(me(db).role, "gifts.manage") && !can(me(db).role, "store.manage")) throw new AdminError("Your role can't upload files");
    checkUpload(file, kind);
    return saveLocalFile(file);
  },

  /* ---------------- pricing ---------------- */

  async getPricing() {
    requirePerm("pricing.view");
    return delay(readDb().pricing);
  },

  async savePricing(next) {
    const db0 = readDb();
    requirePerm("pricing.edit", db0);
    next.vip.forEach((v) => {
      wholeCoins(v.coins, `VIP ${v.level} price`);
      if (!Number.isInteger(v.days) || v.days < 1) throw new AdminError(`VIP ${v.level} must last at least 1 day`);
    });
    next.coinPacks.forEach((p) => {
      if (!Number.isInteger(p.coins) || p.coins < 1) throw new AdminError("Every coin pack needs at least 1 coin");
      wholeCoins(p.bonus, "Bonus coins");
      if (!(p.priceInr > 0)) throw new AdminError(`Set a price in ₹ for the ${coinText(p.coins)} coin pack`);
    });
    next.redPackets.forEach((r) => {
      if (!Number.isInteger(r.priceInr) || r.priceInr < 1) throw new AdminError(`Set a price of at least ₹1 for the ${r.name}`);
      if (!Number.isInteger(r.pot) || r.pot < 1) throw new AdminError(`The ${r.name} needs at least 1 coin inside`);
      if (!r.name.trim()) throw new AdminError("Every red packet needs a name");
    });
    // Say exactly what changed, for the log
    const prev = db0.pricing;
    const changes: string[] = [];
    next.vip.forEach((v) => {
      const o = prev.vip.find((x) => x.level === v.level);
      if (!o || o.coins !== v.coins || o.days !== v.days) changes.push(`VIP ${v.level} ${o ? `${coinText(o.coins)} → ` : ""}${coinText(v.coins)} coins / ${v.days} days`);
      else if (o.active !== v.active) changes.push(`VIP ${v.level} ${v.active ? "on sale" : "off sale"}`);
    });
    next.coinPacks.forEach((p) => {
      const o = prev.coinPacks.find((x) => x.id === p.id);
      if (!o) changes.push(`new pack ${coinText(p.coins)}+${coinText(p.bonus)} coins for ₹${coinText(p.priceInr)}`);
      else if (o.coins !== p.coins || o.bonus !== p.bonus || o.priceInr !== p.priceInr) changes.push(`pack ${coinText(p.coins)} coins: ₹${coinText(o.priceInr)} → ₹${coinText(p.priceInr)}${o.bonus !== p.bonus ? `, bonus ${coinText(p.bonus)}` : ""}`);
      else if (o.active !== p.active) changes.push(`pack ${coinText(p.coins)} coins ${p.active ? "on sale" : "off sale"}`);
    });
    prev.coinPacks.filter((o) => !next.coinPacks.some((p) => p.id === o.id)).forEach((o) => changes.push(`removed pack ${coinText(o.coins)} coins`));
    next.redPackets.forEach((r) => {
      const o = prev.redPackets.find((x) => x.id === r.id);
      if (!o) return;
      if (o.priceInr !== r.priceInr || o.pot !== r.pot) changes.push(`${r.name}: ₹${coinText(o.priceInr)} → ₹${coinText(r.priceInr)}, ${coinText(o.pot)} → ${coinText(r.pot)} coins inside`);
      else if (o.name !== r.name) changes.push(`${o.name} renamed to ${r.name}`);
      else if (o.active !== r.active) changes.push(`${r.name} ${r.active ? "on sale" : "off sale"}`);
    });
    const pricing = { vip: next.vip, coinPacks: next.coinPacks, redPackets: next.redPackets.map((r) => ({ ...r, name: r.name.trim() })), updatedAt: Date.now(), updatedBy: actorName() };
    updateDb((db) => (changes.length ? audit({ ...db, pricing }, "pricing", `Changed prices: ${changes.join("; ")}`) : { ...db, pricing }));
    return delay(pricing);
  },

  /* ---------------- app settings ---------------- */

  async getSettings() {
    me(readDb());
    return delay(readDb().settings);
  },

  async saveSettings(next) {
    const db0 = readDb();
    requirePerm("settings.edit", db0);
    wholeCoins(next.signupBonusCoins, "Sign-up bonus");
    wholeCoins(next.dailyCheckinCoins, "Daily check-in reward");
    if (!/^\d+\.\d+\.\d+$/.test(next.minAppVersion.trim())) throw new AdminError("Write the app version like 1.4.0");
    const prev = db0.settings;
    const settings = { ...next, minAppVersion: next.minAppVersion.trim(), updatedAt: Date.now(), updatedBy: actorName() };
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => prev[k] !== settings[k]);
    const detail =
      prev.maintenance !== settings.maintenance
        ? settings.maintenance
          ? "Turned ON maintenance mode: the app is closed to users"
          : "Turned off maintenance mode: the app is open again"
        : `Changed app settings: ${changed.join(", ") || "nothing"}`;
    updateDb((db) => audit({ ...db, settings }, "settings", detail));
    return delay(settings);
  },

  /* ---------------- user names ---------------- */

  async renameUser(userId, name, handle, reason) {
    const db0 = readDb();
    requirePerm("users.rename", db0);
    const s = seedUser(userId);
    if (s.official) throw new AdminError("Change the Sarpanch account's name on the Sarpanch page");
    const why = requireReason(reason);
    const newName = name.trim().replace(/\s+/g, " ");
    if (newName.length < 2 || newName.length > 24) throw new AdminError("Names are 2 to 24 letters");
    if (RESERVED_HANDLES.some((r) => newName.toLowerCase().replace(/\s/g, "") === r)) throw new AdminError(`“${newName}” is reserved for the official account`);
    const newHandle = checkHandle(handle, userId, db0);
    const before = toAdminUser(s, db0);
    if (before.name === newName && before.handle === newHandle) throw new AdminError("Nothing changed");
    const parts = [before.name !== newName ? `name “${before.name}” → “${newName}”` : "", before.handle !== newHandle ? `username ${before.handle} → ${newHandle}` : ""].filter(Boolean);
    updateDb((db) => audit({ ...db, profileEdits: { ...db.profileEdits, [userId]: { name: newName, handle: newHandle } } }, "profile", `Changed ${parts.join(" and ")}: ${why}`, userId));
    return delay(toAdminUser(s, readDb()));
  },

  /* ---------------- Sarpanch ---------------- */

  async getSarpanch() {
    requirePerm("sarpanch.manage");
    return delay(readDb().sarpanch);
  },

  async saveSarpanch(p) {
    const db0 = readDb();
    requirePerm("sarpanch.manage", db0);
    const name = p.name.trim();
    if (name.length < 2 || name.length > 24) throw new AdminError("Names are 2 to 24 letters");
    const handle = checkHandle(p.handle, SARPANCH_ID, db0);
    if (p.bio.length > 160) throw new AdminError("Keep the bio under 160 letters");
    const prev = db0.sarpanch;
    if (prev.photo && prev.photo !== p.photo) void deleteLocalFile(prev.photo);
    const sarpanch = { name, handle, bio: p.bio.trim(), photo: p.photo, updatedAt: Date.now(), updatedBy: actorName() };
    updateDb((db) => audit({ ...db, sarpanch }, "sarpanch", `Updated the Sarpanch profile${prev.name !== name ? ` (name “${prev.name}” → “${name}”)` : ""}`, SARPANCH_ID));
    return delay(sarpanch);
  },

  async sendAsSarpanch(toUserId, title, body) {
    const db0 = readDb();
    requirePerm("sarpanch.manage", db0);
    if (!title.trim()) throw new AdminError("Add a title");
    if (!body.trim()) throw new AdminError("Write the message");
    if (body.length > 1000) throw new AdminError("Keep the message under 1,000 letters");
    if (toUserId) seedUser(toUserId);
    const m: SarpanchMessage = { id: newId("msg"), toUserId, title: title.trim(), body: body.trim(), sentAt: Date.now(), by: actorName() };
    updateDb((db) =>
      audit({ ...db, sarpanchMessages: [m, ...db.sarpanchMessages].slice(0, 500) }, "sarpanch", `Sent “${m.title}” as Sarpanch to ${toUserId ? nameOf(toUserId) : "everyone"}`, toUserId ?? undefined),
    );
    return delay(m);
  },

  async listSarpanchMessages() {
    requirePerm("sarpanch.manage");
    return delay(readDb().sarpanchMessages);
  },

  /* ---------------- staff ---------------- */

  async listStaff() {
    me(readDb());
    return delay(readDb().staff.map(({ password: _p, ...m }) => m));
  },

  async saveStaff(input, isNew) {
    const db0 = readDb();
    const self = requirePerm("staff.manage", db0);
    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(username)) throw new AdminError("Usernames are 3 to 20 letters, numbers, dots or underscores");
    if (!input.name.trim()) throw new AdminError("Enter their name");
    const cur = db0.staff.find((x) => x.username === username);
    if (isNew && cur) throw new AdminError(`@${username} already exists`);
    if (!isNew && !cur) throw new AdminError("Staff member not found");
    if (isNew && !input.password) throw new AdminError("Set a password for the new account");
    if (input.password !== undefined && input.password.length < 8) throw new AdminError("Passwords need at least 8 characters");
    if (cur && username === self.username && (input.role !== "super_admin" || !input.active)) throw new AdminError("You can't remove your own super admin access. Ask the other super admin.");
    const supers = db0.staff.filter((x) => x.role === "super_admin" && x.active && x.username !== username).length;
    if (cur?.role === "super_admin" && (input.role !== "super_admin" || !input.active) && supers === 0) throw new AdminError("There must always be at least one active super admin");
    const next = { ...(cur ?? { createdAt: Date.now(), password: "" }), username, name: input.name.trim(), role: input.role, title: input.title.trim() || ROLE_LABEL[input.role], active: input.active, password: input.password ?? cur?.password ?? "" };
    const what = isNew
      ? `Added ${ROLE_LABEL[next.role]} ${next.name} (@${username})`
      : cur!.role !== next.role
        ? `Changed ${next.name}'s role from ${ROLE_LABEL[cur!.role]} to ${ROLE_LABEL[next.role]}`
        : cur!.active !== next.active
          ? `${next.active ? "Re-enabled" : "Disabled"} ${next.name}'s staff account`
          : input.password
            ? `Reset ${next.name}'s password`
            : `Edited ${next.name}'s staff account`;
    updateDb((db) => audit({ ...db, staff: cur ? db.staff.map((x) => (x.username === username ? next : x)) : [...db.staff, next] }, "staff", what));
    const { password: _p, ...out } = next;
    return delay(out);
  },
};

const KIND_NAME: Record<Product["kind"], string> = { bubble: "chat bubble", ring: "ring", frame: "frame", entry: "entry effect", badge: "badge", theme: "room theme" };

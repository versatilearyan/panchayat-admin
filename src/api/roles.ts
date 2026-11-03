/**
 * Staff roles and what each one may do.
 *
 * Moderators keep rooms friendly, Admins also run the economy and the catalog,
 * and Super Admins can do everything, including pricing, staff and app settings.
 * The panel hides what a role can't use, and the API (local.ts, and the backend)
 * checks the same list on every call, so hiding a button is never the only guard.
 */

export type Role = "moderator" | "admin" | "super_admin";

export type Permission =
  | "users.warn"
  | "users.mute"
  | "users.kick"
  | "users.ban"
  | "users.coins"
  | "users.vip"
  | "users.items"
  | "reports.handle"
  | "rooms.create"
  | "rooms.edit"
  | "rooms.delete"
  | "gifts.manage"
  | "gifts.delete"
  | "store.manage"
  | "store.delete"
  | "pricing.view"
  | "pricing.edit"
  | "staff.manage"
  | "settings.edit"
  | "demo.reset"
  | "users.rename"
  | "sarpanch.manage"
  /** Coin packs and red packet products on the backend (SUPER_ADMIN there too). */
  | "wallet.manage"
  /** VIP membership and VIP points on the backend (SUPER_ADMIN there too). */
  | "vip.manage"
  /** Gifts and spend rewards on the backend: every staff role (management). */
  | "catalog.manage"
  /** Deleting gifts and spend rewards: Super Admins. */
  | "catalog.delete"
  /** Revenue, payments, coin logs and the audit log: Super Admins. */
  | "finance.view";

const MODERATOR: Permission[] = ["users.warn", "users.mute", "users.kick", "reports.handle", "catalog.manage"];

const ADMIN: Permission[] = [
  ...MODERATOR,
  "users.ban",
  "users.coins",
  "users.vip",
  "users.items",
  "rooms.create",
  "rooms.edit",
  "gifts.manage",
  "store.manage",
  "pricing.view",
];

const SUPER_ADMIN: Permission[] = [...ADMIN, "users.rename", "sarpanch.manage", "rooms.delete", "gifts.delete", "store.delete", "pricing.edit", "staff.manage", "settings.edit", "demo.reset", "wallet.manage", "vip.manage", "catalog.delete", "finance.view"];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  moderator: new Set(MODERATOR),
  admin: new Set(ADMIN),
  super_admin: new Set(SUPER_ADMIN),
};

export const ROLE_LABEL: Record<Role, string> = { moderator: "Moderator", admin: "Admin", super_admin: "Super Admin" };

export const ROLE_SUMMARY: Record<Role, string> = {
  moderator: "Warn, mute and kick users, handle reports, and manage gifts and spend rewards.",
  admin: "Everything a moderator does, plus bans, coins (up to 1 lakh at a time), giving VIP and items, creating rooms, and adding gifts and products.",
  super_admin: "Everything. Also revenue, payments, coin logs and the audit log, deleting gifts and rewards, changing users' names, the Sarpanch account, pricing for VIP, coins, rings and bubbles, deleting gifts and products, staff accounts and app settings.",
};

/** Largest single coin change for each role. Super admins share the global cap. */
export const COIN_LIMIT: Record<Role, number> = { moderator: 0, admin: 100_000, super_admin: 10_000_000 };

export const can = (role: Role | undefined, p: Permission) => Boolean(role && ROLE_PERMISSIONS[role].has(p));

/** A staff account. Passwords are only kept in demo mode; the backend stores hashes. */
export type StaffMember = {
  username: string;
  name: string;
  role: Role;
  /** Shown under the name, e.g. "Moderator 1". */
  title: string;
  active: boolean;
  createdAt: number;
};

const t0 = Date.UTC(2026, 9, 1);

/** The team. Usernames are what people type to sign in. */
export const SEED_STAFF: StaffMember[] = [
  { username: "aryan", name: "Aryan", role: "super_admin", title: "Super Admin", active: true, createdAt: t0 },
  { username: "bharat", name: "Bharat", role: "super_admin", title: "Super Admin", active: true, createdAt: t0 },
  { username: "nikhil", name: "Nikhil", role: "admin", title: "Admin", active: true, createdAt: t0 },
  { username: "shivam", name: "Shivam", role: "moderator", title: "Moderator 1", active: true, createdAt: t0 },
  { username: "vansh", name: "Vansh", role: "moderator", title: "Moderator 2", active: true, createdAt: t0 },
];

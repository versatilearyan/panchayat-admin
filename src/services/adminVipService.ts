/**
 * VIP management on the backend: /api/v1/admin/vip/users/{userId}. SUPER_ADMIN only.
 *
 *   GET    /{userId}                  → AdminVipResponse
 *   POST   /{userId}/grant            { durationDays }  (AdminVipGrantRequest)
 *   PATCH  /{userId}/extend           { durationDays }
 *   DELETE /{userId}                  revoke
 *   POST   /{userId}/points/credit    { amount }        (AdminVipPointsRequest)
 *   POST   /{userId}/points/debit     { amount }
 *
 * {userId} is always the target user's numeric ID, checked by assertUserId before any
 * request. It is never the signed-in admin's username or role.
 *
 * The backend computes expiry dates and balances. The panel shows what it returns and
 * never works them out itself.
 *
 * AdminVipResponse wasn't available to read, so its fields are read defensively, and every
 * plain field the server sends is also kept in `fields` so the page can show it as-is.
 */
import { ENDPOINTS } from "../config/api";
import { apiRequest, ApiError, MESSAGES, unwrap } from "../lib/api";
import { assertUserId } from "../lib/userId";

export type VipStatus = {
  userId?: number | string;
  /** The backend's own active flag. Undefined when the reply had none. */
  active?: boolean;
  /** ISO date-time, or undefined when there's no expiry (never had VIP, or revoked). */
  expiresAt?: string;
  points?: number;
  message?: string;
  /** Every plain field in the reply, by its real name, for checking against the DTO. */
  fields: [string, string][];
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined);

const ACTIVE_KEYS = ["vipActive", "active", "isVip", "vip", "isVipActive"];
const EXPIRY_KEYS = ["vipExpiresAt", "vipExpiryAt", "vipExpiry", "vipExpireAt", "vipExpirationDate", "vipExpiresOn", "expiresAt", "expiryDate"];
const POINTS_KEYS = ["vipPoints", "vipPointsBalance", "pointsBalance", "points", "balance"];

/** Reads a reply. Returns null when there's no body (a 204 from revoke, say). */
export function toVipStatus(raw: unknown): VipStatus | null {
  const top = obj(raw);
  if (!top) return null;
  const d = obj(unwrap<unknown>(raw)) ?? top;
  const first = <T>(read: (v: unknown) => T | undefined, keys: string[]) => {
    for (const k of keys) {
      const v = read(d[k]);
      if (v !== undefined) return v;
    }
    return undefined;
  };
  const fields: [string, string][] = Object.entries(d)
    .filter(([, v]) => v === null || ["string", "number", "boolean"].includes(typeof v))
    .map(([k, v]) => [k, v === null ? "null" : String(v)]);
  return {
    userId: num(d.userId) ?? str(d.userId),
    active: first(bool, ACTIVE_KEYS),
    expiresAt: first(str, EXPIRY_KEYS),
    points: first(num, POINTS_KEYS),
    message: str(top.message) ?? str(d.message),
    fields,
  };
}

const path = (userId: number) => `${ENDPOINTS.adminVipUsers}/${assertUserId(userId)}`;

/** Readable text for the replies that matter. Other errors keep the shared client's message. */
function explain(e: unknown): never {
  if (e instanceof ApiError && e.kind !== "network") {
    if (e.status === 404) throw new ApiError(e.message && e.message !== MESSAGES.notFound ? e.message : "No user was found with that ID.", 404, "not_found");
    if (e.status === 403) throw new ApiError("Only a Super Admin can manage VIP. The server turned down your account for it.", 403, "forbidden");
  }
  throw e;
}

const call = async (p: string, method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown) => {
  try {
    return toVipStatus(await apiRequest<unknown>(p, { method, body }));
  } catch (e) {
    return explain(e);
  }
};

export const adminVipService = {
  get: async (userId: number) => {
    const s = await call(path(userId), "GET");
    if (!s) throw new ApiError("The server sent a reply the panel couldn't read.", 200, "bad_response");
    return s;
  },
  grant: (userId: number, durationDays: number) => call(`${path(userId)}/grant`, "POST", { durationDays }),
  extend: (userId: number, durationDays: number) => call(`${path(userId)}/extend`, "PATCH", { durationDays }),
  revoke: (userId: number) => call(path(userId), "DELETE"),
  creditPoints: (userId: number, amount: number) => call(`${path(userId)}/points/credit`, "POST", { amount }),
  debitPoints: (userId: number, amount: number) => call(`${path(userId)}/points/debit`, "POST", { amount }),
};

/** No reply, a timeout, or a 5xx: the change may or may not have been applied. */
export const vipOutcomeUnknown = (e: unknown) => !(e instanceof ApiError) || e.kind === "network" || e.status === 0 || e.status >= 500;

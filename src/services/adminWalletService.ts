/**
 * Admin wallet tools on the backend: /api/v1/admin/wallets/{userId}/...
 *
 * - POST /credit and POST /debit with { amount, reason, referenceId, idempotencyKey, description }.
 * - GET /transactions?page=&size= for the user's paginated history.
 *
 * The backend decides who may call these and applies the change; the panel never
 * changes a balance itself. There is no admin endpoint to read a user's balance or to
 * search wallets, so the panel only shows balances that come back in these replies.
 * Replies are read defensively: a missing or oddly typed field is shown as "—", never guessed.
 */
import { ENDPOINTS } from "../config/api";
import { apiRequest, ApiError } from "../lib/api";
import { assertUserId } from "../lib/userId";

export type WalletAdjustment = {
  /** Positive whole number of coins. */
  amount: number;
  /** e.g. ADMIN_GRANT or ADMIN_ADJUSTMENT. */
  reason: string;
  referenceId?: string;
  /** One per logical request. Reused when retrying the same request. */
  idempotencyKey: string;
  description?: string;
};

export type WalletAdjustmentResult = {
  transactionId?: string;
  transactionType?: string;
  amount?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  createdAt?: string;
};

export type WalletTransaction = {
  transactionId: string;
  userId?: string;
  transactionType: string;
  amount?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  reason?: string;
  referenceId?: string;
  description?: string;
  createdAt?: string;
};

export type WalletTransactionPage = {
  userId?: string;
  transactions: WalletTransaction[];
  currentPage: number;
  pageSize: number;
  totalElements?: number;
  totalPages?: number;
  hasNext: boolean;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined);

const bad = () => new ApiError("The server sent a reply the panel couldn't read.", 200, "bad_response");

/** The wallet routes for one user. The id is encoded, never trusted as a path. */
const userPath = (userId: number) => `${ENDPOINTS.adminWallets}/${assertUserId(userId)}`;

function toResult(raw: unknown): WalletAdjustmentResult {
  const top = obj(raw);
  if (!top) throw bad();
  // The reply may be flat, or nest the transaction under data / transaction
  const layers = [top, obj(top.data), obj(top.transaction), obj(obj(top.data)?.transaction)].filter((l): l is Record<string, unknown> => Boolean(l));
  const pick = <T>(read: (v: unknown) => T | undefined, ...keys: string[]) => {
    for (const l of layers) for (const k of keys) {
      const v = read(l[k]);
      if (v !== undefined) return v;
    }
    return undefined;
  };
  return {
    transactionId: pick(str, "transactionId", "id"),
    transactionType: pick(str, "transactionType", "type"),
    amount: pick(num, "amount"),
    balanceBefore: pick(num, "balanceBefore"),
    balanceAfter: pick(num, "balanceAfter", "balance", "newBalance"),
    createdAt: pick(str, "createdAt"),
  };
}

function toTransaction(raw: unknown): WalletTransaction | null {
  const d = obj(raw);
  const id = str(d?.transactionId) ?? str(d?.id);
  if (!d || !id) return null;
  return {
    transactionId: id,
    userId: str(d.userId),
    transactionType: (str(d.transactionType) ?? str(d.type) ?? "").toUpperCase(),
    amount: num(d.amount),
    balanceBefore: num(d.balanceBefore),
    balanceAfter: num(d.balanceAfter),
    reason: str(d.reason),
    referenceId: str(d.referenceId),
    description: str(d.description),
    createdAt: str(d.createdAt),
  };
}

function toPage(raw: unknown, page: number, size: number): WalletTransactionPage {
  const top = obj(raw);
  const d = top && !Array.isArray(top.transactions) && obj(top.data) ? obj(top.data)! : top;
  if (!d || !Array.isArray(d.transactions)) throw bad();
  const rows = (d.transactions as unknown[]).map(toTransaction).filter((t): t is WalletTransaction => t !== null);
  const currentPage = num(d.currentPage) ?? page;
  const totalPages = num(d.totalPages);
  const hasNext = typeof d.hasNext === "boolean" ? d.hasNext : totalPages !== undefined ? currentPage + 1 < totalPages : false;
  return { userId: str(d.userId), transactions: rows, currentPage, pageSize: num(d.pageSize) ?? size, totalElements: num(d.totalElements), totalPages, hasNext };
}

/** Clear text for the replies that matter here. Everything else keeps the shared client's message. */
function explain(e: unknown, action: "credit" | "debit" | "history"): never {
  // Network trouble (timeouts, an offline tunnel) keeps its own message
  if (e instanceof ApiError && e.kind !== "network") {
    if (e.status === 404) throw new ApiError(action === "history" ? "No wallet was found for that user ID. Check the ID." : `No wallet was found for that user ID, so nothing was ${action === "credit" ? "credited" : "debited"}.`, 404, "not_found");
    if (e.status === 403) throw new ApiError("The server turned down your account for wallet changes. Only Admins and Super Admins can do this.", 403, "forbidden");
    if (e.status === 409) throw new ApiError(`${e.message} (The server reported a conflict. If this key was already used for a different request, start a new request.)`, 409, "invalid");
  }
  throw e;
}

export type WalletReasonTotal = { reason: string; type: string; count: number; coins: number };
export type WalletDetails = {
  userId?: string;
  publicId?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  vipActive: boolean;
  vipLevel?: number;
  charmPoints?: number;
  joinedAt?: string;
  balance?: number;
  byReason: WalletReasonTotal[];
  totalIn?: number;
  totalOut?: number;
  rupeesPaid?: number;
  lastActivityAt?: string;
};

function toDetails(raw: unknown): WalletDetails {
  const d = obj(raw);
  if (!d) throw bad();
  const rows = Array.isArray(d.byReason) ? (d.byReason as unknown[]) : [];
  return {
    userId: str(d.userId),
    publicId: str(d.publicId),
    name: str(d.name),
    email: str(d.email),
    avatarUrl: str(d.avatarUrl),
    vipActive: d.vipActive === true,
    vipLevel: num(d.vipLevel),
    charmPoints: num(d.charmPoints),
    joinedAt: str(d.joinedAt),
    balance: num(d.balance),
    byReason: rows
      .map((r) => obj(r))
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((r) => ({ reason: str(r.reason) ?? "OTHER", type: (str(r.type) ?? "").toUpperCase(), count: num(r.count) ?? 0, coins: num(r.coins) ?? 0 })),
    totalIn: num(d.totalIn),
    totalOut: num(d.totalOut),
    rupeesPaid: num(d.rupeesPaid),
    lastActivityAt: str(d.lastActivityAt),
  };
}

export const adminWalletService = {
  /** Balance, who the user is and their coin totals. Accepts the public ID or the internal ID. */
  details: async (userId: number) => {
    try {
      return toDetails(await apiRequest<unknown>(userPath(userId)));
    } catch (e) {
      return explain(e, "history");
    }
  },
  credit: async (userId: number, body: WalletAdjustment) => {
    try {
      return toResult(await apiRequest<unknown>(`${userPath(userId)}/credit`, { method: "POST", body }));
    } catch (e) {
      return explain(e, "credit");
    }
  },
  debit: async (userId: number, body: WalletAdjustment) => {
    try {
      return toResult(await apiRequest<unknown>(`${userPath(userId)}/debit`, { method: "POST", body }));
    } catch (e) {
      return explain(e, "debit");
    }
  },
  transactions: async (userId: number, page = 0, size = 20) => {
    try {
      return toPage(await apiRequest<unknown>(`${userPath(userId)}/transactions?page=${page}&size=${size}`), page, size);
    } catch (e) {
      return explain(e, "history");
    }
  },
};

/**
 * True when a failed credit/debit may still have gone through: the request timed out or
 * never got a reply (status 0), or the server failed part way (5xx). Retry only with the
 * same idempotency key, or check the history first.
 */
export const outcomeUnknown = (e: unknown) => !(e instanceof ApiError) || e.kind === "network" || e.status === 0 || e.status >= 500;

/** A fresh idempotency key for one logical request. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // crypto.randomUUID needs a secure context; fall back to getRandomValues (still random, not Math.random)
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

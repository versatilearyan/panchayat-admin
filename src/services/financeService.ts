/**
 * Revenue, payments, coin logs and the admin audit log: /api/v1/admin/super/…
 * Super Admins only (the server checks). Amounts are rupees; days are India time.
 */
import { ENDPOINTS } from "../config/api";
import { apiRequest, unwrap } from "../lib/api";
import type { Paged } from "./rewardService";

export type RevenueWindow = { amount: number; count: number; payers: number; average: number };

export type RevenueSummary = {
  currency: "INR";
  allTime: RevenueWindow;
  today: RevenueWindow;
  last7Days: RevenueWindow;
  last30Days: RevenueWindow;
  thisMonth: RevenueWindow;
  paymentsByStatus: Record<"SUCCESS" | "PENDING" | "FAILED", number>;
  byPurpose: { purpose: string; amount: number; count: number }[];
  daily: { day: string; amount: number; count: number }[];
  topPayers: { userId: number; name: string | null; email: string | null; amount: number; count: number }[];
  coins: { inWallets: number; sold: number; byReason: { reason: string; type: "CREDIT" | "DEBIT"; coins: number; count: number }[] };
};

export type Payment = {
  id: number;
  txnId: string;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  purpose: string;
  productId: number | null;
  amount: number;
  currency: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  payuPaymentId: string | null;
  paymentMode: string | null;
  failureReason: string | null;
  coins: number | null;
  bonusCoins: number | null;
  createdAt: string;
  verifiedAt: string | null;
};

export type CoinLog = {
  id: number;
  userId: number;
  userName: string | null;
  type: "CREDIT" | "DEBIT";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
};

export type AuditEntry = { id: number; admin: string | null; role: string | null; method: string; path: string; status: number; ip: string | null; createdAt: string };

const base = ENDPOINTS.superAdmin;
const qs = (o: Record<string, string | number | undefined>) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");

/** Postgres numerics may arrive as strings; make every money value a number. */
const n = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" ? Number(v) || 0 : 0);
const win = (w: Partial<RevenueWindow> | undefined): RevenueWindow => ({ amount: n(w?.amount), count: n(w?.count), payers: n(w?.payers), average: n(w?.average) });

export const financeService = {
  revenue: async (days: number): Promise<RevenueSummary> => {
    const r = unwrap<RevenueSummary>(await apiRequest(`${base}/revenue?days=${days}`));
    return {
      ...r,
      allTime: win(r.allTime),
      today: win(r.today),
      last7Days: win(r.last7Days),
      last30Days: win(r.last30Days),
      thisMonth: win(r.thisMonth),
      byPurpose: (r.byPurpose ?? []).map((p) => ({ ...p, amount: n(p.amount), count: n(p.count) })),
      daily: (r.daily ?? []).map((d) => ({ ...d, amount: n(d.amount), count: n(d.count) })),
      topPayers: (r.topPayers ?? []).map((t) => ({ ...t, amount: n(t.amount), count: n(t.count) })),
    };
  },
  payments: async (f: { page: number; status?: string; purpose?: string; q?: string }) => {
    const p = unwrap<Paged<Payment>>(await apiRequest(`${base}/payments?${qs({ size: 20, ...f })}`));
    return { ...p, content: p.content.map((x) => ({ ...x, amount: n(x.amount) })) };
  },
  coinLogs: async (f: { page: number; reason?: string; type?: string; userId?: string }) => unwrap<Paged<CoinLog>>(await apiRequest(`${base}/coin-transactions?${qs({ size: 20, ...f })}`)),
  coinReasons: async () => unwrap<string[]>(await apiRequest(`${base}/coin-transactions/reasons`)) ?? [],
  audit: async (f: { page: number; q?: string; method?: string }) => unwrap<Paged<AuditEntry>>(await apiRequest(`${base}/audit?${qs({ size: 30, ...f })}`)),
};

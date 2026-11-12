/**
 * The app's users: /api/v1/admin/users (Admins and Super Admins; the server checks).
 * Counts: total, new, online now, in rooms now, active today / 7 / 30 days, VIP.
 */
import { ENDPOINTS } from "../config/api";
import { apiRequest, unwrap } from "../lib/api";
import type { Paged } from "./rewardService";

export type UserStats = {
  total: number;
  newToday: number;
  new7Days: number;
  onlineNow: number;
  inRoomsNow: number;
  activeToday: number;
  active7Days: number;
  active30Days: number;
  vipActive: number;
  vipTrialActive?: number;
  profileCompleted: number;
};

export type AppUser = {
  id: number;
  /** The 7-digit ID users see and search by. */
  publicId: number;
  name: string | null;
  email: string | null;
  gender: string | null;
  avatarUrl: string | null;
  level: number | null;
  joinedAt: string;
  profileCompleted: boolean;
  vipLevel: number | null;
  /** On the free VIP trial for new users right now (not bought or extended). */
  vipTrial?: boolean;
  vipEndsAt?: string | null;
  hadTrial?: boolean;
  coins: number;
  charm: number;
  lastActiveAt: string | null;
  online: boolean;
  inRoom: boolean;
  banned: boolean;
  banPermanent: boolean;
  /** When a suspension ends (null for a permanent ban or no ban). */
  bannedUntil: string | null;
  banReason: string | null;
};

export type UserFilter = "all" | "online" | "vip" | "trial" | "new" | "banned";

const base = ENDPOINTS.adminUsers;
const all = ENDPOINTS.giveAll;

export const adminUsersService = {
  /** days empty = permanent ban; otherwise a suspension for that many days. */
  ban: async (id: number, days: number | null, reason: string) => apiRequest(`${base}/${id}/ban`, { method: "POST", body: { days, reason } }),
  /** amount empty = all of it. Super Admin only. */
  removeCoins: async (id: number, amount: number | null, reason: string) => unwrap<{ removed: number; balance: number }>(await apiRequest(`${base}/${id}/remove-coins`, { method: "POST", body: { amount, reason } })),
  removeCharm: async (id: number, amount: number | null, reason: string) => unwrap<{ removed: number; charm: number }>(await apiRequest(`${base}/${id}/remove-charm`, { method: "POST", body: { amount, reason } })),
  unban: async (id: number) => apiRequest(`${base}/${id}/unban`, { method: "POST" }),
  giveAllCoins: async (coins: number, reason: string) => unwrap<{ id: number; recipients: number }>(await apiRequest(`${all}/coins`, { method: "POST", body: { coins, reason } })),
  giveAllRedPacket: async (productId: number | string, quantity: number, reason: string) =>
    unwrap<{ id: number; recipients: number }>(await apiRequest(`${all}/red-packets`, { method: "POST", body: { productId: Number(productId), quantity, reason } })),
  audience: async () => unwrap<{ recipients: number }>(await apiRequest(`${all}/audience`)),
  stats: async () => unwrap<UserStats>(await apiRequest(`${base}/stats`)),
  list: async (f: { page: number; q?: string; filter: UserFilter }) =>
    unwrap<Paged<AppUser>>(await apiRequest(`${base}?page=${f.page}&size=20&filter=${f.filter}${f.q ? `&q=${encodeURIComponent(f.q)}` : ""}`)),
};

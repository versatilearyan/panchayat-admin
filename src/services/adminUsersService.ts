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
  coins: number;
  lastActiveAt: string | null;
  online: boolean;
  inRoom: boolean;
};

export type UserFilter = "all" | "online" | "vip" | "new";

const base = ENDPOINTS.adminUsers;

export const adminUsersService = {
  stats: async () => unwrap<UserStats>(await apiRequest(`${base}/stats`)),
  list: async (f: { page: number; q?: string; filter: UserFilter }) =>
    unwrap<Paged<AppUser>>(await apiRequest(`${base}?page=${f.page}&size=20&filter=${f.filter}${f.q ? `&q=${encodeURIComponent(f.q)}` : ""}`)),
};

/**
 * The admin panel's data layer.
 *
 * Every screen talks to `adminApi` and nothing else. There are two
 * implementations of the same `AdminApi` interface:
 *
 * - local.ts (default): demo data saved in this browser's localStorage.
 * - http.ts: the real backend. Used when VITE_ADMIN_API_URL is set, so moving
 *   to the backend needs no changes to the screens.
 */
import { httpApi } from "./http";
import { localApi } from "./local";
import type { StaffMember } from "./roles";
import type { AdminSession } from "./session";
import type {
  AdminRoom,
  AdminStats,
  AdminUser,
  AdminUserDetail,
  AppSettings,
  AuditEntry,
  CoinTx,
  Duration,
  FileRef,
  GiftInput,
  GiftItem,
  Grant,
  Pricing,
  Product,
  ProductInput,
  Report,
  ReportStatus,
  RoomInput,
  SarpanchMessage,
  SarpanchProfile,
  Sanction,
  UserFilter,
} from "./types";

export type StaffInput = StaffMember & { /** Only sent to set a new password. */ password?: string };
export type RoomPatch = Partial<RoomInput> & { live?: boolean };

export interface AdminApi {
  readonly mode: "local" | "http";
  login(username: string, password: string): Promise<AdminSession>;
  stats(): Promise<AdminStats>;
  listUsers(q?: string, filter?: UserFilter): Promise<AdminUser[]>;
  getUser(id: string): Promise<AdminUserDetail>;
  /** Positive adds coins, negative removes them. */
  adjustCoins(userId: string, amount: number, reason: string): Promise<CoinTx>;
  ban(userId: string, reason: string, duration: Duration, message?: string): Promise<Sanction>;
  unban(userId: string): Promise<void>;
  mute(userId: string, reason: string, duration: Duration): Promise<Sanction>;
  unmute(userId: string): Promise<void>;
  warn(userId: string, reason: string, message: string): Promise<Sanction>;
  kick(userId: string, roomId: string, reason: string, duration: Duration): Promise<Sanction>;
  /** Lifts any sanction by id: lets a kicked user back in, withdraws a warning, ends a ban or mute. */
  liftSanction(sanctionId: string): Promise<void>;
  setNote(userId: string, note: string): Promise<void>;
  listRooms(): Promise<AdminRoom[]>;
  listReports(status?: ReportStatus): Promise<Report[]>;
  setReportStatus(id: string, status: ReportStatus): Promise<Report>;
  listAudit(limit?: number): Promise<AuditEntry[]>;

  /* VIP and items given by staff */
  /** days null = never ends. */
  grantVip(userId: string, level: number, days: number | null, reason: string): Promise<Grant>;
  grantItem(userId: string, productId: string, days: number | null, reason: string): Promise<Grant>;
  revokeGrant(grantId: string): Promise<void>;

  /* Rooms */
  createRoom(input: RoomInput): Promise<AdminRoom>;
  updateRoom(id: string, patch: RoomPatch): Promise<AdminRoom>;
  deleteRoom(id: string): Promise<void>;

  /* Catalog */
  listGifts(): Promise<GiftItem[]>;
  /** Creates the gift when input.id is empty, otherwise updates it. */
  saveGift(input: GiftInput): Promise<GiftItem>;
  deleteGift(id: string): Promise<void>;
  /** Marks gifts as coming soon (or releases them). Returns how many changed. */
  setGiftsComingSoon(ids: string[], comingSoon: boolean): Promise<number>;
  listProducts(): Promise<Product[]>;
  saveProduct(input: ProductInput): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  /** Uploads an .svga animation or an image and returns a ref to save on a gift or product. */
  uploadFile(file: File, kind: "svga" | "image"): Promise<FileRef>;

  /* Pricing and settings */
  getPricing(): Promise<Pricing>;
  savePricing(p: Pick<Pricing, "vip" | "coinPacks" | "redPackets">): Promise<Pricing>;
  getSettings(): Promise<AppSettings>;
  saveSettings(s: Omit<AppSettings, "updatedAt" | "updatedBy">): Promise<AppSettings>;

  /* User names */
  /** Changes a user's display name and @username. */
  renameUser(userId: string, name: string, handle: string, reason: string): Promise<AdminUser>;

  /* Sarpanch, the official account in the app */
  getSarpanch(): Promise<SarpanchProfile>;
  saveSarpanch(p: Pick<SarpanchProfile, "name" | "handle" | "bio" | "photo">): Promise<SarpanchProfile>;
  /** toUserId null sends to everyone as an announcement. */
  sendAsSarpanch(toUserId: string | null, title: string, body: string): Promise<SarpanchMessage>;
  listSarpanchMessages(): Promise<SarpanchMessage[]>;

  /* Staff */
  listStaff(): Promise<StaffMember[]>;
  saveStaff(member: StaffInput, isNew: boolean): Promise<StaffMember>;

  /** Demo mode only: wipe local data back to the sample set. */
  resetDemo?(): Promise<void>;
}

const API_URL = import.meta.env.VITE_ADMIN_API_URL as string | undefined;

export const adminApi: AdminApi = API_URL ? httpApi(API_URL) : localApi;

export * from "./types";
export * from "./roles";
export { AdminError, MAX_COIN_CHANGE } from "./errors";

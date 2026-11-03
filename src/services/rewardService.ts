/**
 * Spend rewards on the backend: /api/v1/admin/manage/rewards.
 *
 * RANDOM: every `coinThreshold` coins a user spends, they win one enabled item at
 * random; priority 1 is the most likely, 4 the least (weights 4, 3, 2, 1).
 * GUARANTEED: after `coinThreshold` coins they get every enabled item.
 * repeatable: again every `coinThreshold` coins; otherwise once per user.
 */
import { ENDPOINTS } from "../config/api";
import { apiRequest, apiUpload, unwrap, type Upload } from "../lib/api";

export type RewardKind = "RANDOM" | "GUARANTEED";
export type MediaFormat = "PNG" | "JPG" | "JPEG" | "SVGA" | "MP4" | "MP3";

export type RewardItem = {
  id: number;
  name: string;
  itemType: string;
  giftId: string | null;
  quantity: number;
  priority: 1 | 2 | 3 | 4;
  enabled: boolean;
  durationDays: number | null;
  mediaUrl: string | null;
  mediaFormat: MediaFormat | null;
  soundUrl: string | null;
  /** RANDOM: this item's chance per win; GUARANTEED: 100 when enabled. */
  chancePercent: number;
};

export type RewardRule = {
  id: number;
  name: string;
  kind: RewardKind;
  coinThreshold: number;
  repeatable: boolean;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  timesWon: number;
  winners: number;
  items: RewardItem[];
};

export type RuleInput = { name?: string; kind?: RewardKind; coinThreshold?: number; repeatable?: boolean; active?: boolean };
export type ItemInput = {
  name?: string;
  itemType?: string;
  giftId?: string | null;
  quantity?: number;
  priority?: number;
  enabled?: boolean;
  durationDays?: number | null;
  /** true = never expires (clears durationDays). */
  forever?: boolean;
};

export type RewardGrant = {
  id: number;
  userId: number;
  ruleName: string;
  ruleKind: RewardKind;
  itemName: string;
  itemType: string;
  giftId: string | null;
  quantity: number;
  mediaUrl: string | null;
  mediaFormat: MediaFormat | null;
  grantedAt: string;
  expiresAt: string | null;
};

export type Paged<T> = { content: T[]; page: number; size: number; totalElements: number; totalPages?: number };

export const TYPE_LABEL: Record<string, string> = {
  GIFT: "Gift",
  CHAT_BUBBLE: "Chat bubble",
  ENTRY_EFFECT: "Entry effect",
  PROFILE_EFFECT: "Profile effect",
};
export const typeLabel = (t: string) => TYPE_LABEL[t] ?? t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, " ");

export const MEDIA_EXTS = ["png", "jpg", "jpeg", "svga", "mp4", "mp3"];

const base = ENDPOINTS.manageRewards;

export const rewardService = {
  list: async () => unwrap<RewardRule[]>(await apiRequest(base)) ?? [],
  types: async () => unwrap<string[]>(await apiRequest(`${base}/types`)) ?? [],
  grants: async (page: number, userId?: string) =>
    unwrap<Paged<RewardGrant>>(await apiRequest(`${base}/grants?page=${page}&size=20${userId ? `&userId=${encodeURIComponent(userId)}` : ""}`)),
  createRule: async (input: RuleInput) => unwrap<RewardRule>(await apiRequest(base, { method: "POST", body: input })),
  updateRule: async (id: number, patch: RuleInput) => unwrap<RewardRule>(await apiRequest(`${base}/${id}`, { method: "PATCH", body: patch })),
  deleteRule: async (id: number) => {
    await apiRequest(`${base}/${id}`, { method: "DELETE" });
  },
  addItem: async (ruleId: number, input: ItemInput) => unwrap<RewardRule>(await apiRequest(`${base}/${ruleId}/items`, { method: "POST", body: input })),
  updateItem: async (itemId: number, patch: ItemInput) => unwrap<RewardRule>(await apiRequest(`${base}/items/${itemId}`, { method: "PATCH", body: patch })),
  deleteItem: async (itemId: number) => unwrap<RewardRule>(await apiRequest(`${base}/items/${itemId}`, { method: "DELETE" })),
  removeFile: async (itemId: number, kind: "media" | "sound") => unwrap<RewardRule>(await apiRequest(`${base}/items/${itemId}/${kind}`, { method: "DELETE" })),
  upload: (itemId: number, kind: "media" | "sound", file: File, onProgress?: (f: number) => void): Upload<RewardRule> => {
    const form = new FormData();
    form.append("file", file);
    return apiUpload<RewardRule>(`${base}/items/${itemId}/${kind}`, form, onProgress);
  },
};

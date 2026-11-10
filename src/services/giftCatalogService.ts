/**
 * Gifts on the backend: /api/v1/admin/manage/gifts. Super Admins, Admins and
 * Moderators manage them; only a Super Admin can delete one (the server checks).
 *
 * Files go separately, as multipart (field "file"):
 *   POST /{id}/image      PNG, JPG or JPEG (up to 5 MB)
 *   POST /{id}/animation  SVGA (15 MB) or MP4 (40 MB)
 *   POST /{id}/sound      MP3 (10 MB)
 */
import { ENDPOINTS } from "../config/api";
import { apiRequest, apiUpload, unwrap, type Upload } from "../lib/api";

export type ServerGift = {
  id: string;
  name: string;
  price: number;
  category: string;
  sortOrder: number;
  active: boolean;
  imageUrl: string | null;
  animationUrl: string | null;
  animationFormat: "SVGA" | "MP4" | null;
  animationRatio?: string | null;
  soundUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type GiftInput = { name?: string; price?: number; category?: string; sortOrder?: number; active?: boolean };
export type GiftFileKind = "image" | "animation" | "sound";

export const GIFT_CATEGORIES = ["Popular", "Cute", "Romantic", "Celebration", "Royal", "Legendary"] as const;

const base = ENDPOINTS.manageGifts;
const id$ = (id: string) => encodeURIComponent(id);

export const giftCatalogService = {
  list: async () => unwrap<ServerGift[]>(await apiRequest(base)) ?? [],
  create: async (input: GiftInput) => unwrap<ServerGift>(await apiRequest(base, { method: "POST", body: input })),
  update: async (id: string, patch: GiftInput) => unwrap<ServerGift>(await apiRequest(`${base}/${id$(id)}`, { method: "PATCH", body: patch })),
  setDisplay: async (id: string, ratio: string) => {
    await apiRequest(`${base}/${id$(id)}/display`, { method: "PUT", body: { ratio } });
  },
  remove: async (id: string) => {
    await apiRequest(`${base}/${id$(id)}`, { method: "DELETE" });
  },
  removeFile: async (id: string, kind: "animation" | "sound") => unwrap<ServerGift>(await apiRequest(`${base}/${id$(id)}/${kind}`, { method: "DELETE" })),
  upload: (id: string, kind: GiftFileKind, file: File, onProgress?: (f: number) => void): Upload<ServerGift> => {
    const form = new FormData();
    form.append("file", file);
    return apiUpload<ServerGift>(`${base}/${id$(id)}/${kind}`, form, onProgress);
  },
};

/**
 * Coin packs on the backend: /api/v1/admin/coin-packs. SUPER_ADMIN only; the server checks it.
 *
 * Request bodies follow CreateCoinPackRequest and UpdateCoinPackRequest. The image is
 * never part of them: it goes to POST /{id}/image as multipart/form-data (field "file"),
 * and the backend stores it and returns the pack with its new imageUrl.
 */
import { ENDPOINTS } from "../config/api";
import { apiRequest, apiUpload, ApiError, unwrap, type Upload } from "../lib/api";

export type CoinPack = {
  id: number | string;
  name: string;
  coins: number;
  priceInRupees: number;
  bonusCoins: number | null;
  bonusPercentage: number | null;
  badge: string | null;
  active: boolean;
  sortOrder: number | null;
  imageUrl: string | null;
  imagePublicId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

/**
 * CreateCoinPackRequest. These are the fields the panel sends; nothing else (no id,
 * active, imageUrl or imagePublicId). If the backend DTO differs, change it here only.
 */
export type CoinPackInput = {
  name: string;
  coins: number;
  priceInRupees: number;
  bonusCoins: number;
  bonusPercentage: number;
  badge: string | null;
  sortOrder: number;
};

/** UpdateCoinPackRequest (PATCH): only the fields that changed are sent. */
export type CoinPackPatch = Partial<CoinPackInput>;

const base = ENDPOINTS.coinPacks;
const id$ = (id: CoinPack["id"]) => encodeURIComponent(String(id));

/** The backend checks again; this only saves a wasted upload. */
export const PACK_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PACK_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PACK_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

export function packImageProblem(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const typeOk = file.type ? PACK_IMAGE_TYPES.includes(file.type) : ["jpg", "jpeg", "png", "webp"].includes(ext);
  if (!typeOk) return `“${file.name}” isn't a JPEG, PNG or WebP image.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  if (file.size > PACK_IMAGE_MAX_BYTES) return `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`;
  return null;
}

/** Friendlier words for the upload failures the backend can send. */
function uploadError(e: unknown): unknown {
  if (!(e instanceof ApiError)) return e;
  if (e.status === 413) return new ApiError("That image is larger than the server allows (5 MB). Pick a smaller one.", 413, "invalid");
  if (e.status === 415) return new ApiError("The server only takes JPEG, PNG or WebP images.", 415, "invalid");
  return e;
}

const asPack = (raw: unknown) => unwrap<CoinPack>(raw);

export const coinPackService = {
  /** Every pack, including inactive ones. */
  list: async () => unwrap<CoinPack[]>(await apiRequest(base)) ?? [],
  create: async (input: CoinPackInput) => asPack(await apiRequest(base, { method: "POST", body: input })),
  update: async (id: CoinPack["id"], patch: CoinPackPatch) => asPack(await apiRequest(`${base}/${id$(id)}`, { method: "PATCH", body: patch })),
  setActive: async (id: CoinPack["id"], active: boolean) => asPack(await apiRequest(`${base}/${id$(id)}/status?active=${active}`, { method: "PATCH" })),
  /** Uploads or replaces the pack's image. Resolves with the pack (or at least its new imageUrl). */
  uploadImage: (id: CoinPack["id"], file: File, onProgress?: (fraction: number) => void): Upload<{ pack: CoinPack | null; imageUrl: string }> => {
    const form = new FormData();
    form.append("file", file);
    const up = apiUpload<unknown>(`${base}/${id$(id)}/image`, form, onProgress);
    return {
      abort: up.abort,
      promise: up.promise.then(
        (raw) => {
          const body = unwrap<Partial<CoinPack> | null>(raw);
          const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
          if (!imageUrl) throw new ApiError("The upload finished, but the server's reply had no imageUrl. Refresh to check the pack.", 200, "bad_response");
          return { pack: body && body.id !== undefined ? (body as CoinPack) : null, imageUrl };
        },
        (e) => {
          throw uploadError(e);
        },
      ),
    };
  },
};

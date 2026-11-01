/**
 * VIP cosmetics on the backend: /api/v1/admin/vip/cosmetics. SUPER_ADMIN only.
 *
 *   GET  /api/v1/admin/vip/cosmetics          → every uploaded cosmetic
 *   POST /api/v1/admin/vip/cosmetics/upload   multipart: file, vipLevel (1–7), type, format
 *
 * The backend stores each file on Cloudinary and keeps one asset per VIP level + type +
 * format. There is no replace or delete endpoint yet, so the panel never pretends to
 * replace a file. Uploads go through the shared apiUpload (admin token, progress, and the
 * browser's own multipart boundary).
 */
import { ENDPOINTS } from "../config/api";
import { apiRequest, apiUpload, ApiError, unwrap, type Upload } from "../lib/api";

export const VIP_LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;
export type CosmeticType = "FRAME" | "BUBBLE" | "ENTRY" | "BADGE";
export type CosmeticFormat = "SVGA" | "PNG";

export const COSMETIC_TYPES: { value: CosmeticType; label: string }[] = [
  { value: "FRAME", label: "Frame" },
  { value: "BUBBLE", label: "Bubble" },
  { value: "ENTRY", label: "Entry Animation" },
  { value: "BADGE", label: "Badge" },
];
export const typeLabel = (t: string) => COSMETIC_TYPES.find((x) => x.value === t)?.label ?? t;

/** Which formats each type may use. Only a badge can also be a PNG. */
export const FORMATS_FOR: Record<CosmeticType, CosmeticFormat[]> = {
  FRAME: ["SVGA"],
  BUBBLE: ["SVGA"],
  ENTRY: ["SVGA"],
  BADGE: ["SVGA", "PNG"],
};

export const COSMETIC_MAX_BYTES = 15 * 1024 * 1024;

export type VipCosmetic = {
  id: string;
  vipLevel: number;
  cosmeticType: string;
  format: string;
  publicId?: string;
  /** Only an https link is kept; anything else is treated as missing. */
  secureUrl?: string;
  originalFilename?: string;
  createdAt?: string;
  updatedAt?: string;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v) : undefined);
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined);

function toCosmetic(raw: unknown): VipCosmetic | null {
  const d = obj(raw);
  const id = str(d?.id);
  const vipLevel = num(d?.vipLevel);
  const cosmeticType = (str(d?.cosmeticType) ?? str(d?.type))?.toUpperCase();
  const format = str(d?.format)?.toUpperCase();
  if (!d || !id || vipLevel === undefined || !cosmeticType || !format) return null;
  const url = str(d.secureUrl) ?? str(d.url);
  return {
    id,
    vipLevel,
    cosmeticType,
    format,
    publicId: str(d.publicId),
    secureUrl: url && /^https:\/\//i.test(url) ? url : undefined,
    originalFilename: str(d.originalFilename),
    createdAt: str(d.createdAt),
    updatedAt: str(d.updatedAt),
  };
}

function list(body: unknown): unknown[] {
  const d = unwrap<unknown>(body);
  if (Array.isArray(d)) return d;
  const o = obj(d);
  for (const k of ["content", "items", "cosmetics"]) if (o && Array.isArray(o[k])) return o[k] as unknown[];
  throw new ApiError("The server sent a reply the panel couldn't read as a list of cosmetics.", 200, "bad_response");
}

/** Every uploaded cosmetic. Rows the panel can't read (no id, level, type or format) are left out. */
export async function getVipCosmetics(): Promise<VipCosmetic[]> {
  const rows = list(await apiRequest<unknown>(ENDPOINTS.vipCosmetics));
  return rows.map(toCosmetic).filter((c): c is VipCosmetic => c !== null);
}

export const DUPLICATE_MESSAGE = "This cosmetic already exists for the selected VIP level and format.";

/** Sends the multipart form. Resolves only on a 2xx from the server. */
export function uploadVipCosmetic(form: FormData, onProgress?: (fraction: number) => void): Upload<unknown> {
  const up = apiUpload<unknown>(`${ENDPOINTS.vipCosmetics}/upload`, form, onProgress);
  return {
    abort: up.abort,
    promise: up.promise.catch((e: unknown) => {
      if (e instanceof ApiError && e.kind !== "network") {
        if ((e.status === 400 || e.status === 409) && /already exist|duplicate|exists/i.test(e.message)) throw new ApiError(DUPLICATE_MESSAGE, e.status, "invalid");
        if (e.status === 403) throw new ApiError("Only a Super Admin can upload VIP cosmetics. The server turned down your account.", 403, "forbidden");
        if (e.status === 413) throw new ApiError("The server says this file is too large.", 413, "invalid");
        if (e.status === 415) throw new ApiError("The server doesn't accept this file type.", 415, "invalid");
      }
      throw e;
    }),
  };
}

/** Builds the form with the backend's exact field names. */
export function cosmeticForm(file: File, vipLevel: number, type: CosmeticType, format: CosmeticFormat): FormData {
  const form = new FormData();
  form.append("file", file);
  form.append("vipLevel", String(vipLevel));
  form.append("type", type);
  form.append("format", format);
  return form;
}

/** Why this file can't be sent as this format, or null. The backend checks again. */
export function cosmeticFileProblem(file: File, format: CosmeticFormat): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (format === "SVGA" && ext !== "svga") return `“${file.name}” isn't an .svga file. Pick an SVGA animation for this format.`;
  if (format === "PNG" && (ext !== "png" || (file.type && file.type !== "image/png"))) return `“${file.name}” isn't a PNG image. Pick a .png file for this format.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  if (file.size > COSMETIC_MAX_BYTES) return `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 15 MB.`;
  return null;
}

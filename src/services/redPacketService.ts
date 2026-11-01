/**
 * Red packet products on the backend: /api/v1/admin/red-packets. SUPER_ADMIN only.
 *
 * Request bodies follow CreateRedPacketRequest and UpdateRedPacketRequest. The image goes
 * separately to POST /{id}/image as multipart/form-data (field "file"), the same contract
 * as coin packs. If the server doesn't have that endpoint yet (404 or 405), the panel says
 * so instead of pretending the upload worked.
 */
import { ENDPOINTS } from "../config/api";
import { apiRequest, apiUpload, ApiError, unwrap, type Upload } from "../lib/api";

export type RedPacketProduct = {
  id: number | string;
  name: string;
  coinValue: number;
  priceInRupees: number;
  imageUrl: string | null;
  imagePublicId?: string | null;
  active: boolean;
  sortOrder: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

/** CreateRedPacketRequest. No id, active or image fields. If the DTO differs, change it here only. */
export type RedPacketInput = {
  name: string;
  coinValue: number;
  priceInRupees: number;
  sortOrder: number;
};

/** UpdateRedPacketRequest (PATCH): only the fields that changed are sent. */
export type RedPacketPatch = Partial<RedPacketInput>;

const base = ENDPOINTS.redPackets;
const id$ = (id: RedPacketProduct["id"]) => encodeURIComponent(String(id));
const asProduct = (raw: unknown) => unwrap<RedPacketProduct>(raw);

export const redPacketService = {
  /** Every product, including inactive ones. */
  list: async () => unwrap<RedPacketProduct[]>(await apiRequest(base)) ?? [],
  create: async (input: RedPacketInput) => asProduct(await apiRequest(base, { method: "POST", body: input })),
  update: async (id: RedPacketProduct["id"], patch: RedPacketPatch) => asProduct(await apiRequest(`${base}/${id$(id)}`, { method: "PATCH", body: patch })),
  setActive: async (id: RedPacketProduct["id"], active: boolean) => asProduct(await apiRequest(`${base}/${id$(id)}/status?active=${active}`, { method: "PATCH" })),
  /** Uploads or replaces the product's image. Resolves with the new imageUrl from the server. */
  uploadImage: (id: RedPacketProduct["id"], file: File, onProgress?: (fraction: number) => void): Upload<{ imageUrl: string }> => {
    const form = new FormData();
    form.append("file", file);
    const up = apiUpload<unknown>(`${base}/${id$(id)}/image`, form, onProgress);
    return {
      abort: up.abort,
      promise: up.promise.then(
        (raw) => {
          const body = unwrap<Partial<RedPacketProduct> | null>(raw);
          const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
          if (!imageUrl) throw new ApiError("The upload finished, but the server's reply had no imageUrl. Refresh to check the product.", 200, "bad_response");
          return { imageUrl };
        },
        (e) => {
          if (e instanceof ApiError && (e.status === 404 || e.status === 405))
            throw new ApiError("The server doesn't accept red packet images yet. The backend needs POST /api/v1/admin/red-packets/{id}/image (multipart, field \"file\"), like coin packs have.", e.status, "invalid");
          if (e instanceof ApiError && e.status === 413) throw new ApiError("That image is larger than the server allows (5 MB). Pick a smaller one.", 413, "invalid");
          if (e instanceof ApiError && e.status === 415) throw new ApiError("The server only takes JPEG, PNG or WebP images.", 415, "invalid");
          throw e;
        },
      ),
    };
  },
};

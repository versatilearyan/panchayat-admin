/** Shop image uploads (POST /api/v1/admin/shop/assets/upload) and turning asset references into image links. */
import { BACKEND_URL, ENDPOINTS } from "../config/api";
import { apiUpload, ApiError, unwrap, type Upload } from "../lib/api";
import { getSession } from "../api/session";

export const ASSET_MAX_BYTES = 5 * 1024 * 1024;
/** Same limit as pictures, matching the backend. */
export const SVGA_MAX_BYTES = 5 * 1024 * 1024;
export const ASSET_ACCEPT = ".png,.jpg,.jpeg,.webp,.svg,.svga,image/png,image/jpeg,image/webp,image/svg+xml";
export const ASSET_KINDS_TEXT = "PNG, JPG, JPEG, WEBP, SVG or SVGA";
const ASSET_TYPES: Record<string, string[]> = {
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  svg: ["image/svg+xml"],
  // Browsers don't know SVGA; they send no type or a generic one
  svga: ["", "application/octet-stream", "application/x-svga", "application/svga", "application/zip"],
};

/** True when the link or file name ends in .svga (any ?query or #hash ignored). */
export const isSvgaRef = (ref?: string | null) => Boolean(ref && /\.svga$/i.test(ref.split(/[?#]/)[0]));

/** Why this file can't be uploaded, or null. The backend checks again; this only saves a wasted upload. */
export function assetFileProblem(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const types = ASSET_TYPES[ext];
  // Some systems send no type for a file; then the extension decides
  if (!types || (file.type && !types.includes(file.type))) return `“${file.name}” isn't a supported file. Use ${ASSET_KINDS_TEXT}.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  const max = ext === "svga" ? SVGA_MAX_BYTES : ASSET_MAX_BYTES;
  if (file.size > max) return `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${max / 1024 / 1024} MB.`;
  return null;
}

type UploadResponse = { success?: boolean; message?: string; assetPath?: string; assetUrl?: string; assetType?: string };
export type UploadedAsset = {
  /** What the product stores in its assetUrl field: the backend's assetUrl, or assetPath when that's all it sent. */
  ref: string;
  assetUrl?: string;
  assetPath?: string;
  /** "SVGA" or "IMAGE", as the backend reports it. */
  assetType?: string;
};

export function uploadShopAsset(file: File, onProgress?: (fraction: number) => void): Upload<UploadedAsset> {
  const form = new FormData();
  form.append("file", file);
  const up = apiUpload<unknown>(ENDPOINTS.shopAssetUpload, form, onProgress);
  return {
    abort: up.abort,
    promise: up.promise.then((raw) => {
      const body = unwrap<UploadResponse | null>(raw) ?? (raw as UploadResponse | null);
      const top = raw as UploadResponse | null;
      if (top?.success === false || body?.success === false) throw new ApiError(top?.message || body?.message || "The upload wasn't accepted.", 200, "invalid");
      const assetUrl = typeof body?.assetUrl === "string" && body.assetUrl.trim() ? body.assetUrl.trim() : undefined;
      const assetPath = typeof body?.assetPath === "string" && body.assetPath.trim() ? body.assetPath.trim() : undefined;
      if (!assetUrl && !assetPath) throw new ApiError("The upload finished, but the backend's reply had no assetUrl or assetPath.", 200, "bad_response");
      const assetType = typeof body?.assetType === "string" ? body.assetType.trim().toUpperCase() : undefined;
      return { ref: (assetUrl ?? assetPath)!, assetUrl, assetPath, assetType };
    }),
  };
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);
/** Paths the dev server forwards to the backend (vite.config.ts). */
const PROXIED = /^\/(api|uploads)\//;

/** A path on the backend, as a link this browser can open. */
function onBackend(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  // In `npm run dev`, Vite forwards /uploads to the backend with the ngrok header, so ngrok's warning page can't replace the image
  if (import.meta.env.DEV && PROXIED.test(p)) return p;
  return BACKEND_URL ? `${BACKEND_URL}${p}` : null;
}

/**
 * Where to load a product or category image from.
 * - A link to some other server (a CDN) is used as is.
 * - A link to the backend, or to "localhost" when the backend is somewhere else
 *   (the server only knows itself as localhost:8080), is loaded from VITE_API_BASE_URL.
 * - A path like /uploads/x.png is loaded from VITE_API_BASE_URL.
 */
export function assetDisplayUrl(ref?: string | null): string | null {
  const v = ref?.trim();
  if (!v) return null;
  if (v.startsWith("blob:")) return v;
  if (!/^https?:\/\//i.test(v)) return v.startsWith("/") || !v.includes(":") ? onBackend(v) : null;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  const backend = BACKEND_URL ? new URL(BACKEND_URL) : null;
  if (backend && u.origin === backend.origin) return onBackend(u.pathname + u.search);
  if (backend && LOCAL_HOSTS.has(u.hostname)) return onBackend(u.pathname + u.search);
  return v;
}

/* ---------- loading uploaded files for previews ---------- */

const blobs = new Map<string, Promise<string>>();

/** True when the link points at our backend (or the dev proxy in front of it). */
const isBackendLink = (url: string) => url.startsWith("/") || (BACKEND_URL !== "" && url.startsWith(BACKEND_URL));

/**
 * Loads an uploaded file and returns a link <img> or the SVGA player can use.
 * Files on the backend are fetched with the ngrok header and the admin token, so
 * neither ngrok's warning page nor a login-protected /uploads breaks the preview.
 * Other links (a CDN) are used as they are.
 */
export function loadAsset(ref: string): Promise<string> {
  const url = assetDisplayUrl(ref);
  if (!url) return Promise.reject(new Error("This file has no usable link."));
  if (url.startsWith("blob:") || !isBackendLink(url)) return Promise.resolve(url);
  let p = blobs.get(url);
  if (!p) {
    p = fetchBlob(url);
    blobs.set(url, p);
    // A failure isn't cached, so the next look tries again
    p.catch(() => blobs.delete(url));
  }
  return p;
}

async function fetchBlob(url: string): Promise<string> {
  const headers: Record<string, string> = { "ngrok-skip-browser-warning": "true" };
  const token = getSession()?.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch {
    throw new Error("Couldn't reach the backend to load this file.");
  }
  const path = url.replace(/^https?:\/\/[^/]+/, "");
  if (res.headers.get("ngrok-error-code")) throw new Error("The ngrok tunnel is offline, so the file can't be shown.");
  if (res.headers.get("x-panel-proxy-error")) throw new Error("Couldn't reach the backend to load this file.");
  if (res.status === 401 || res.status === 403)
    throw new Error(`The backend refused ${path} (${res.status}). Allow GET /uploads/** without login in Spring Security, so the app can show it too.`);
  if (res.status === 404)
    throw new Error(
      `No file at ${path} (404). ${import.meta.env.DEV && url.startsWith("/") ? "If you just updated the panel, restart npm run dev. Otherwise check" : "Check"} that the backend serves its uploads folder at /uploads/**.`,
    );
  if (!res.ok) throw new Error(`The backend couldn't send ${path} (${res.status}).`);
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("text/html"))
    throw new Error(
      import.meta.env.DEV && url.startsWith("/")
        ? "Got a web page instead of the file. Stop npm run dev and start it again so the new /uploads forwarding is used."
        : `Got a web page instead of the file at ${path}. Check that the backend serves /uploads/**.`,
    );
  return URL.createObjectURL(await res.blob());
}

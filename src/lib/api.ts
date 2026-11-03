/**
 * The one HTTP client for the Spring Boot backend.
 *
 * - Adds `Authorization: Bearer <jwt>` to every request except public ones (sign-in).
 * - Adds `ngrok-skip-browser-warning` so ngrok returns JSON, not its warning page.
 * - Turns failures into ApiError with a message staff can act on.
 * - On 401 the session is cleared once and the panel goes back to sign-in.
 * Tokens and passwords are never logged.
 */
import { API_BASE_URL, API_TIMEOUT_MS, BACKEND_ENABLED } from "../config/api";
import { getSession, setSession } from "../api/session";

export type ApiErrorKind = "network" | "unauthorized" | "forbidden" | "not_found" | "invalid" | "server" | "bad_response";

export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  constructor(message: string, status: number, kind: ApiErrorKind) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
  }
}

export const MESSAGES = {
  network: "Can't reach the backend. Check that the server and the ngrok tunnel are running, then try again.",
  tunnelOffline: "The ngrok tunnel is offline. Start ngrok again; if its URL changed, put the new one in VITE_API_BASE_URL in .env.local and restart npm run dev.",
  timeout: "The backend took too long to answer. Try again.",
  expired: "Your session has ended. Sign in again.",
  forbidden: "You don't have access to this.",
  notFound: "That item wasn't found. It may have been removed. Refresh and try again.",
  server: "The server had a problem. Try again in a moment.",
  badResponse: "The backend sent a reply the panel couldn't read.",
} as const;

/* ---------- 401: sign out once ---------- */

let onUnauthorized: (() => void) | null = null;
let signingOut = false;

/** App registers what to do when the backend rejects the token. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

/** Called after a successful sign-in so the next expiry is handled again. */
export function resetUnauthorized() {
  signingOut = false;
}

function handleUnauthorized() {
  // Several requests can fail together: clear the session and redirect only once
  if (signingOut) return;
  signingOut = true;
  setSession(null);
  onUnauthorized?.();
}

/* ---------- requests ---------- */

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** false for public endpoints. The token is never sent to them. */
  auth?: boolean;
};

/** Pulls a readable message out of a Spring error body, if it has one. */
function backendMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  // Bean Validation: { errors: [{ defaultMessage | message, field }] } or { errors: { field: msg } }
  if (Array.isArray(b.errors) && b.errors.length) {
    const msgs = b.errors
      .map((e) => (typeof e === "string" ? e : e && typeof e === "object" ? ((e as Record<string, unknown>).defaultMessage ?? (e as Record<string, unknown>).message) : null))
      .filter((m): m is string => typeof m === "string" && m.trim() !== "");
    if (msgs.length) return msgs.join(" ");
  }
  if (b.errors && typeof b.errors === "object" && !Array.isArray(b.errors)) {
    const msgs = Object.values(b.errors as Record<string, unknown>).filter((m): m is string => typeof m === "string");
    if (msgs.length) return msgs.join(" ");
  }
  for (const k of ["message", "error_description", "detail"]) {
    const v = b[k];
    if (typeof v === "string" && v.trim() && v !== "No message available") return v.trim();
  }
  return null;
}

function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // ngrok's browser warning or an HTML error page
    return { __html: true };
  }
}

/** The token for an authenticated call. Missing → sign out and stop. */
function bearer(): string {
  const token = getSession()?.token;
  if (!token) {
    handleUnauthorized();
    throw new ApiError(MESSAGES.expired, 401, "unauthorized");
  }
  return `Bearer ${token}`;
}

/** Turns a finished response into data or an ApiError. Shared by fetch calls and uploads. */
function interpret<T>(status: number, header: (name: string) => string | null, text: string, auth: boolean): T {
  // ngrok answers for a tunnel that isn't connected (ERR_NGROK_3200 and friends)
  const ngrokError = header("ngrok-error-code");
  if (ngrokError) throw new ApiError(`${MESSAGES.tunnelOffline} (${ngrokError})`, status, "network");
  const data = parseBody(text);
  // The dev proxy couldn't connect at all (bad URL, DNS, server down)
  if (header("x-panel-proxy-error")) throw new ApiError(`${MESSAGES.network} ${(data as { message?: string } | null)?.message ?? ""}`.trim(), status, "network");

  const html = Boolean(data && typeof data === "object" && "__html" in data);
  const msg = html ? null : backendMessage(data);

  if (status >= 200 && status < 300) {
    if (html) throw new ApiError(MESSAGES.badResponse, status, "bad_response");
    return data as T;
  }
  if (status === 401) {
    if (auth) {
      handleUnauthorized();
      throw new ApiError(MESSAGES.expired, 401, "unauthorized");
    }
    // Public endpoint (sign-in): wrong details, nothing to sign out of
    throw new ApiError(msg ?? "Wrong username or password.", 401, "unauthorized");
  }
  if (status === 403) throw new ApiError(auth ? MESSAGES.forbidden : (msg ?? MESSAGES.forbidden), 403, "forbidden");
  if (status === 404) throw new ApiError(msg ?? MESSAGES.notFound, 404, "not_found");
  if (status === 413) throw new ApiError(msg ?? "That file is too big for the server.", 413, "invalid");
  if (status === 502 || status === 503 || status === 504) throw new ApiError("The backend couldn't finish this, maybe because its file storage didn't answer. Try again in a moment.", status, "server");
  if (status >= 500) throw new ApiError(MESSAGES.server, status, "server");
  // 400, 409, 415, 422: the backend's own reason, e.g. a validation message
  throw new ApiError(msg ?? "The backend didn't accept that. Check the details and try again.", status, "invalid");
}

const NOT_CONFIGURED = "The backend URL isn't set. Add VITE_API_BASE_URL to .env.local and restart the panel.";

export async function apiRequest<T>(path: string, { method = "GET", body, auth = true }: RequestOptions = {}): Promise<T> {
  if (!BACKEND_ENABLED) throw new ApiError(NOT_CONFIGURED, 0, "network");

  const headers: Record<string, string> = { Accept: "application/json", "ngrok-skip-browser-warning": "true" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) headers.Authorization = bearer();

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal });
    text = await res.text();
  } catch (e) {
    throw new ApiError(e instanceof DOMException && e.name === "AbortError" ? MESSAGES.timeout : MESSAGES.network, 0, "network");
  } finally {
    window.clearTimeout(timer);
  }
  return interpret<T>(res.status, (n) => res.headers.get(n), text, auth);
}

export type Upload<T> = { promise: Promise<T>; abort: () => void };

/**
 * Sends a file as multipart/form-data with the admin token, reporting progress (0–1).
 * Uses XMLHttpRequest because fetch can't report upload progress. Content-Type is left
 * to the browser so it adds the multipart boundary.
 */
export function apiUpload<T>(path: string, form: FormData, onProgress?: (fraction: number) => void): Upload<T> {
  let xhr: XMLHttpRequest | null = null;
  const promise = new Promise<T>((resolve, reject) => {
    if (!BACKEND_ENABLED) return reject(new ApiError(NOT_CONFIGURED, 0, "network"));
    let auth: string;
    try {
      auth = bearer();
    } catch (e) {
      return reject(e);
    }
    const req = new XMLHttpRequest();
    xhr = req;
    req.open("POST", `${API_BASE_URL}${path}`);
    // Big SVGA and MP4 files (up to 100 MB) can take a while on a slow connection
    req.timeout = 600_000;
    req.setRequestHeader("Accept", "application/json");
    req.setRequestHeader("ngrok-skip-browser-warning", "true");
    req.setRequestHeader("Authorization", auth);
    req.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total);
    };
    req.onerror = () => reject(new ApiError(MESSAGES.network, 0, "network"));
    req.ontimeout = () => reject(new ApiError(MESSAGES.timeout, 0, "network"));
    req.onabort = () => reject(new ApiError("Upload cancelled.", 0, "network"));
    req.onload = () => {
      try {
        resolve(interpret<T>(req.status, (n) => req.getResponseHeader(n), req.responseText, true));
      } catch (e) {
        reject(e);
      }
    };
    req.send(form);
  });
  return { promise, abort: () => xhr?.abort() };
}

/**
 * Some endpoints may wrap results as { success, data }. Accept both that and a bare value,
 * so a list endpoint works either way.
 */
export function unwrap<T>(body: unknown): T {
  if (body && typeof body === "object" && !Array.isArray(body) && "data" in body && ("success" in body || "message" in body)) return (body as { data: T }).data;
  return body as T;
}

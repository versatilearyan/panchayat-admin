/**
 * The admin API on the real backend. Each method is one REST call.
 *
 *   POST   /admin/login                 { username, password }         → AdminSession (token, name, role, title)
 *   GET    /admin/stats                                                 → AdminStats
 *   GET    /admin/users?q=&filter=                                      → AdminUser[]
 *   GET    /admin/users/:id                                             → AdminUserDetail
 *   POST   /admin/users/:id/coins       { amount, reason }              → CoinTx
 *   POST   /admin/users/:id/ban         { reason, message, durationMs } → Sanction
 *   DELETE /admin/users/:id/ban                                         → 204
 *   POST   /admin/users/:id/mute        { reason, durationMs }          → Sanction
 *   DELETE /admin/users/:id/mute                                        → 204
 *   POST   /admin/users/:id/warn        { reason, message }             → Sanction
 *   POST   /admin/users/:id/kick        { roomId, reason, durationMs }  → Sanction
 *   DELETE /admin/sanctions/:id                                         → 204
 *   PUT    /admin/users/:id/note        { note }                        → 204
 *   GET    /admin/rooms                                                 → AdminRoom[]
 *   GET    /admin/reports?status=                                       → Report[]
 *   PATCH  /admin/reports/:id           { status }                      → Report
 *   GET    /admin/audit?limit=                                          → AuditEntry[]
 *
 *   POST   /admin/users/:id/vip         { level, days, reason }         → Grant      (days null = forever)
 *   POST   /admin/users/:id/items       { productId, days, reason }     → Grant
 *   DELETE /admin/grants/:id                                           → 204
 *   POST   /admin/rooms                 RoomInput                       → AdminRoom
 *   PATCH  /admin/rooms/:id             RoomPatch                       → AdminRoom
 *   DELETE /admin/rooms/:id                                            → 204
 *   GET    /admin/gifts                                                → GiftItem[]
 *   POST   /admin/gifts                 GiftInput                       → GiftItem
 *   PUT    /admin/gifts/:id             GiftInput                       → GiftItem
 *   DELETE /admin/gifts/:id                                            → 204
 *   GET    /admin/products                                             → Product[]
 *   POST   /admin/products              ProductInput                    → Product
 *   PUT    /admin/products/:id          ProductInput                    → Product
 *   DELETE /admin/products/:id                                         → 204
 *   POST   /admin/uploads               multipart: file, kind           → { url }    (store on a CDN)
 *   GET    /admin/pricing                                              → Pricing
 *   PUT    /admin/pricing               { vip, coinPacks }              → Pricing
 *   GET    /admin/settings                                             → AppSettings
 *   PUT    /admin/settings              AppSettings                     → AppSettings
 *   POST   /admin/gifts/coming-soon     { ids, comingSoon }              → { changed }
 *   PATCH  /admin/users/:id/profile     { name, handle, reason }        → AdminUser  (handle unique, reserved names blocked)
 *   GET    /admin/sarpanch                                             → SarpanchProfile
 *   PUT    /admin/sarpanch              { name, handle, bio, photo }    → SarpanchProfile
 *   POST   /admin/sarpanch/messages     { toUserId, title, body }       → SarpanchMessage (toUserId null = everyone)
 *   GET    /admin/sarpanch/messages                                    → SarpanchMessage[]
 *   GET    /admin/staff                                                → StaffMember[]
 *   POST   /admin/staff                 StaffInput                      → StaffMember
 *   PUT    /admin/staff/:username       StaffInput                      → StaffMember
 *
 * The server checks the staff member's role on every call, using the same
 * table as src/api/roles.ts (ROLE_PERMISSIONS and COIN_LIMIT).
 *
 * durationMs is null for permanent. Errors return { message } with a 4xx status.
 * Every request except login sends `Authorization: Bearer <token>`.
 */
import { AdminError } from "./errors";
import { checkUpload } from "./files";
import type { AdminApi } from "./index";
import { getSession, setSession } from "./session";

export function httpApi(base: string): AdminApi {
  const root = base.replace(/\/$/, "");
  const call = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
    const token = getSession()?.token;
    let res: Response;
    try {
      res = await fetch(`${root}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new AdminError("Can't reach the server. Check your connection.");
    }
    if (res.status === 401) {
      setSession(null);
      window.location.reload();
    }
    if (!res.ok) {
      const msg = await res.json().then((j: { message?: string }) => j.message).catch(() => undefined);
      throw new AdminError(msg ?? `Request failed (${res.status})`);
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  };
  const u = (id: string) => `/admin/users/${encodeURIComponent(id)}`;
  return {
    mode: "http",
    login: (username, password) => call("POST", "/admin/login", { username, password }),
    stats: () => call("GET", "/admin/stats"),
    listUsers: (q = "", filter = "all") => call("GET", `/admin/users?q=${encodeURIComponent(q)}&filter=${filter}`),
    getUser: (id) => call("GET", u(id)),
    adjustCoins: (id, amount, reason) => call("POST", `${u(id)}/coins`, { amount, reason }),
    ban: (id, reason, durationMs, message) => call("POST", `${u(id)}/ban`, { reason, message, durationMs }),
    unban: (id) => call("DELETE", `${u(id)}/ban`),
    mute: (id, reason, durationMs) => call("POST", `${u(id)}/mute`, { reason, durationMs }),
    unmute: (id) => call("DELETE", `${u(id)}/mute`),
    warn: (id, reason, message) => call("POST", `${u(id)}/warn`, { reason, message }),
    kick: (id, roomId, reason, durationMs) => call("POST", `${u(id)}/kick`, { roomId, reason, durationMs }),
    liftSanction: (id) => call("DELETE", `/admin/sanctions/${encodeURIComponent(id)}`),
    setNote: (id, note) => call("PUT", `${u(id)}/note`, { note }),
    listRooms: () => call("GET", "/admin/rooms"),
    listReports: (status) => call("GET", `/admin/reports${status ? `?status=${status}` : ""}`),
    setReportStatus: (id, status) => call("PATCH", `/admin/reports/${encodeURIComponent(id)}`, { status }),
    listAudit: (limit = 200) => call("GET", `/admin/audit?limit=${limit}`),
    grantVip: (id, level, days, reason) => call("POST", `${u(id)}/vip`, { level, days, reason }),
    grantItem: (id, productId, days, reason) => call("POST", `${u(id)}/items`, { productId, days, reason }),
    revokeGrant: (id) => call("DELETE", `/admin/grants/${encodeURIComponent(id)}`),
    createRoom: (input) => call("POST", "/admin/rooms", input),
    updateRoom: (id, patch) => call("PATCH", `/admin/rooms/${encodeURIComponent(id)}`, patch),
    deleteRoom: (id) => call("DELETE", `/admin/rooms/${encodeURIComponent(id)}`),
    listGifts: () => call("GET", "/admin/gifts"),
    saveGift: (g) => (g.id ? call("PUT", `/admin/gifts/${encodeURIComponent(g.id)}`, g) : call("POST", "/admin/gifts", g)),
    deleteGift: (id) => call("DELETE", `/admin/gifts/${encodeURIComponent(id)}`),
    listProducts: () => call("GET", "/admin/products"),
    saveProduct: (p) => (p.id ? call("PUT", `/admin/products/${encodeURIComponent(p.id)}`, p) : call("POST", "/admin/products", p)),
    deleteProduct: (id) => call("DELETE", `/admin/products/${encodeURIComponent(id)}`),
    async uploadFile(file, kind) {
      checkUpload(file, kind);
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      const token = getSession()?.token;
      const res = await fetch(`${root}/admin/uploads`, { method: "POST", body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => {
        throw new AdminError("Can't reach the server. Check your connection.");
      });
      if (!res.ok) throw new AdminError(`Upload failed (${res.status})`);
      return ((await res.json()) as { url: string }).url;
    },
    getPricing: () => call("GET", "/admin/pricing"),
    savePricing: (p) => call("PUT", "/admin/pricing", p),
    getSettings: () => call("GET", "/admin/settings"),
    saveSettings: (st) => call("PUT", "/admin/settings", st),
    setGiftsComingSoon: (ids, comingSoon) => call<{ changed: number }>("POST", "/admin/gifts/coming-soon", { ids, comingSoon }).then((r) => r.changed),
    renameUser: (id, name, handle, reason) => call("PATCH", `${u(id)}/profile`, { name, handle, reason }),
    getSarpanch: () => call("GET", "/admin/sarpanch"),
    saveSarpanch: (p) => call("PUT", "/admin/sarpanch", p),
    sendAsSarpanch: (toUserId, title, body) => call("POST", "/admin/sarpanch/messages", { toUserId, title, body }),
    listSarpanchMessages: () => call("GET", "/admin/sarpanch/messages"),
    listStaff: () => call("GET", "/admin/staff"),
    saveStaff: (m, isNew) => (isNew ? call("POST", "/admin/staff", m) : call("PUT", `/admin/staff/${encodeURIComponent(m.username)}`, m)),
  };
}

/** Sign-in against the Spring Boot backend: POST /api/admin/auth/login. */
import { ENDPOINTS } from "../config/api";
import { apiRequest, ApiError, resetUnauthorized } from "../lib/api";
import { ROLE_LABEL, type Role } from "../api/roles";
import { setSession, tokenExpired, type AdminSession } from "../api/session";

export type BackendRole = "SUPER_ADMIN" | "ADMIN" | "MODERATOR";

type LoginResponse = {
  success?: boolean;
  message?: string;
  tokenType?: string;
  /** The JWT. The backend calls it accessToken. */
  accessToken?: string;
  user?: { id?: string | number; username?: string; role?: string };
};

const ROLE_MAP: Record<BackendRole, Role> = { SUPER_ADMIN: "super_admin", ADMIN: "admin", MODERATOR: "moderator" };

/** "super_admin", "ROLE_SUPER_ADMIN" or "Super Admin" → "SUPER_ADMIN". Anything else → null. */
export function normalizeRole(raw: unknown): BackendRole | null {
  if (typeof raw !== "string") return null;
  const r = raw.trim().toUpperCase().replace(/[\s-]+/g, "_").replace(/^ROLE_/, "");
  return r in ROLE_MAP ? (r as BackendRole) : null;
}

export const toPanelRole = (r: BackendRole): Role => ROLE_MAP[r];

const BAD_REPLY = "The backend's sign-in reply was missing the accessToken or your account details. Ask the backend team to check /api/admin/auth/login.";

export async function login(username: string, password: string): Promise<AdminSession> {
  // Public endpoint: auth:false keeps any old token off this request
  const res = await apiRequest<LoginResponse>(ENDPOINTS.login, { method: "POST", body: { username, password }, auth: false });

  if (!res || res.success !== true) throw new ApiError(res?.message || "Sign-in failed. Check your username and password.", 200, "invalid");
  if (res.tokenType && res.tokenType.toLowerCase() !== "bearer") throw new ApiError(BAD_REPLY, 200, "bad_response");
  const token = typeof res.accessToken === "string" ? res.accessToken.trim() : "";
  const user = res.user;
  if (!token || token.split(".").length !== 3 || !user || typeof user !== "object" || typeof user.username !== "string" || !user.username) throw new ApiError(BAD_REPLY, 200, "bad_response");
  if (tokenExpired(token)) throw new ApiError("The backend sent a token that has already expired. Check the server's clock.", 200, "bad_response");
  const backendRole = normalizeRole(user.role);
  if (!backendRole) throw new ApiError("Your account doesn't have an admin panel role. Ask a super admin to give you one.", 200, "forbidden");

  const role = toPanelRole(backendRole);
  const session: AdminSession = { username: user.username, name: user.username, role, title: ROLE_LABEL[role], token, userId: user.id };
  setSession(session);
  resetUnauthorized();
  return session;
}

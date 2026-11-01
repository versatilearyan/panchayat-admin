/**
 * Who is signed in to the admin panel.
 *
 * Demo mode: a staff username and password, kept in sessionStorage for this tab.
 * That only keeps casual visitors out. It is NOT security, because the demo
 * passwords live in this browser. With the backend (VITE_API_BASE_URL), sign-in is
 * `POST /api/admin/auth/login`, which returns a JWT and the staff member's role,
 * and the server checks that token and role on every admin request.
 */
import type { Role } from "./roles";

export type AdminSession = {
  username: string;
  name: string;
  role: Role;
  title: string;
  /** JWT from the backend. Only set when signed in through the Spring Boot API. */
  token?: string;
  /** The staff member's id on the backend. */
  userId?: string | number;
};

/** Reads the `exp` claim of a JWT (seconds). Returns null when the token has none or can't be read. */
export function tokenExpiry(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** A token past its expiry. The backend still decides; this only saves a pointless request. */
export const tokenExpired = (token: string) => {
  const exp = tokenExpiry(token);
  return exp !== null && exp <= Date.now();
};

const KEY = "panchayat-admin-session";

/**
 * Each demo staff account's starting password, from .env.local (VITE_PASS_<USERNAME>).
 * There's no shared default: an account without one can't sign in.
 * Super admins can change passwords on the Staff page.
 */
const ENV_PASSWORDS: Record<string, string | undefined> = {
  aryan: import.meta.env.VITE_PASS_ARYAN,
  bharat: import.meta.env.VITE_PASS_BHARAT,
  nikhil: import.meta.env.VITE_PASS_NIKHIL,
  shivam: import.meta.env.VITE_PASS_SHIVAM,
  vansh: import.meta.env.VITE_PASS_VANSH,
};
export const startingPassword = (username: string) => ENV_PASSWORDS[username]?.trim() ?? "";

/** The old shared demo password. Accounts still on it are moved to their own password. */
export const OLD_SHARED_PASSWORD = "panchayat-admin";

export function getSession(): AdminSession | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as Partial<AdminSession>) : null;
    // Sessions from before staff roles have no username: sign in again
    if (!s?.username || !s.role) return null;
    if (s.token !== undefined && (!s.token || tokenExpired(s.token))) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    return s as AdminSession;
  } catch {
    return null;
  }
}

export function setSession(s: AdminSession | null) {
  try {
    if (s) window.sessionStorage.setItem(KEY, JSON.stringify(s));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* sessionStorage blocked: the session lasts until reload */
  }
}

/** Name recorded in the activity log for each action. */
export const actorName = () => getSession()?.name ?? "Admin";
export const actorRole = () => getSession()?.role;

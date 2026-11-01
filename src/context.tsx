/** Panel-wide state: who's signed in, the open user, data refreshes and toasts. */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { can as roleCan, type Permission } from "./api/roles";
import type { AdminSession } from "./api/session";

export const PAGES = ["overview", "users", "rooms", "reports", "gifts", "shop", "coinPacks", "redPackets", "wallets", "vip", "vipCosmetics", "pricing", "sarpanch", "activity", "staff", "settings"] as const;
export type Page = (typeof PAGES)[number];

/** Pages that need a permission to open. The rest are open to all staff. */
export const PAGE_PERMISSION: Partial<Record<Page, Permission>> = {
  gifts: "gifts.manage",
  shop: "store.manage",
  coinPacks: "wallet.manage",
  redPackets: "wallet.manage",
  wallets: "users.coins",
  vip: "vip.manage",
  vipCosmetics: "vip.manage",
  pricing: "pricing.view",
  sarpanch: "sarpanch.manage",
  staff: "staff.manage",
  settings: "settings.edit",
};
export type Toast = { id: number; text: string; tone: "ok" | "error" };

type Ctx = {
  session: AdminSession;
  signOut: () => void;
  /** What the signed-in staff member's role allows. The API checks it again. */
  can: (p: Permission) => boolean;
  page: Page;
  go: (p: Page) => void;
  /** User shown in the side drawer. */
  userId: string | null;
  openUser: (id: string | null) => void;
  /** Bumped after every change so lists reload. */
  version: number;
  changed: () => void;
  toasts: Toast[];
  toast: (text: string, tone?: Toast["tone"]) => void;
};

const AdminCtx = createContext<Ctx | null>(null);

const pageFromHash = (): Page => {
  const h = window.location.hash.replace(/^#\/?/, "");
  return (PAGES as readonly string[]).includes(h) ? (h as Page) : "overview";
};

let toastSeq = 1;

export function AdminProvider({ session, signOut, children }: { session: AdminSession; signOut: () => void; children: ReactNode }) {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [userId, setUserId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const go = useCallback((p: Page) => {
    setPage(p);
    window.history.replaceState(null, "", `#/${p}`);
  }, []);
  const changed = useCallback(() => setVersion((v) => v + 1), []);
  const toast = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = toastSeq++;
    // Several requests failing together show one toast, not a stack of the same message
    setToasts((t) => (t.some((x) => x.text === text) ? t : [...t.slice(-2), { id, text, tone }]));
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const can = useCallback((p: Permission) => roleCan(session.role, p), [session.role]);
  const value = useMemo(() => ({ session, signOut, can, page, go, userId, openUser: setUserId, version, changed, toasts, toast }), [session, signOut, can, page, go, userId, version, changed, toasts, toast]);
  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}

export function useAdmin() {
  const v = useContext(AdminCtx);
  if (!v) throw new Error("useAdmin must be used inside <AdminProvider>");
  return v;
}

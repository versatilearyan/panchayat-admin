/**
 * Where the Spring Boot backend lives. This is the only place the URL is read.
 *
 * Set VITE_API_BASE_URL in .env.local (never committed), for example
 *   VITE_API_BASE_URL=https://xxxx.ngrok-free.app
 * and restart `npm run dev`. Leave it empty to run the panel on demo data.
 * ngrok URLs change every time the tunnel restarts, so update it when that happens.
 */
export const BACKEND_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

/**
 * The user app (the website). The Festival Manager shows its /festival-preview page in a phone frame, so the preview is the real app code.
 * Set VITE_USER_APP_URL to change it.
 */
export const USER_APP_URL = ((import.meta.env.VITE_USER_APP_URL ?? "").trim() || (import.meta.env.DEV ? "http://localhost:3000" : "https://panchayat.world")).replace(/\/+$/, "");

/** True when sign-in and the Shop talk to the real backend. */
export const BACKEND_ENABLED = BACKEND_URL !== "";

/**
 * Where requests go. In `npm run dev` they go to this same origin and Vite forwards
 * /api to BACKEND_URL (see vite.config.ts), which avoids CORS. A production build
 * calls BACKEND_URL directly, so that server must allow the panel's origin.
 */
export const API_BASE_URL = import.meta.env.DEV ? "" : BACKEND_URL;

/** How long to wait for the backend before calling it unreachable. */
export const API_TIMEOUT_MS = 20_000;

export const ENDPOINTS = {
  login: "/api/admin/auth/login",
  shopCategories: "/api/v1/admin/shop/categories",
  shopProducts: "/api/v1/admin/shop/products",
  shopAssetUpload: "/api/v1/admin/shop/assets/upload",
  coinPacks: "/api/v1/admin/coin-packs",
  redPackets: "/api/v1/admin/red-packets",
  /** + /{userId}/credit, /{userId}/debit, /{userId}/transactions */
  adminWallets: "/api/v1/admin/wallets",
  /** + /{userId}, /grant, /extend, /points/credit, /points/debit */
  adminVipUsers: "/api/v1/admin/vip/users",
  /** GET list; POST /upload (multipart: file, vipLevel, type, format) */
  vipCosmetics: "/api/v1/admin/vip/cosmetics",
  /** Gifts: list, add, edit, files. Super Admin, Admin and Moderator. */
  manageGifts: "/api/v1/admin/manage/gifts",
  /** Spend rewards (random and guaranteed). Super Admin, Admin and Moderator. */
  manageRewards: "/api/v1/admin/manage/rewards",
  /** + /revenue, /payments, /coin-transactions, /audit. Super Admin only. */
  superAdmin: "/api/v1/admin/super",
  /** App users: list and counts. Admin and Super Admin. */
  adminUsers: "/api/v1/admin/users",
  /** + /coins, /red-packets, /history, /audience. Super Admin only. */
  giveAll: "/api/v1/admin/give-all",
} as const;

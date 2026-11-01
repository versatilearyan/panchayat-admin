/**
 * Starting catalog: the gifts, chat bubbles and rings that are built into the
 * Panchayat app today (lib/app/data.ts and lib/app/market.ts there), so the
 * panel opens with what users actually see. VIP and coin pack prices are
 * starting values for you to set on the Pricing page.
 */
import { SEED_STAFF } from "./roles";
import { startingPassword } from "./session";
import type { AppSettings, GiftCategory, GiftItem, Pricing, Product, RedPacketPrice, StaffAccount } from "./types";

const t0 = Date.UTC(2026, 9, 1);
const by = "Panchayat app";

const g = (sort: number, id: string, name: string, cost: number, categories: GiftCategory[], tier: GiftItem["tier"], extra: Partial<GiftItem> = {}): GiftItem => ({
  id, name, cost, categories, tier, sort, active: true, builtIn: true, updatedAt: t0, updatedBy: by, ...extra,
});

export const SEED_GIFTS: GiftItem[] = [
  g(1, "rose", "Rose", 10, ["Popular", "Romantic"], "ordinary"),
  g(2, "heart", "Heart Pop", 30, ["Popular", "Cute", "Romantic"], "ordinary"),
  g(3, "bear", "Love Bear", 99, ["Cute", "Romantic"], "ordinary"),
  g(4, "packet", "Lucky Red Packet", 188, ["Popular", "Celebration"], "ordinary"),
  g(5, "fireworks", "Fireworks", 520, ["Celebration", "Popular"], "ordinary"),
  g(6, "crown", "Golden Crown", 999, ["Royal", "Popular"], "ordinary"),
  g(7, "cupid-heart", "Cupid Heart", 1314, ["Popular", "Cute", "Romantic", "Legendary"], "legendary", { blurb: "Cupid's arrow, straight to the heart." }),
  g(8, "rocket", "Magic Rocket", 2999, ["Celebration", "Legendary"], "legendary"),
  g(9, "car", "Royal Car", 5200, ["Royal", "Legendary"], "legendary"),
  g(10, "dragon", "Dragon", 8888, ["Popular", "Royal", "Legendary"], "legendary", { blurb: "Saddle up: a fire-winged dragon carries you over the hills." }),
  g(11, "princess-flower", "Princess Flower", 9999, ["Popular", "Romantic", "Legendary"], "legendary", { blurb: "A garden of flowers, only for a princess." }),
  g(12, "royal-entry", "Panchayat Royal Entry", 13140, ["Royal", "Legendary"], "legendary"),
  g(13, "god-of-wealth", "God of Wealth", 18888, ["Popular", "Celebration", "Royal", "Legendary"], "legendary", { blurb: "The God of Wealth arrives with a bowl of gold. Fortune for everyone here!" }),
  g(14, "hamper", "Panchayat Hamper", 666, [], "ordinary", { packageOnly: true, blurb: "A basket of chai, mithai and good wishes from the Panchayat." }),
];

const p = (id: string, kind: Product["kind"], name: string, prices: Product["prices"], extra: Partial<Product> = {}): Product => ({
  id, kind, name, prices, active: true, builtIn: true, updatedAt: t0, updatedBy: by, ...extra,
});

export const SEED_PRODUCTS: Product[] = [
  p("marigold", "bubble", "Genda Phool", [{ days: 2, coins: 500 }, { days: 6, coins: 1_200 }], { colors: ["#ff9a1f", "#ff5a1f"] }),
  p("peacock", "bubble", "Mor Pankh", [{ days: 2, coins: 800 }, { days: 6, coins: 1_900 }], { colors: ["#0f6e8c", "#1fa37a"] }),
  p("chandni", "bubble", "Chandni Raat", [{ days: 2, coins: 1_200 }, { days: 6, coins: 2_800 }], { colors: ["#2a1d6b", "#5a2a8c"] }),
  p("phool-kali", "ring", "Phool Kali", [{ days: null, coins: 999 }], { rarity: "Common" }),
  p("moti-seep", "ring", "Moti Seep", [{ days: null, coins: 1_999 }], { rarity: "Common" }),
  p("laal-bel", "ring", "Laal Bel", [{ days: null, coins: 2_999 }], { rarity: "Rare" }),
  p("titli-rani", "ring", "Titli Rani", [{ days: null, coins: 3_999 }], { rarity: "Rare" }),
  p("gulabi-dil", "ring", "Gulabi Dil", [{ days: null, coins: 5_200 }], { rarity: "Epic" }),
  p("taara-boond", "ring", "Taara Boond", [{ days: null, coins: 7_777 }], { rarity: "Epic" }),
  p("samundar-lehar", "ring", "Samundar Lehar", [{ days: null, coins: 9_999 }], { rarity: "Epic" }),
  p("chand-titli", "ring", "Chand Titli", [{ days: null, coins: 13_140 }], { rarity: "Legendary" }),
];

/** VIP is a 30-day subscription in the app (VIP_DAYS). Starting prices, change them on the Pricing page. */
const VIP_COINS = [1_000, 5_000, 15_000, 40_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

export const seedPricing = (): Pricing => ({
  vip: VIP_COINS.map((coins, i) => ({ level: i + 1, coins, days: 30, active: true })),
  coinPacks: [
    { id: "pack-100", coins: 100, bonus: 0, priceInr: 10, active: true },
    { id: "pack-1000", coins: 1_000, bonus: 50, priceInr: 99, active: true },
    { id: "pack-5000", coins: 5_000, bonus: 400, priceInr: 449, tag: "Popular", active: true },
    { id: "pack-10000", coins: 10_000, bonus: 1_000, priceInr: 899, active: true },
    { id: "pack-50000", coins: 50_000, bonus: 7_500, priceInr: 4_299, tag: "Best value", active: true },
    { id: "pack-100000", coins: 100_000, bonus: 20_000, priceInr: 8_499, active: true },
  ],
  redPackets: seedRedPackets(),
  updatedAt: t0,
  updatedBy: by,
});

/** The app's three red packets, priced in rupees close to the matching coin packs. */
export const seedRedPackets = (): RedPacketPrice[] => [
  { id: "rp-10k", name: "Gold Red Packet", priceInr: 899, pot: 10_000, active: true },
  { id: "rp-50k", name: "Royal Red Packet", priceInr: 4_299, pot: 50_000, active: true },
  { id: "rp-80k", name: "Maharaja Red Packet", priceInr: 6_799, pot: 80_000, active: true },
];

export const seedSettings = (): AppSettings => ({
  maintenance: false,
  maintenanceMessage: "Panchayat is getting an upgrade. We'll be back in a few minutes.",
  announcement: "",
  signupBonusCoins: 500,
  dailyCheckinCoins: 50,
  giftingEnabled: true,
  roomCreationEnabled: true,
  roomCreateMinLevel: 0,
  minAppVersion: "1.0.0",
  updatedAt: t0,
  updatedBy: by,
});

export const seedStaff = (): StaffAccount[] => SEED_STAFF.map((s) => ({ ...s, password: startingPassword(s.username) }));

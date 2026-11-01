/**
 * Demo data: the same fictional people and rooms as the Panchayat app
 * (lib/app/data.ts there), so the two line up. Replaced by the real API.
 */
import { SEED_GIFTS, SEED_PRODUCTS, seedPricing, seedSettings, seedStaff } from "./catalog-seed";
import type { AdminDb } from "./types";

export type SeedUser = {
  id: string;
  uid: string;
  name: string;
  handle: string;
  level: number;
  vip: number;
  city: string;
  online: boolean;
  followers: number;
  bio: string;
  color: string;
  coins: number;
  official?: boolean;
};

export type SeedRoom = { id: string; code: string; name: string; hostId: string; members: number; live: boolean; seated: string[] };

/** Stable made-up wallet so balances look real. */
function coinsFor(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 9000) * 10 + 500;
}

const u = (id: string, uid: string, name: string, color: string, level: number, vip: number, followers: number, city: string, bio: string, online = true): SeedUser => ({
  id, uid, name, handle: `@${id}`, level, vip, city, online, followers, bio, color, coins: coinsFor(id),
});

export const SEED_USERS: SeedUser[] = [
  { ...u("sarpanch", "100000", "Sarpanch", "#7a2f45", 99, 0, 0, "", "The official Panchayat account. News, events and help from the Panchayat team."), coins: 0, official: true },
  { ...u("aryan", "759072", "Aryan", "#3a2f55", 0, 0, 0, "", "Here for Ludo, late-night chai and good music."), coins: 43_900 },
  u("riya", "208114", "Riya", "#7a2f45", 48, 4, 48200, "Jaipur", "Host of Sunday chai adda. Ludo shark, ghazal lover."),
  u("kabir", "311520", "Kabir", "#2f4a63", 36, 0, 22100, "Pune", "Cricket stats nerd. Carrom on weekends."),
  u("meher", "402773", "Meher", "#7a5a2a", 41, 2, 31800, "Lucknow", "Shayari at midnight, Antakshari at dawn."),
  u("arjun", "518806", "Arjun", "#4a3a6e", 22, 0, 5400, "Bengaluru", "Chess 1800. Will explain the Sicilian to anyone."),
  u("zoya", "627415", "Zoya", "#6e2f3f", 29, 0, 12900, "Hyderabad", "Bollywood quizmaster. Ask me anything from 1975."),
  u("dev", "100777", "Dev", "#2f5a49", 53, 5, 67300, "Mumbai", "Running the late-night movie club."),
  u("tara", "733092", "Tara", "#6a3a5a", 18, 0, 3100, "Kochi", "Lo-fi playlists and long study rooms."),
  u("ishaan", "845261", "Ishaan", "#3d4470", 33, 0, 9800, "Delhi", "Pool, puns and the occasional open mic."),
  u("naina", "956130", "Naina", "#5a2f63", 27, 0, 8700, "Indore", "Bhajan mornings, karaoke nights.", false),
  u("vikram", "167048", "Vikram", "#634a2f", 39, 3, 18400, "Chandigarh", "Kabaddi commentator in another life."),
  u("anaya", "278359", "Anaya", "#2f5563", 24, 0, 6200, "Goa", "Sunsets, ukulele, and Draw & Guess."),
  u("rohan", "389460", "Rohan", "#3a2f63", 15, 0, 2200, "Kolkata", "Adda is a way of life.", false),
  u("saanvi", "490571", "Saanvi", "#63302f", 31, 1, 11200, "Ahmedabad", "Garba season all year."),
  u("aditya", "501682", "Aditya", "#2f6352", 20, 0, 4100, "Nagpur", "UPSC aspirant, chess for breaks."),
];

export const SEED_ROOMS: SeedRoom[] = [
  { id: "r-chai", code: "208114", name: "Sunday chai adda", hostId: "riya", members: 128, live: true, seated: ["riya", "kabir", "meher", "arjun", "tara"] },
  { id: "r-antakshari", code: "311907", name: "Late night Antakshari", hostId: "meher", members: 342, live: true, seated: ["meher", "saanvi", "anaya", "rohan"] },
  { id: "r-royal", code: "100001", name: "The Royal Darbar", hostId: "dev", members: 86, live: true, seated: ["dev", "riya", "vikram", "meher"] },
  { id: "r-movie", code: "450220", name: "Movie night: dusk club", hostId: "dev", members: 214, live: true, seated: ["dev", "zoya", "ishaan"] },
  { id: "r-cricket", code: "520118", name: "Cricket highlights watch-along", hostId: "kabir", members: 97, live: true, seated: ["kabir", "vikram"] },
  { id: "r-quiz", code: "612480", name: "Bollywood quiz hour", hostId: "zoya", members: 176, live: true, seated: ["zoya", "ishaan", "naina", "aditya", "anaya", "kabir"] },
  { id: "r-study", code: "733051", name: "Silent study café", hostId: "tara", members: 64, live: true, seated: ["tara", "aditya", "arjun"] },
  { id: "r-garba", code: "804411", name: "Garba practice circle", hostId: "saanvi", members: 58, live: true, seated: ["saanvi", "naina"] },
  { id: "r-carrom", code: "915002", name: "Carrom champions", hostId: "kabir", members: 41, live: false, seated: ["kabir", "rohan"] },
  { id: "r-shayari", code: "102233", name: "Mehfil-e-shayari", hostId: "meher", members: 120, live: true, seated: ["meher", "rohan", "riya"] },
  { id: "r-standup", code: "117760", name: "Open mic: desi stand-up", hostId: "ishaan", members: 233, live: true, seated: ["ishaan", "vikram", "zoya"] },
  { id: "r-lofi", code: "121905", name: "Lo-fi & rain sounds", hostId: "tara", members: 89, live: true, seated: ["tara", "anaya"] },
  { id: "r-kharidari", code: "777001", name: "Kharidari Bazaar", hostId: "vikram", members: 311, live: true, seated: ["vikram", "zoya", "kabir", "naina", "rohan"] },
  { id: "r-vipmovie", code: "100777", name: "Velvet screening room", hostId: "riya", members: 44, live: true, seated: ["riya", "dev"] },
];

const hoursAgo = (h: number) => Date.now() - h * 3_600_000;

/** A fresh demo store, with a few sample reports so the queue isn't empty. */
export function seedDb(): AdminDb {
  return {
    version: 1,
    sanctions: [],
    coinTxs: [],
    audit: [],
    notes: {},
    grants: [],
    rooms: [],
    deletedRooms: [],
    gifts: SEED_GIFTS,
    products: SEED_PRODUCTS,
    pricing: seedPricing(),
    settings: seedSettings(),
    staff: seedStaff(),
    profileEdits: {},
    sarpanch: {
      name: "Sarpanch",
      handle: "@sarpanch",
      bio: "The official Panchayat account. News, events and help from the Panchayat team.",
      updatedAt: Date.UTC(2026, 9, 1),
      updatedBy: "Panchayat app",
    },
    sarpanchMessages: [],
    reports: [
      { id: "rep-seed-1", reporterId: "tara", userId: "ishaan", reason: "Spam in room chat", note: "Kept posting the same link in Silent study café.", createdAt: hoursAgo(2), status: "open" },
      { id: "rep-seed-2", reporterId: "naina", userId: "rohan", reason: "Abusive language", note: "Insulted people on mic in Late night Antakshari.", createdAt: hoursAgo(5), status: "open" },
      { id: "rep-seed-3", reporterId: "kabir", userId: "rohan", reason: "Harassment", createdAt: hoursAgo(26), status: "open" },
    ],
  };
}

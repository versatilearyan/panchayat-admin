/**
 * Types for the Panchayat admin panel.
 *
 * These are the shapes the backend's /admin endpoints should return. They
 * mirror the tables in backend-flow.md: `users`, `sanctions`, `coin_ledger`,
 * `reports` and `admin_audit`. In demo mode they're kept in localStorage
 * (src/api/local.ts).
 */

/** What a moderator can do to a user. */
export type SanctionKind = "ban" | "mute" | "warn" | "kick";

export type Sanction = {
  id: string;
  userId: string;
  kind: SanctionKind;
  reason: string;
  /** Message shown to the user (warnings, bans). */
  message?: string;
  createdAt: number;
  /** null = permanent. Warnings never expire. */
  expiresAt: number | null;
  /** Kicks are per room. */
  roomId?: string;
  /** Admin name that applied it. */
  by: string;
  liftedAt?: number;
  liftedBy?: string;
  /** When the user saw a warning in the app. */
  acknowledgedAt?: number;
};

/** One row of the coin ledger. Negative amounts remove coins. */
export type CoinTx = {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  createdAt: number;
  by: string;
};

export type ReportStatus = "open" | "resolved" | "dismissed";

/** A user reporting another user from their profile. */
export type Report = {
  id: string;
  reporterId: string;
  userId: string;
  reason: string;
  note?: string;
  createdAt: number;
  status: ReportStatus;
  handledBy?: string;
  handledAt?: number;
};

export type AuditAction =
  | "coins"
  | "ban"
  | "unban"
  | "mute"
  | "unmute"
  | "warn"
  | "kick"
  | "unkick"
  | "report"
  | "note"
  | "vip"
  | "item"
  | "room"
  | "gift"
  | "product"
  | "pricing"
  | "staff"
  | "settings"
  | "profile"
  | "sarpanch";

export type AuditEntry = {
  id: string;
  at: number;
  by: string;
  action: AuditAction;
  userId?: string;
  detail: string;
};

/* ---------------- Catalog: gifts, products and prices ---------------- */

/**
 * A file uploaded through the panel (an SVGA animation or an image).
 * Demo mode keeps the file in this browser's IndexedDB and the ref is "idb:<id>".
 * With the backend it's the file's URL on the CDN.
 */
export type FileRef = string;

export const GIFT_CATEGORIES = ["Popular", "Cute", "Romantic", "Celebration", "Royal", "Legendary"] as const;
export type GiftCategory = (typeof GIFT_CATEGORIES)[number];

/** A gift people send in rooms. Same fields as `Gift` in the app's lib/app/types.ts, plus the uploaded files. */
export type GiftItem = {
  id: string;
  name: string;
  /** Price in coins. */
  cost: number;
  categories: GiftCategory[];
  tier: "ordinary" | "legendary";
  blurb?: string;
  /** Full-screen SVGA animation played when it's sent. */
  svga?: FileRef;
  /** Small picture shown in the gift panel. */
  icon?: FileRef;
  /** Only given in packages (rewards in the Bag), never sold. */
  packageOnly?: boolean;
  /** Shown in the gift panel with a "Coming soon" tag and can't be sent yet. */
  comingSoon?: boolean;
  /** Hidden gifts stay in history but leave the gift panel. */
  active: boolean;
  /** Lower comes first in the gift panel. */
  sort: number;
  /** Built into the app (lib/app/data.ts). Prices can change, the gift can't be deleted. */
  builtIn?: boolean;
  updatedAt: number;
  updatedBy: string;
};

export type GiftInput = Omit<GiftItem, "id" | "updatedAt" | "updatedBy" | "builtIn"> & { id?: string };

export const PRODUCT_KINDS = ["bubble", "ring", "frame", "entry", "badge", "theme"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

/** One way to buy a product: rent for some days, or keep it (days = null). */
export type ProductPrice = { days: number | null; coins: number };

/** Something sold in the app's Shop: chat bubbles, rings, frames, entry effects, badges, room themes. */
export type Product = {
  id: string;
  kind: ProductKind;
  name: string;
  rarity?: "Common" | "Rare" | "Epic" | "Legendary";
  prices: ProductPrice[];
  svga?: FileRef;
  image?: FileRef;
  /** Bubbles: colours of the chat line, as two hex colours. */
  colors?: [string, string];
  /** Only VIPs at this level or above can buy it. */
  minVip?: number;
  active: boolean;
  builtIn?: boolean;
  updatedAt: number;
  updatedBy: string;
};

export type ProductInput = Omit<Product, "id" | "updatedAt" | "updatedBy" | "builtIn"> & { id?: string };

/** What a VIP level costs. Each purchase lasts `days`. */
export type VipPlan = { level: number; coins: number; days: number; active: boolean };

/** A coin pack sold for real money. */
export type CoinPack = { id: string; coins: number; bonus: number; priceInr: number; tag?: string; active: boolean };

/**
 * A red packet tier as the app sells it (lib/app/redpacket.ts). People buy one, drop it
 * in a room, and everyone there grabs a share of the coins inside.
 */
export type RedPacketPrice = {
  id: "rp-10k" | "rp-50k" | "rp-80k";
  name: string;
  /** What it costs to buy, in rupees. */
  priceInr: number;
  /** Coins inside that people in the room grab. */
  pot: number;
  active: boolean;
};

export type Pricing = {
  vip: VipPlan[];
  coinPacks: CoinPack[];
  redPackets: RedPacketPrice[];
  updatedAt: number;
  updatedBy: string;
};

/** App-wide switches only super admins can change. */
export type AppSettings = {
  maintenance: boolean;
  maintenanceMessage: string;
  /** Banner shown at the top of the app's home screen. Empty = none. */
  announcement: string;
  signupBonusCoins: number;
  dailyCheckinCoins: number;
  giftingEnabled: boolean;
  roomCreationEnabled: boolean;
  /** Users below this level can't create rooms. */
  roomCreateMinLevel: number;
  minAppVersion: string;
  updatedAt: number;
  updatedBy: string;
};

/** VIP or a product given to a user by staff. */
export type Grant = {
  id: string;
  userId: string;
  kind: "vip" | "item";
  vipLevel?: number;
  productId?: string;
  /** Snapshot of the product name, in case it's renamed later. */
  label: string;
  reason: string;
  createdAt: number;
  /** null = never ends. */
  expiresAt: number | null;
  by: string;
  revokedAt?: number;
  revokedBy?: string;
};

export type RoomInput = {
  name: string;
  hostId: string;
  topic?: string;
  category: string;
  seats: number;
  isPrivate: boolean;
  password?: string;
  vipOnly: boolean;
  announcement?: string;
};

/** Everything the local demo store keeps. One JSON object in localStorage (uploaded files go to IndexedDB). */
export type AdminDb = {
  version: 1;
  sanctions: Sanction[];
  coinTxs: CoinTx[];
  reports: Report[];
  audit: AuditEntry[];
  /** Private moderator notes per user. */
  notes: Record<string, string>;
  grants: Grant[];
  /** Rooms created from the panel, and changes to sample rooms. */
  rooms: StoredRoom[];
  deletedRooms: string[];
  gifts: GiftItem[];
  products: Product[];
  pricing: Pricing;
  settings: AppSettings;
  staff: StaffAccount[];
  /** Name and @username changes made from the panel, per user id. */
  profileEdits: Record<string, { name?: string; handle?: string }>;
  sarpanch: SarpanchProfile;
  sarpanchMessages: SarpanchMessage[];
};

/** A staff account as stored in demo mode. */
export type StaffAccount = import("./roles").StaffMember & { password: string };

export type UserStatus = "active" | "banned" | "muted";

/** A user as the admin panel sees it (GET /admin/users). */
export type AdminUser = {
  id: string;
  /** Public numeric user ID. */
  uid: string;
  name: string;
  handle: string;
  level: number;
  vip: number;
  city: string;
  online: boolean;
  followers: number;
  coins: number;
  /** Avatar colour (demo data). Real users will have a photo URL. */
  color: string;
  photoUrl?: string;
  /** The official Sarpanch account. Can't be banned, muted or kicked. */
  official?: boolean;
  /** Active VIP given by staff, if higher than what they earned. */
  vipGrant?: Grant | null;
  ban: Sanction | null;
  mute: Sanction | null;
  /** Active room kicks. */
  kicks: Sanction[];
  warnings: number;
  openReports: number;
  status: UserStatus;
};

/** Full record for the user drawer (GET /admin/users/:id). */
export type AdminUserDetail = AdminUser & {
  bio: string;
  sanctions: Sanction[];
  coinTxs: CoinTx[];
  reports: Report[];
  note: string;
  grants: Grant[];
};

export type AdminRoom = {
  id: string;
  code: string;
  name: string;
  hostId: string;
  members: number;
  live: boolean;
  seated: string[];
  /** Users currently kicked from this room. */
  kicked: Sanction[];
  topic?: string;
  category?: string;
  seats?: number;
  isPrivate?: boolean;
  password?: string;
  vipOnly?: boolean;
  announcement?: string;
  /** Set on rooms made from the admin panel. */
  createdBy?: string;
  createdAt?: number;
};

export type AdminStats = {
  users: number;
  online: number;
  banned: number;
  muted: number;
  openReports: number;
  /** Coins added by admins in the last 7 days. */
  coinsGranted7d: number;
  actionsToday: number;
};

export type UserFilter = "all" | "active" | "banned" | "muted" | "warned" | "reported";

/** Time-limited actions take a duration in ms, or null for permanent. */
export type Duration = number | null;

/** A room as saved in the demo store: kicks are worked out from sanctions. */
export type StoredRoom = Omit<AdminRoom, "kicked">;

/* ---------------- Sarpanch: the official account in the app ---------------- */

/** How the Sarpanch account looks in the app. Its user id is always "sarpanch". */
export type SarpanchProfile = {
  name: string;
  handle: string;
  bio: string;
  photo?: FileRef;
  updatedAt: number;
  updatedBy: string;
};

/** A message sent as Sarpanch: to everyone (an announcement) or to one user's inbox. */
export type SarpanchMessage = {
  id: string;
  /** null = everyone. */
  toUserId: string | null;
  title: string;
  body: string;
  sentAt: number;
  /** Staff member who wrote it. Users only see "Sarpanch". */
  by: string;
};

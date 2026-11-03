# Panchayat Admin

The admin panel for Panchayat, built separately from the user app. Staff use it to run the whole app: moderate users, add or remove coins, give VIP and Shop items, create and manage rooms, add gifts with SVGA animations, add Shop items, set prices for VIP, coin packs, rings and chat bubbles, manage staff accounts and switch app-wide settings. Every action is saved in the activity log.

It's its own app (React + Vite + TypeScript + Tailwind) with its own sign-in, so you can host it on a private address (for example `admin.panchayat.app`) and keep it out of the public app's code.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:3100
npm run build      # static files in dist/
npm run preview    # serve the build on :3100
```

It uses port 3100, so it can run next to the Panchayat app on 3000.

**Demo sign-in:** your staff username and your own password. Each person's starting password is in `.env.local` (`VITE_PASS_ARYAN`, `VITE_PASS_NIKHIL`…, see `.env.example`). Keep that file private. Super admins can change anyone's password on the Staff page.

## Connecting the Spring Boot backend

Add your backend URL to `.env.local` and restart `npm run dev`:

```
VITE_API_BASE_URL=https://your-tunnel.ngrok-free.app
```

With it set:

- Sign-in uses `POST /api/admin/auth/login`. The JWT and the staff member's id, username and role (SUPER_ADMIN, ADMIN, MODERATOR) are kept in this tab's session storage and sent as `Authorization: Bearer …` on every other request.
- **Shop items** shows categories and products from `/api/v1/admin/shop/categories` and `/api/v1/admin/shop/products`: list, filter by category, add, edit, and turn on or off.
- **Coin packs** (`/api/v1/admin/coin-packs`) and **Red packets** (`/api/v1/admin/red-packets`) are live, for Super Admins only: list every item (inactive too), add, edit (PATCH sends only what changed), and activate or deactivate (`PATCH …/{id}/status?active=true|false`, with a confirmation before deactivating). A coin pack's image is uploaded separately with `POST /api/v1/admin/coin-packs/{id}/image` (multipart, field `file`; JPEG, PNG or WebP up to 5 MB). Red packet images use `POST /api/v1/admin/red-packets/{id}/image` the same way; if the server doesn't have that endpoint yet, the panel says so. The request fields are in `src/services/coinPackService.ts` and `src/services/redPacketService.ts`. Without the backend these two pages ask you to connect it; they have no demo data, and the Pricing page's demo coin pack and red packet tables are hidden when the backend is on.
- **Wallets** (`/api/v1/admin/wallets/{userId}/…`) is live for Admins and Super Admins: open a wallet by user ID, credit (`POST …/credit`) or debit (`POST …/debit`) coins after a confirmation, and page through the history (`GET …/transactions?page=&size=20`). Each credit or debit sends one idempotency key per request; if the reply is lost or the server fails part way, the form locks and offers a retry with the same key, so it can't be applied twice. The current balance isn't shown because the backend has no admin balance endpoint; the panel never uses the user-facing `/api/v1/wallet/balance`. The fields are in `src/services/adminWalletService.ts`.
- **VIP** (`/api/v1/admin/vip/users/{userId}`) is live for Super Admins only: view a user's VIP status and VIP points (`GET`), grant (`POST …/grant`) or extend (`PATCH …/extend`) by `durationDays`, revoke (`DELETE`), and credit or debit VIP points (`POST …/points/credit|debit` with `amount`). Each change asks for confirmation and then reloads the status from the server; expiry dates and balances are never worked out in the panel. The fields are in `src/services/adminVipService.ts`.
- **VIP Management → Cosmetics** (`/api/v1/admin/vip/cosmetics`) is live for Super Admins: it lists every uploaded VIP frame, bubble, entry animation and badge (with filters, search, sorting and a VIP 1–7 completeness overview) and uploads new ones with `POST …/upload` (multipart: `file`, `vipLevel` 1–7, `type` FRAME|BUBBLE|ENTRY|BADGE, `format` SVGA|PNG; only a badge may be PNG; up to 15 MB). The backend keeps one asset per level, type and format and has no replace endpoint yet. The fields are in `src/services/vipCosmeticService.ts`.
- **Gifts** (`/api/v1/admin/manage/gifts`) is live for every staff role: add a gift (name, price in coins, category, order), then upload its picture (PNG/JPG/JPEG, 5 MB), animation (SVGA 15 MB or MP4 40 MB; SVGA is test-played first) and sound (MP3, 10 MB). A gift goes on sale once it has a picture. Prices are read by the server when a gift is sent, so a new price applies at once. Only Super Admins can delete a gift. The app reads the gifts on sale from the public `GET /api/v1/gifts`.
- **Spend rewards** (`/api/v1/admin/manage/rewards`, under Coin packs) is live for every staff role. *Random*: every N coins a user spends, they win one item; priority 1–4 sets the odds (weights 4/3/2/1, the panel shows each item's %). *Guaranteed*: after N coins they get every item, once or every N coins. Items are a gift (into the bag), chat bubble, entry effect, profile effect or any new type you add, each with a file (PNG/JPG/JPEG/SVGA/MP4/MP3), an optional MP3, quantity, validity and a **Can drop** switch. The Winners tab lists who won what. The server gives the rewards when coins are spent (sending gifts today) and pushes them to the user on `/user/queue/rewards`; the app reads them from `GET /api/v1/rewards/me`.
- **Revenue, Payments, Coin logs and Audit log** (`/api/v1/admin/super/…`) are for Super Admins only: revenue today / 7 days / 30 days / this month / all time with a per-day chart, by product and top payers; every payment with filters; every coin movement; and every change staff made through the admin API (who, role, what, result, IP).
- The Wallets and VIP pages take the target user's **numeric** ID (checked in `src/lib/userId.ts` before any request). Never type an admin username such as `superadmin` there: the backend's `{userId}` is a number.
- Every other page still runs on demo data in this browser until its API exists.
- If the backend says 401 the panel signs out and asks you to sign in again. A 403 shows "You don't have access to this." without signing out.

While `npm run dev` runs, the panel sends `/api/…` to itself and Vite forwards it to that URL (`vite.config.ts`), so the backend needs no CORS setup for localhost. A production build calls the URL directly, so that server must allow the panel's domain. The URL is read in `src/config/api.ts` (and by the dev proxy). All requests go through `src/lib/api.ts`. ngrok URLs change when the tunnel restarts, so update `.env.local` when that happens. The backend decides what each role may do; the panel only hides what a role can't use.

## Staff and roles

| Username | Name | Role |
| --- | --- | --- |
| `aryan` | Aryan | Super Admin |
| `bharat` | Bharat | Super Admin |
| `nikhil` | Nikhil | Admin |
| `shivam` | Shivam | Moderator 1 |
| `vansh` | Vansh | Moderator 2 |

- **Moderator:** warn, mute and kick users, handle reports, see rooms and the activity log.
- **Admin:** everything a moderator does, plus ban and unban, add or remove coins (up to 1,00,000 at a time), give VIP, give chat bubbles, rings and other items, create and edit rooms, add and edit gifts and Shop items, and see prices.
- **Super Admin:** everything. Also change prices (VIP, coin packs, rings, bubbles, gifts), delete gifts, Shop items and rooms, manage staff accounts, app settings and maintenance mode, and coin changes up to 1,00,00,000.

The full table is on the Staff page and in `src/api/roles.ts`. The panel hides what a role can't use, and the API checks the same table on every call.

## What it does

| Screen | What you can do |
| --- | --- |
| Overview | Count of users, online users, open reports, banned and muted users, coins added in the last 7 days and actions taken today. Lists open reports, who is banned or muted, and recent activity |
| Users | Search by name, @handle or user ID. Filter by Active, Banned, Muted, Warned or Reported. Click a user to open their panel |
| User panel | Profile and stats, then **Add coins / Remove coins / Warn / Mute / Kick / Ban**, plus **Unmute** and **Unban**. "In force now" lists active bans, mutes and kicks, each with **Lift**. Tabs show moderation history, coin history, reports and a private note only admins can see |
| Rooms | See who's on mic in each room. Kick someone from one room, and see who's kicked with a **Let back in** button |
| Reports | Open, Resolved and Dismissed reports. Review the user, then resolve, dismiss or reopen the report |
| Activity log | Every staff action, with who did it and when. Search it and filter by moderation, coins, reports, VIP & items, gifts/shop/rooms or staff & settings |
| Rooms (new) | **Create room** for any owner (name, category, seats, private with password, VIP only, pinned announcement). Edit, close/reopen or delete any room |
| User panel (new) | **Give VIP** (level 1 to 10, for 7/30/90/365 days or forever) and **Give item** (chat bubble, ring, frame, entry effect, badge or room theme). The "VIP & items" tab lists them with **Take back** |
| Gifts | Add a gift with an **.svga** animation and an icon. The SVGA is test-played before it's accepted, so you see it before saving. Set price, tabs, legendary or ordinary, order, hide or show |
| Shop items | Chat bubbles, rings, frames, entry effects, badges and room themes. Each has one or more prices (rent for N days, or keep forever), an SVGA and/or picture, rarity and a minimum VIP level |
| Pricing | VIP prices per level, coin packs (coins, bonus, ₹ price, label), and ring and chat bubble prices, in one place |
| Staff | Add staff, change roles and titles, reset passwords, disable accounts |
| Sarpanch (super admins) | The official **Sarpanch** account in the app (user ID 100000, gold official tick). Edit its photo, name, username and bio, and send messages as Sarpanch to everyone or to one user. It can't be banned, muted or kicked, and normal users can't use names with "sarpanch", "panchayat", "admin" or "official" |
| Change name (super admins) | Pencil next to a user's name in their panel: change their name and @username (must be unique; the numeric ID never changes) |
| Coming soon | Any gift can be marked **Coming soon** (shown with a tag, can't be sent yet), one by one or all at once from the Gifts page |
| App settings | Maintenance mode, home screen announcement, sign-up bonus, daily check-in reward, gifting on/off, who can create rooms, oldest app version allowed |

The gifts, chat bubbles and rings start as the ones built into the Panchayat app. Built-in items can be hidden but not deleted. VIP and coin pack prices start at placeholder values: set your real prices on the Pricing page.

Uploaded SVGA files and images are kept in the browser's IndexedDB in demo mode (SVGA up to 15 MB, images up to 2 MB). With the backend they go to `POST /admin/uploads` and should be stored on a CDN.

Safety rules built in:
- Every action needs a reason, which is saved in the activity log.
- A permanent ban only goes through after you type the user's ID.
- You can't remove more coins than a user has. One change is capped at 10,000,000 coins, which catches typos like an extra zero.
- A room owner can't be kicked from their own room. Ban or mute them instead.
- A new ban or mute replaces the user's current one.

Durations: mutes last 15 min, 1 h, 24 h, 7 days or forever. Kicks last 1 h, 24 h, 7 days or forever. Bans last 24 h, 7 days, 30 days or forever.

## How it shares data with the Panchayat app

**Right now (demo):** the two apps don't share anything. Both are frontend only and keep their data in the browser's localStorage. The admin panel runs on a different address, so it can't read the user app's storage. It shows the same sample people and rooms as the user app (`src/api/seed.ts`), and saves your actions in its own browser storage (`panchayat-admin-demo-v1`). Click **Reset** in the sidebar to start over.

**With the backend:** both apps talk to the same server, and the server is the only place data is kept:

```
Panchayat app ──►┐
                 ├──► API server ──► Postgres (users, coin_ledger, sanctions, reports, admin_audit)
Admin panel  ───►┘        │
                          └──► Realtime (Socket.IO): pushes bans, mutes and kicks to the user's app
```

1. An admin clicks **Ban** in this panel, which calls `POST /admin/users/:id/ban`.
2. The server checks the admin's role, saves a `sanctions` row and an `admin_audit` row, then:
   - **Ban:** closes the user's sockets. Their next request gets `403 { banned, reason, until }`, and the app shows a "suspended" screen.
   - **Mute:** sends `admin:mute` to the user. Until it ends, the server rejects their chat messages and they can't take a seat with the mic on.
   - **Kick:** sends `admin:kick` to the room, removes them from it, and refuses `POST /rooms/:id/join` until the kick ends.
   - **Warning:** saved for the user. The app shows it the next time it loads, then calls the server to mark it seen.
   - **Coins:** one database transaction adds a `coin_ledger` row and updates the user's balance, then sends `wallet:update` so the app shows the new balance.
3. When the app's Report button is added, it calls `POST /reports`, and the report shows up in this panel's Reports queue.

This matches section 9, step 7 of `backend-flow.md` (moderation, reports, bans and an admin panel).

### Switching to the real API

Every screen talks to `adminApi` in `src/api/index.ts`, and never to localStorage directly. There are two versions of it:

- `src/api/local.ts`: the demo, used now.
- `src/api/http.ts`: the real backend. It's used as soon as you set `VITE_ADMIN_API_URL`:

```bash
VITE_ADMIN_API_URL=https://api.panchayat.app npm run build
```

The screens need no changes. `src/api/http.ts` lists every endpoint the backend needs to provide, with request and response shapes. The shapes are the types in `src/api/types.ts`. `src/api/local.ts` is a working reference for the rules the server should apply: the reason check, the coin limits, the owner can't be kicked, and a new ban replaces the old one.

## Security before going live

- The demo passcode is **not** security, because it ships inside the JavaScript bundle. In production, sign in with real admin accounts: `POST /admin/login` returns a token, and the server must check the admin role on **every** `/admin/*` request. Never rely on the panel hiding buttons.
- Host the panel on its own address, ideally behind a VPN, Cloudflare Access or an IP allowlist. Turn on 2FA for admin accounts.
- Keep `admin_audit` append-only: no update or delete endpoints.
- The server must check the role table in `src/api/roles.ts` on every `/admin/*` request.
- `index.html` already tells search engines not to index the panel (`noindex`).

## Code

```
src/
  api/
    index.ts      AdminApi interface; picks the local or http version
    local.ts      demo version (localStorage) and the rules
    http.ts       real backend version, plus the list of endpoints
    types.ts      AdminUser, Sanction, CoinTx, Report, AuditEntry…
    seed.ts       sample users and rooms (same as the Panchayat app)
    session.ts    sign-in session
  components/
    ui.tsx        buttons, badges, avatar, modal, chips, formatting
    UserDrawer    user side panel
    ActionDialog  coins / warn / mute / kick / ban form
  pages/          Login, Overview, Users, Rooms, Reports, Activity
  context.tsx     current page, open user, refresh, toasts
```
# panchayat-admin

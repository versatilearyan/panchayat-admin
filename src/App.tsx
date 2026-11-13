import { useCallback, useEffect, useState, type ComponentType } from "react";
import { Activity, BarChart3, Coins, CreditCard, Dice5, FileClock, ScrollText, Flag, Gift, IndianRupee, Mail, Landmark, LayoutDashboard, Lock, LogOut, MessagesSquare, Settings, ShoppingBag, UserCog, Users, Wallet, Crown, Gem, UsersRound, Sparkles, Eye, ListChecks, Tag } from "lucide-react";
import { adminApi } from "./api";
import { getSession, setSession, type AdminSession } from "./api/session";
import { BACKEND_ENABLED } from "./config/api";
import { MESSAGES, setUnauthorizedHandler } from "./lib/api";
import { AdminProvider, PAGE_PERMISSION, useAdmin, type Page } from "./context";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { UsersPage } from "./pages/Users";
import { RoomsLivePage as RoomsPage } from "./pages/RoomsLive";
import { NewbieRoomsPage } from "./pages/NewbieRooms";
import { ProfileTitlesPage } from "./pages/ProfileTitles";
import { ReportsPage } from "./pages/Reports";
import { ActivityPage } from "./pages/Activity";
import { GiftsPage } from "./pages/Gifts";
import { GiftsLivePage } from "./pages/GiftsLive";
import { UsersLivePage } from "./pages/UsersLive";
import { SpendRewardsPage } from "./pages/SpendRewards";
import { AuditLogPage, CoinLogsPage, PaymentsPage, RevenuePage } from "./pages/Finance";
import { ShopPage } from "./pages/Shop";
import { PricingPage } from "./pages/Pricing";
import { VisitorPlansPage } from "./pages/VisitorPlans";
import { DailyTasksPage } from "./pages/DailyTasks";
import { CoinPacksPage } from "./pages/CoinPacks";
import { RedPacketsPage } from "./pages/RedPackets";
import { WalletPage } from "./pages/Wallet";
import { VipPage } from "./pages/Vip";
import { VipCosmeticsPage } from "./pages/VipCosmetics";
import { VipPlansPage } from "./pages/VipPlans";
import { CpRingsPage } from "./pages/CpRings";
import { ParivarPage } from "./pages/Parivar";
import { StaffPage } from "./pages/Staff";
import { SettingsPage } from "./pages/Settings";
import { SarpanchPage } from "./pages/Sarpanch";
import { UserDrawer } from "./components/UserDrawer";
import { Avatar, Card, Empty } from "./components/ui";

export function App() {
  const [session, setSessionState] = useState<AdminSession | null>(getSession);
  const [notice, setNotice] = useState<string | null>(null);
  const signIn = useCallback(
    (s: AdminSession) => {
      // A fresh sign-in opens the dashboard. After an expired session, go back to the page they were on
      if (!notice) window.history.replaceState(null, "", "#/overview");
      setSession(s);
      setNotice(null);
      setSessionState(s);
    },
    [notice],
  );
  const signOut = useCallback(() => {
    // The next person starts on the Overview, not on the page the last one left open
    window.history.replaceState(null, "", "#/overview");
    setSession(null);
    setSessionState(null);
  }, []);
  // The backend rejected the token (expired or revoked): back to sign-in, keeping the page they were on
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setNotice(MESSAGES.expired);
      setSessionState(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);
  if (!session) return <Login onSignIn={signIn} notice={notice} />;
  return (
    <AdminProvider session={session} signOut={signOut}>
      <Shell />
    </AdminProvider>
  );
}

/** `child` items sit indented under the item above them (a section with sub-pages). */
const NAV: { page: Page; label: string; icon: typeof Users; child?: boolean }[] = [
  { page: "overview", label: "Overview", icon: LayoutDashboard },
  { page: "users", label: "Users", icon: Users },
  { page: "rooms", label: "Rooms", icon: MessagesSquare },
  { page: "reports", label: "Reports", icon: Flag },
  { page: "gifts", label: "Gifts", icon: Gift },
  { page: "shop", label: "Shop items", icon: ShoppingBag },
  { page: "cpRings", label: "CP ring charm", icon: Gem, child: true },
  { page: "coinPacks", label: "Coin packs", icon: Coins },
  { page: "rewards", label: "Spend rewards", icon: Dice5, child: true },
  { page: "redPackets", label: "Red packets", icon: Mail },
  { page: "wallets", label: "Wallets", icon: Wallet },
  { page: "vip", label: "VIP Management", icon: Crown },
  { page: "vipPlans", label: "VIP plans & gifts", icon: Crown, child: true },
  { page: "vipCosmetics", label: "Cosmetics", icon: Sparkles, child: true },
  { page: "revenue", label: "Revenue", icon: BarChart3 },
  { page: "payments", label: "Payments", icon: CreditCard, child: true },
  { page: "coinLogs", label: "Coin logs", icon: ScrollText, child: true },
  { page: "audit", label: "Audit log", icon: FileClock, child: true },
  { page: "pricing", label: "Pricing", icon: IndianRupee },
  { page: "visitorPlans", label: "Visitor log", icon: Eye, child: true },
  { page: "dailyTasks", label: "Daily tasks", icon: ListChecks },
  { page: "sarpanch", label: "Sarpanch", icon: Landmark },
  { page: "parivar", label: "Parivar", icon: UsersRound },
  { page: "titles", label: "Profile titles", icon: Tag },
  { page: "newbie", label: "Newbie rooms", icon: Sparkles },
  { page: "activity", label: "Activity log", icon: Activity },
  { page: "staff", label: "Staff", icon: UserCog },
  { page: "settings", label: "App settings", icon: Settings },
];

const PAGE_VIEW: Record<Page, ComponentType> = {
  overview: Overview,
  users: BACKEND_ENABLED ? UsersLivePage : UsersPage,
  rooms: RoomsPage,
  reports: ReportsPage,
  // With the backend connected, gifts are the server's; otherwise the demo page
  gifts: BACKEND_ENABLED ? GiftsLivePage : GiftsPage,
  rewards: SpendRewardsPage,
  revenue: RevenuePage,
  payments: PaymentsPage,
  coinLogs: CoinLogsPage,
  audit: AuditLogPage,
  shop: ShopPage,
  cpRings: CpRingsPage,
  coinPacks: CoinPacksPage,
  redPackets: RedPacketsPage,
  wallets: WalletPage,
  vip: VipPage,
  vipPlans: VipPlansPage,
  vipCosmetics: VipCosmeticsPage,
  pricing: PricingPage,
  visitorPlans: VisitorPlansPage,
  dailyTasks: DailyTasksPage,
  sarpanch: SarpanchPage,
  parivar: ParivarPage,
  titles: ProfileTitlesPage,
  newbie: NewbieRoomsPage,
  activity: ActivityPage,
  staff: StaffPage,
  settings: SettingsPage,
};

function NoAccess() {
  return (
    <Card>
      <Empty>
        <Lock className="mx-auto mb-2 h-6 w-6" aria-hidden />
        You don't have access to this page.
      </Empty>
    </Card>
  );
}

function DemoNote() {
  const { changed, toast, can } = useAdmin();
  const reset = async () => {
    if (!window.confirm("Reset all demo data? Coins, bans, gifts, prices, rooms, staff passwords and the activity log go back to the sample set.")) return;
    try {
      await adminApi.resetDemo?.();
      toast("Demo data reset");
      changed();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't reset", "error");
    }
  };
  return (
    <div className="mb-3 rounded-lg bg-gold/10 px-2.5 py-2 text-[11px] leading-snug text-gold">
      Demo data, saved in this browser. Connect the backend to manage real users.{" "}
      {can("demo.reset") ? (
        <button type="button" onClick={reset} className="font-bold underline underline-offset-2">
          Reset
        </button>
      ) : null}
    </div>
  );
}

/** Backend mode: sign-in, the Shop, coin packs, red packets and wallets are on the real API so far. */
function LiveNote() {
  return (
    <div className="mb-3 rounded-lg bg-ok/10 px-2.5 py-2 text-[11px] leading-snug text-ok">
      Signed in with the server. Gifts, spend rewards, revenue, payments, coin logs, the audit log, Shop items, coin packs, red packets, wallets and VIP are live; other pages still show demo data until their APIs are connected.
    </div>
  );
}

function Shell() {
  const { page, go, session, signOut, toasts, can } = useAdmin();
  const nav = NAV.filter((n) => !PAGE_PERMISSION[n.page] || can(PAGE_PERMISSION[n.page]!));
  const allowed = nav.some((n) => n.page === page);
  const View = PAGE_VIEW[page];
  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar on desktop, top bar + tab strip on phones */}
      <aside className="sticky top-0 z-30 border-b border-line bg-ink-2/95 backdrop-blur md:h-dvh md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:block md:px-5 md:pt-6 md:pb-5">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Panchayat" className="h-7 w-auto md:h-9" />
            <span className="rounded-md bg-coral px-1.5 py-0.5 text-[10px] font-extrabold tracking-[0.12em] text-white uppercase">Admin</span>
          </div>
          <button type="button" onClick={signOut} className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-cream md:hidden">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
        <nav aria-label="Admin sections" className="scroll-thin flex gap-1 overflow-x-auto px-3 pb-2 md:max-h-[calc(100dvh-260px)] md:flex-col md:overflow-y-auto md:px-3 md:pb-0">
          {nav.map(({ page: p, label, icon: Icon, child }) => (
            <button
              key={p}
              type="button"
              onClick={() => go(p)}
              aria-current={page === p ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition md:py-2.5 ${child ? "md:ml-5 md:border-l md:border-line md:rounded-l-none md:py-2 md:text-[13px]" : ""} ${page === p ? "bg-cream/[0.09] text-cream" : "text-muted hover:bg-cream/[0.04] hover:text-cream"}`}
            >
              <Icon className={`h-4 w-4 ${page === p ? "text-gold" : ""}`} aria-hidden />
              {label}
            </button>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 hidden border-t border-line p-4 md:block">
          {BACKEND_ENABLED ? <LiveNote /> : adminApi.mode === "local" ? <DemoNote /> : null}
          <div className="flex items-center gap-2.5">
            <Avatar name={session.name} color="#7a2f45" size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{session.name}</p>
              <p className="truncate text-[11px] text-muted">
                {session.title}
              </p>
            </div>
            <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-cream/5 hover:text-cream">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">
          {allowed ? <View /> : <NoAccess />}
        </div>
      </main>

      <UserDrawer />

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-xl px-4 py-2.5 text-sm font-semibold shadow-2xl ring-1 ${t.tone === "error" ? "bg-[#3a1418] text-[#ffb0b4] ring-coral/30" : "bg-surface-2 text-cream ring-line-strong"}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

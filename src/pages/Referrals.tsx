/**
 * Refer & earn, live backend:
 *  - The rates: what an inviter earns for each friend and the welcome red packet a new user gets. The app reads them live.
 *  - Every referral: who invited whom, when, and what was paid at that time (changing a rate keeps old payments as they were).
 */
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Button, Card, Empty, ErrorNote, Loading, NumberField, PageHeader, Toggle, fmtCoins } from "../components/ui";
import { NeedsBackend } from "../components/WalletParts";

type Settings = { enabled: boolean; reward: number; welcomeGift: number; maxWelcomePerNetwork: number; blockSameNetworkGifts: boolean };
type Stats = { total: number; today: number; week: number; coinsPaid: number; inviters: number };
type Top = { userId: string; publicId: string; name: string; friends: number; earned: number };
type Overview = { settings: Settings; stats: Stats; top: Top[] };
type Person = { userId: string; publicId: string; name: string; email: string };
type Row = { friend: Person; inviter: Person; joinedAt: string | null; accountCreatedAt: string | null; reward: number; note: string | null };
type Listing = { total: number; page: number; size: number; items: Row[] };
const base = "/api/v1/admin/manage/referrals";
const SIZE = 25;

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");

export function ReferralsPage() {
  if (!BACKEND_ENABLED) return <NeedsBackend what="Referrals" />;
  return <Live />;
}

function Live() {
  const { toast, version } = useAdmin();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await apiRequest<Overview>(base));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load Referrals.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, version]);

  return (
    <>
      <PageHeader title="Referrals" sub="Refer & earn: set what an invite pays, and see who invited whom." />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!data ? (
        <Loading />
      ) : (
        <div className="space-y-5">
          <Totals stats={data.stats} />
          <RatesCard key={JSON.stringify(data.settings)} settings={data.settings} onSaved={setData} toast={toast} />
          <TopCard top={data.top} />
          <ListCard version={version} />
        </div>
      )}
    </>
  );
}

function Totals({ stats }: { stats: Stats }) {
  const tiles: [string, string][] = [
    ["Friends invited", fmtCoins(stats.total)],
    ["Today", fmtCoins(stats.today)],
    ["Last 7 days", fmtCoins(stats.week)],
    ["People who invited", fmtCoins(stats.inviters)],
    ["Coins paid to inviters", fmtCoins(stats.coinsPaid)],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map(([label, v]) => (
        <div key={label} className="rounded-2xl border border-line bg-ink-2 p-4">
          <p className="text-xs text-muted">{label}</p>
          <p className="mt-1 font-display text-xl font-extrabold">{v}</p>
        </div>
      ))}
    </div>
  );
}

type Toast = (t: string, tone?: "ok" | "error") => void;

function RatesCard({ settings, onSaved, toast }: { settings: Settings; onSaved: (d: Overview) => void; toast: Toast }) {
  const [f, setF] = useState<Settings>(settings);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(settings);
  const n = (v: number) => (Number.isFinite(v) ? v : 0);
  const save = async () => {
    setBusy(true);
    try {
      onSaved(await apiRequest<Overview>(`${base}/settings`, { method: "PUT", body: { enabled: f.enabled, reward: n(f.reward), welcomeGift: n(f.welcomeGift), maxWelcomePerNetwork: n(f.maxWelcomePerNetwork), blockSameNetworkGifts: f.blockSameNetworkGifts } }));
      toast("Saved. The app shows the new rates right away.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Rates">
      <div className="space-y-4 p-4">
        <Toggle checked={f.enabled} onChange={(v) => setF((x) => ({ ...x, enabled: v }))} label="Refer & earn is on" hint="Off: new invite links stop paying. Friends already counted keep what they earned." />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Inviter earns per friend
            <div className="mt-1 max-w-[260px]">
              <NumberField value={f.reward} onChange={(v) => setF((x) => ({ ...x, reward: v }))} suffix="coins" />
            </div>
            <span className="mt-1 block text-xs font-normal text-muted">Paid once when a new friend joins with their link.</span>
          </label>
          <label className="block text-sm font-semibold">
            New user's welcome red packet
            <div className="mt-1 max-w-[260px]">
              <NumberField value={f.welcomeGift} onChange={(v) => setF((x) => ({ ...x, welcomeGift: v }))} suffix="coins" />
            </div>
            <span className="mt-1 block text-xs font-normal text-muted">Sarpanch's red packet every new user opens once (with or without an invite).</span>
          </label>
        </div>
        <div className="border-t border-line pt-4">
          <p className="mb-3 text-sm font-semibold">Fake accounts</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Welcome red packets per network
              <div className="mt-1 max-w-[260px]">
                <NumberField value={f.maxWelcomePerNetwork} onChange={(v) => setF((x) => ({ ...x, maxWelcomePerNetwork: v }))} suffix="accounts" />
              </div>
              <span className="mt-1 block text-xs font-normal text-muted">
                Only this many accounts that sign up from one connection (one Wi-Fi or phone) get the welcome red packet. 0 = no limit. Phones on a shared mobile network are not counted.
              </span>
            </label>
            <div>
              <Toggle
                checked={f.blockSameNetworkGifts}
                onChange={(v) => setF((x) => ({ ...x, blockSameNetworkGifts: v }))}
                label="Block gifts between accounts on the same network"
                hint="Stops fake accounts sending their coins to the main one. CP partners can still send to each other. Applies to accounts created from now on."
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">A friend who joins from the inviter's own network, or from a network that already got its welcome gift, earns the inviter nothing.</p>
        </div>
        <Button variant="primary" busy={busy} disabled={!dirty} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </Card>
  );
}

function TopCard({ top }: { top: Top[] }) {
  return (
    <Card title="Top inviters">
      {!top.length ? (
        <Empty>No referrals yet.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {top.map((t, i) => (
            <li key={t.userId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-6 text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {t.name} <span className="font-normal text-muted">ID {t.publicId}</span>
              </span>
              <span className="text-muted">{fmtCoins(t.friends)} friends</span>
              <span className="w-28 text-right font-semibold">{fmtCoins(t.earned)} coins</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ListCard({ version }: { version: number }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);
  const [d, setD] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => {
      setTerm(q.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => {
    let off = false;
    apiRequest<Listing>(`${base}/list?q=${encodeURIComponent(term)}&page=${page}&size=${SIZE}`)
      .then((x) => {
        if (!off) {
          setD(x);
          setError(null);
        }
      })
      .catch((e) => !off && setError(e instanceof Error ? e.message : "Couldn't load the list."));
    return () => {
      off = true;
    };
  }, [term, page, version]);
  const pages = d ? Math.max(1, Math.ceil(d.total / d.size)) : 1;
  return (
    <Card title={d ? `All referrals (${fmtCoins(d.total)})` : "All referrals"}>
      <div className="relative border-b border-line p-3">
        <Search className="pointer-events-none absolute top-1/2 left-6 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input className="field pl-9" placeholder="Search a name, email or ID (inviter or friend)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search referrals" />
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!d ? (
        <Loading />
      ) : !d.items.length ? (
        <Empty>{term ? "No referral matches that search." : "Nobody has joined with an invite link yet."}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">Invited by</th>
                <th className="px-4 py-2 font-semibold">Friend who joined</th>
                <th className="px-4 py-2 font-semibold">Joined with the link</th>
                <th className="px-4 py-2 text-right font-semibold">Paid to inviter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.items.map((r) => (
                <tr key={r.friend.userId}>
                  <PersonCell p={r.inviter} />
                  <PersonCell p={r.friend} />
                  <td className="px-4 py-2.5 text-muted">{when(r.joinedAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="font-semibold">{fmtCoins(r.reward)}</span>
                    {r.note ? <span className="block text-xs text-coral">{r.note}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {d && d.total > d.size ? (
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
          <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Previous
          </Button>
          <span className="text-muted">
            Page {page + 1} of {pages}
          </span>
          <Button size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function PersonCell({ p }: { p: Person }) {
  return (
    <td className="px-4 py-2.5">
      <span className="block font-semibold">{p.name || "Unnamed"}</span>
      <span className="block text-xs text-muted">
        ID {p.publicId}
        {p.email ? ` · ${p.email}` : ""}
      </span>
    </td>
  );
}

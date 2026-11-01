import { useState } from "react";
import { Crown, Gift, Lock, Plus, X } from "lucide-react";
import { adminApi, type CoinPack, type Pricing, type RedPacketPrice, type VipPlan } from "../api";
import { useAdmin } from "../context";
import { BACKEND_ENABLED } from "../config/api";
import { Button, Card, ErrorNote, Loading, NumberField, PageHeader, timeAgo, Toggle, useLoad } from "../components/ui";

export function PricingPage() {
  const { version, can } = useAdmin();
  const pricing = useLoad(() => adminApi.getPricing(), [version]);
  const editable = can("pricing.edit");

  return (
    <>
      <PageHeader title="Pricing" sub="What VIP, coins and red packets cost in the app. Every change is saved in the activity log." />
      {!editable ? (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-gold/10 px-3.5 py-2.5 text-sm text-gold">
          <Lock className="h-4 w-4 shrink-0" aria-hidden /> Prices are view only for you.
        </p>
      ) : null}
      {pricing.error ? <ErrorNote>{pricing.error}</ErrorNote> : null}
      {!pricing.data ? (
        <Loading />
      ) : (
        <div className="space-y-5">
          <VipPrices key={`vip-${pricing.data.updatedAt}`} pricing={pricing.data} editable={editable} />
          {BACKEND_ENABLED ? (
            <LiveWalletNote />
          ) : (
            <>
              <CoinPacks key={`packs-${pricing.data.updatedAt}`} pricing={pricing.data} editable={editable} />
              <RedPackets key={`rp-${pricing.data.updatedAt}`} pricing={pricing.data} editable={editable} />
            </>
          )}
          <p className="text-xs text-muted">
            VIP, coin pack and red packet prices last changed by {pricing.data.updatedBy} · {timeAgo(pricing.data.updatedAt)}
          </p>
        </div>
      )}
    </>
  );
}

/** With the backend, coin packs and red packets live on their own pages, not in this demo table. */
function LiveWalletNote() {
  const { go, can } = useAdmin();
  return (
    <Card title="Coin packs and red packets">
      <div className="flex flex-wrap items-center gap-3 px-4 py-4 text-sm text-muted">
        <p className="min-w-0 flex-1">These are managed live on the server, on their own pages.</p>
        {can("wallet.manage") ? (
          <span className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => go("coinPacks")}>
              Coin packs
            </Button>
            <Button size="sm" variant="ghost" onClick={() => go("redPackets")}>
              Red packets
            </Button>
          </span>
        ) : (
          <span className="text-xs">Only a Super Admin can manage them.</span>
        )}
      </div>
    </Card>
  );
}

function useSave() {
  const { changed, toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  const save = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast(done);
      changed();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  };
  return { busy, save };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function VipPrices({ pricing, editable }: { pricing: Pricing; editable: boolean }) {
  const [vip, setVip] = useState<VipPlan[]>(pricing.vip);
  const { busy, save } = useSave();
  const set = (level: number, patch: Partial<VipPlan>) => setVip((v) => v.map((x) => (x.level === level ? { ...x, ...patch } : x)));
  const dirty = !same(vip, pricing.vip);
  const valid = vip.every((v) => Number.isFinite(v.coins) && v.days > 0);

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-gold" aria-hidden /> VIP prices
        </span>
      }
      action={
        editable ? (
          <Button size="sm" variant="primary" busy={busy} disabled={!dirty || !valid} onClick={() => save(() => adminApi.savePricing({ vip, coinPacks: pricing.coinPacks, redPackets: pricing.redPackets }), "VIP prices saved")}>
            Save VIP prices
          </Button>
        ) : null
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-wider text-muted uppercase">
              <th className="px-4 py-2.5 font-bold">Level</th>
              <th className="px-2 py-2.5 font-bold">Price</th>
              <th className="px-2 py-2.5 font-bold">Lasts</th>
              <th className="px-4 py-2.5 font-bold">On sale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {vip.map((v) => (
              <tr key={v.level}>
                <td className="px-4 py-2 font-display font-bold text-gold">VIP {v.level}</td>
                <td className="w-48 px-2 py-2">
                  <NumberField value={v.coins} onChange={(n) => set(v.level, { coins: n })} disabled={!editable} suffix="coins" />
                </td>
                <td className="w-36 px-2 py-2">
                  <NumberField value={v.days} onChange={(n) => set(v.level, { days: n })} disabled={!editable} suffix="days" />
                </td>
                <td className="px-4 py-2">
                  <Toggle checked={v.active} onChange={(a) => set(v.level, { active: a })} disabled={!editable} label="On sale" hideLabel />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

let packSeq = 1;

function CoinPacks({ pricing, editable }: { pricing: Pricing; editable: boolean }) {
  const [packs, setPacks] = useState<CoinPack[]>(pricing.coinPacks);
  const { busy, save } = useSave();
  const set = (id: string, patch: Partial<CoinPack>) => setPacks((v) => v.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const dirty = !same(packs, pricing.coinPacks);
  const valid = packs.every((p) => p.coins > 0 && Number.isFinite(p.bonus) && p.priceInr > 0);

  return (
    <Card
      title="Coin packs"
      action={
        editable ? (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPacks((v) => [...v, { id: `pack-new-${Date.now().toString(36)}${packSeq++}`, coins: NaN, bonus: 0, priceInr: NaN, active: true }])}>
              <Plus className="h-3.5 w-3.5" /> Add pack
            </Button>
            <Button size="sm" variant="primary" busy={busy} disabled={!dirty || !valid} onClick={() => save(() => adminApi.savePricing({ vip: pricing.vip, coinPacks: packs, redPackets: pricing.redPackets }), "Coin packs saved")}>
              Save packs
            </Button>
          </div>
        ) : null
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-wider text-muted uppercase">
              <th className="px-4 py-2.5 font-bold">Coins</th>
              <th className="px-2 py-2.5 font-bold">Bonus</th>
              <th className="px-2 py-2.5 font-bold">Price</th>
              <th className="px-2 py-2.5 font-bold">Label</th>
              <th className="px-2 py-2.5 font-bold">On sale</th>
              <th className="px-2 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {packs.map((p) => (
              <tr key={p.id}>
                <td className="w-40 px-4 py-2">
                  <NumberField value={p.coins} onChange={(n) => set(p.id, { coins: n })} disabled={!editable} />
                </td>
                <td className="w-32 px-2 py-2">
                  <NumberField value={p.bonus} onChange={(n) => set(p.id, { bonus: Number.isFinite(n) ? n : 0 })} disabled={!editable} />
                </td>
                <td className="w-32 px-2 py-2">
                  <NumberField value={p.priceInr} onChange={(n) => set(p.id, { priceInr: n })} disabled={!editable} suffix="₹" />
                </td>
                <td className="px-2 py-2">
                  <input className="field disabled:opacity-60" disabled={!editable} value={p.tag ?? ""} placeholder="e.g. Best value" onChange={(e) => set(p.id, { tag: e.target.value || undefined })} />
                </td>
                <td className="px-2 py-2">
                  <Toggle checked={p.active} onChange={(a) => set(p.id, { active: a })} disabled={!editable} label="On sale" hideLabel />
                </td>
                <td className="px-2 py-2 text-right">
                  {editable ? (
                    <button type="button" aria-label="Remove pack" onClick={() => setPacks((v) => v.filter((x) => x.id !== p.id))} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-cream/5 hover:text-cream">
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
        People get coins + bonus. {packs.filter((p) => p.coins > 0 && p.priceInr > 0).length ? `Cheapest coin: ₹${Math.min(...packs.filter((p) => p.coins > 0 && p.priceInr > 0).map((p) => p.priceInr / (p.coins + (p.bonus || 0)))).toFixed(3)} each.` : ""}
      </p>
    </Card>
  );
}

const PACKET_TONE: Record<RedPacketPrice["id"], string> = {
  "rp-10k": "from-[#e2343f] to-[#8f1520]",
  "rp-50k": "from-[#7a3fd0] to-[#3b1a73]",
  "rp-80k": "from-[#e7bc72] to-[#9a6a22]",
};

function RedPackets({ pricing, editable }: { pricing: Pricing; editable: boolean }) {
  const [packets, setPackets] = useState<RedPacketPrice[]>(pricing.redPackets);
  const { busy, save } = useSave();
  const set = (id: RedPacketPrice["id"], patch: Partial<RedPacketPrice>) => setPackets((v) => v.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const dirty = !same(packets, pricing.redPackets);
  const valid = packets.every((r) => r.priceInr > 0 && r.pot > 0 && r.name.trim() !== "");

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-coral" aria-hidden /> Red packets
        </span>
      }
      action={
        editable ? (
          <Button size="sm" variant="primary" busy={busy} disabled={!dirty || !valid} onClick={() => save(() => adminApi.savePricing({ vip: pricing.vip, coinPacks: pricing.coinPacks, redPackets: packets }), "Red packet prices saved")}>
            Save red packets
          </Button>
        ) : null
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-wider text-muted uppercase">
              <th className="px-4 py-2.5 font-bold">Packet</th>
              <th className="px-2 py-2.5 font-bold">Price</th>
              <th className="px-2 py-2.5 font-bold">Coins inside</th>
              <th className="px-4 py-2.5 font-bold">On sale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {packets.map((r) => {
              return (
                <tr key={r.id}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2.5">
                      <span aria-hidden className={`grid h-9 w-7 shrink-0 place-items-center rounded-md bg-gradient-to-b ${PACKET_TONE[r.id]} text-[9px] font-extrabold text-white shadow`}>
                        {r.id.replace("rp-", "").toUpperCase()}
                      </span>
                      <input className="field min-w-0 disabled:opacity-60" aria-label="Packet name" disabled={!editable} value={r.name} onChange={(e) => set(r.id, { name: e.target.value })} />
                    </div>
                  </td>
                  <td className="w-44 px-2 py-2">
                    <NumberField value={r.priceInr} onChange={(n) => set(r.id, { priceInr: n })} disabled={!editable} suffix="₹" />
                  </td>
                  <td className="w-44 px-2 py-2">
                    <NumberField value={r.pot} onChange={(n) => set(r.id, { pot: n })} disabled={!editable} suffix="coins" />
                  </td>
                  <td className="px-4 py-2">
                    <Toggle checked={r.active} onChange={(a) => set(r.id, { active: a })} disabled={!editable} label="On sale" hideLabel />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2.5 text-xs leading-snug text-muted">
        People pay the price in rupees to buy a packet; when they drop it, everyone in the room grabs the coins inside. Packets already in people's Bags keep the coins they had.
      </p>
    </Card>
  );
}

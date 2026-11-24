/**
 * Inventory (live backend): every item the app hands out, in one place: gifts, Shop items (incl. PK Shop), name
 * frames, profile titles, spend rewards, family chest and Gacha rewards, room treasure. For each: where it goes,
 * its price / amount, an on / off switch, and a link to the page that edits it fully.
 */
import { useCallback, useEffect, useState } from "react";
import { MediaPreview, formatOf } from "../components/MediaParts";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin, type Page } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Button, Card, Chips, Empty, ErrorNote, Loading, PageHeader, Toggle } from "../components/ui";
import { NeedsBackend } from "../components/WalletParts";

type Item = { kind: string; id: string; name: string; picture: string | null; where: string[]; value: string | number | null; active: boolean; page: string };
type Data = { counts: Record<string, number>; items: Item[] };

const KIND_LABEL: Record<string, string> = {
  GIFT: "Gifts",
  SHOP: "Shop items",
  FRAME: "Name frames",
  TITLE: "Titles",
  SPEND_REWARD: "Spend rewards",
  FAMILY_CHEST: "Family chest",
  GACHA: "Gacha",
  ROOM_TREASURE: "Room treasure",
};

export function InventoryPage() {
  if (!BACKEND_ENABLED) return <NeedsBackend what="Inventory" />;
  return <Live />;
}

function Live() {
  const { toast, go, can, version } = useAdmin();
  const [kind, setKind] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setTerm(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (kind !== "ALL") p.set("kind", kind);
    if (term) p.set("q", term);
    apiRequest<Data>(`/api/v1/admin/inventory?${p}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the inventory."));
  }, [kind, term]);
  useEffect(load, [load, version]);

  const toggle = async (it: Item, on: boolean) => {
    setBusy(`${it.kind}:${it.id}`);
    try {
      await apiRequest(`/api/v1/admin/inventory/${it.kind}/${encodeURIComponent(it.id)}`, { method: "PATCH", body: { active: on } });
      toast(`${it.name} is ${on ? "on" : "off"}`);
      setData((d) => (d ? { ...d, items: d.items.map((x) => (x.kind === it.kind && x.id === it.id ? { ...x, active: on } : x)) } : d));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't change it", "error");
    } finally {
      setBusy(null);
    }
  };

  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;
  return (
    <>
      <PageHeader title="Inventory" sub="Every gift, reward and item in one place: where each one goes, on or off, and a link to its own page to change everything else." />
      <Card
        action={<input className="field h-9 w-56" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the inventory" />}
        title={data ? `${data.items.length} shown · ${total} items in all` : "Items"}
      >
        <div className="px-4 pt-3">
          <Chips
            label="Kind"
            value={kind}
            onChange={setKind}
            options={[{ value: "ALL", label: `All${data ? ` (${total})` : ""}` }, ...Object.keys(KIND_LABEL).map((k) => ({ value: k, label: `${KIND_LABEL[k]}${data ? ` (${data.counts[k] ?? 0})` : ""}` }))]}
          />
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        {!data ? (
          <Loading />
        ) : !data.items.length ? (
          <Empty>Nothing here.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {data.items.map((it) => (
              <li key={`${it.kind}:${it.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-ink ring-1 ring-line">
                  {it.picture ? <MediaPreview media={{ url: it.picture, format: formatOf(it.picture) }} size={44} /> : <span className="text-lg">🎁</span>}
                </span>
                <span className="min-w-0 flex-1 basis-64">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {it.name}
                    <Badge tone="info">{KIND_LABEL[it.kind] ?? it.kind}</Badge>
                    {it.value !== null && it.value !== "" ? <span className="text-xs font-normal text-muted">{typeof it.value === "number" ? it.value.toLocaleString("en-IN") : it.value}</span> : null}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {it.where.map((w) => (
                      <span key={w} className="rounded-full bg-cream/[0.06] px-2 py-0.5 text-[11px] text-muted ring-1 ring-line">
                        → {w}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  {can("users.view") ? (
                    <Toggle checked={it.active} onChange={(on) => void toggle(it, on)} label={busy === `${it.kind}:${it.id}` ? "…" : it.active ? "On" : "Off"} />
                  ) : (
                    <Badge tone={it.active ? "ok" : "muted"}>{it.active ? "On" : "Off"}</Badge>
                  )}
                  <Button size="sm" onClick={() => go(it.page as Page)}>
                    Edit
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

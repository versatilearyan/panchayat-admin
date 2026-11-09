/**
 * Charm for each CP ring (live backend). Rings themselves are Shop products (category "ring").
 *  - Charm: what the person who receives the ring earns (profile Charm). Blank = price / 5.
 *  - CP Charm: Charm the couple earns when the ring is added to their ring box. Blank or 0 = none.
 */
import { useCallback, useEffect, useState } from "react";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Card, Empty, ErrorNote, Loading, PageHeader, fmtCoins } from "../components/ui";
import { NeedsBackend } from "../components/WalletParts";
import { mediaHref } from "../components/MediaParts";

type Ring = { id: string; name: string; price: number; imageUrl: string | null; charm: number | null; cpCharm: number | null; active: boolean };
const base = "/api/v1/admin/manage/cp-rings";

export function CpRingsPage() {
  if (!BACKEND_ENABLED) return <NeedsBackend what="CP rings" />;
  return <Live />;
}

function Live() {
  const { toast, version } = useAdmin();
  const [rings, setRings] = useState<Ring[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRings(await apiRequest<Ring[]>(base));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the rings.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, version]);

  const save = async (r: Ring, charmRaw: string, cpRaw: string) => {
    const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v))));
    const charm = num(charmRaw);
    const cpCharm = num(cpRaw);
    if ((charm !== null && !Number.isFinite(charm)) || (cpCharm !== null && !Number.isFinite(cpCharm))) return;
    if (charm === r.charm && cpCharm === r.cpCharm) return;
    try {
      await apiRequest(`${base}/${encodeURIComponent(r.id)}`, { method: "PUT", body: { charm, cpCharm } });
      setRings((list) => (list ?? []).map((x) => (x.id === r.id ? { ...x, charm, cpCharm } : x)));
      toast(`${r.name}: saved`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    }
  };

  return (
    <>
      <PageHeader title="CP rings" sub="Set the Charm of each ring. Add or change the rings themselves in Shop items (category Ring)." />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Card title={rings ? `${rings.length} rings` : "Rings"}>
        {!rings ? (
          <Loading />
        ) : !rings.length ? (
          <Empty>No rings yet.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {rings.map((r) => (
              <li key={`${r.id}-${r.charm ?? ""}-${r.cpCharm ?? ""}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-ink ring-1 ring-line">
                  {r.imageUrl ? <img src={mediaHref(r.imageUrl) ?? r.imageUrl} alt="" className="h-full w-full object-contain" /> : <span className="text-lg">💍</span>}
                </span>
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block truncate font-semibold">{r.name}</span>
                  <span className="text-xs text-muted">{fmtCoins(r.price)} coins</span>
                  <span className="ml-2 align-middle">
                    <Badge tone={r.active ? "ok" : "muted"}>{r.active ? "On sale" : "Off"}</Badge>
                  </span>
                </span>
                <RingInputs ring={r} onSave={(c, cp) => void save(r, c, cp)} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function RingInputs({ ring, onSave }: { ring: Ring; onSave: (charm: string, cpCharm: string) => void }) {
  const [charm, setCharm] = useState(ring.charm === null ? "" : String(ring.charm));
  const [cp, setCp] = useState(ring.cpCharm === null ? "" : String(ring.cpCharm));
  const commit = () => onSave(charm, cp);
  return (
    <span className="flex gap-3">
      <label className="text-xs font-semibold text-muted">
        Charm
        <input className="field mt-1 h-9 w-28 py-1 text-sm" inputMode="numeric" placeholder={String(Math.floor(ring.price / 5))} value={charm} onChange={(e) => setCharm(e.target.value.replace(/\D/g, ""))} onBlur={commit} aria-label={`Charm for ${ring.name}`} />
      </label>
      <label className="text-xs font-semibold text-muted">
        CP Charm
        <input className="field mt-1 h-9 w-28 py-1 text-sm" inputMode="numeric" placeholder="0" value={cp} onChange={(e) => setCp(e.target.value.replace(/\D/g, ""))} onBlur={commit} aria-label={`CP Charm for ${ring.name}`} />
      </label>
    </span>
  );
}

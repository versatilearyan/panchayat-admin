import { useState } from "react";
import { Eye, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "../lib/api";
import { useAdmin } from "../context";
import { Button, Card, Empty, ErrorNote, Loading, PageHeader, useLoad } from "../components/ui";

type Plan = { id: string; label: string; days: number; price: number; badge: string | null; sortOrder: number; active: boolean };

const blank = { label: "", days: 7, price: 200, badge: "", sortOrder: 0, active: true };

/**
 * Visitor log plans: how long people can see who visited their profile, and
 * the price in coins. Users buy them in the app; the coins come off their
 * balance and the days are added to the time they have left.
 */
export function VisitorPlansPage() {
  const { version, changed, toast } = useAdmin();
  const plans = useLoad(() => apiRequest<Plan[]>("/api/v1/admin/visitor-plans"), [version]);
  const [edit, setEdit] = useState<Record<string, typeof blank>>({});
  const [adding, setAdding] = useState<typeof blank | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (id: string | null, f: typeof blank) => {
    setBusy(id ?? "new");
    setError(null);
    try {
      const body = { label: f.label.trim(), days: Number(f.days), price: Number(f.price), badge: f.badge.trim() || null, sortOrder: Number(f.sortOrder) || 0, active: f.active };
      await apiRequest(id ? `/api/v1/admin/visitor-plans/${id}` : "/api/v1/admin/visitor-plans", { method: id ? "PUT" : "POST", body });
      toast(id ? "Plan saved" : "Plan added");
      if (id) setEdit((e) => {
        const n = { ...e };
        delete n[id];
        return n;
      });
      else setAdding(null);
      changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(null);
    }
  };
  const remove = async (p: Plan) => {
    if (!window.confirm(`Delete the "${p.label}" plan? People who bought it keep their time.`)) return;
    setBusy(p.id);
    try {
      await apiRequest(`/api/v1/admin/visitor-plans/${p.id}`, { method: "DELETE" });
      toast("Plan deleted");
      changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete");
    } finally {
      setBusy(null);
    }
  };

  const Row = ({ id, f, set }: { id: string | null; f: typeof blank; set: (f: typeof blank) => void }) => (
    <div className="grid items-end gap-3 px-4 py-3 sm:grid-cols-[1.3fr_0.7fr_0.9fr_1fr_0.6fr_auto]">
      <label className="block">
        <span className="label">Name</span>
        <input className="field" value={f.label} maxLength={40} onChange={(e) => set({ ...f, label: e.target.value })} placeholder="7 days" />
      </label>
      <label className="block">
        <span className="label">Days</span>
        <input className="field" type="number" min={1} max={3650} value={f.days} onChange={(e) => set({ ...f, days: Number(e.target.value) })} />
      </label>
      <label className="block">
        <span className="label">Price (coins)</span>
        <input className="field" type="number" min={1} value={f.price} onChange={(e) => set({ ...f, price: Number(e.target.value) })} />
      </label>
      <label className="block">
        <span className="label">Badge</span>
        <input className="field" value={f.badge} maxLength={20} onChange={(e) => set({ ...f, badge: e.target.value })} placeholder="POPULAR" />
      </label>
      <label className="block">
        <span className="label">Order</span>
        <input className="field" type="number" value={f.sortOrder} onChange={(e) => set({ ...f, sortOrder: Number(e.target.value) })} />
      </label>
      <div className="flex items-center gap-2 pb-0.5">
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={f.active} onChange={(e) => set({ ...f, active: e.target.checked })} /> On sale
        </label>
        <Button size="sm" variant="primary" busy={busy === (id ?? "new")} onClick={() => save(id, f)}>
          Save
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader title="Visitor log" sub="Plans people buy with coins to see who visited their profile. Buying again adds the days to the time left." />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-gold" /> Plans
          </span>
        }
        action={
          <Button size="sm" variant="soft" onClick={() => setAdding({ ...blank })}>
            <Plus className="h-3.5 w-3.5" /> Add plan
          </Button>
        }
      >
        {plans.loading && !plans.data ? <Loading /> : null}
        {plans.error ? <ErrorNote>{plans.error}</ErrorNote> : null}
        {adding ? <Row id={null} f={adding} set={setAdding} /> : null}
        {plans.data && plans.data.length === 0 && !adding ? <Empty>No plans yet. Add one so people can buy the visitor log.</Empty> : null}
        <div className="divide-y divide-line">
          {(plans.data ?? []).map((p) => {
            const f = edit[p.id];
            return f ? (
              <Row key={p.id} id={p.id} f={f} set={(x) => setEdit((e) => ({ ...e, [p.id]: x }))} />
            ) : (
              <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold">
                    {p.label}
                    {p.badge ? <span className="rounded-full bg-coral/20 px-2 py-0.5 text-[10px] font-bold text-coral">{p.badge}</span> : null}
                    {!p.active ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-muted">Off sale</span> : null}
                  </span>
                  <span className="text-xs text-muted">
                    {p.days} days · {p.price.toLocaleString("en-IN")} coins · order {p.sortOrder}
                  </span>
                </span>
                <Button size="sm" variant="soft" onClick={() => setEdit((e) => ({ ...e, [p.id]: { label: p.label, days: p.days, price: p.price, badge: p.badge ?? "", sortOrder: p.sortOrder, active: p.active } }))}>
                  Edit
                </Button>
                <Button size="sm" variant="soft" busy={busy === p.id} onClick={() => remove(p)} aria-label={`Delete ${p.label}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

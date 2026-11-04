import { useState } from "react";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "../lib/api";
import { useAdmin } from "../context";
import { Badge, Button, Card, Empty, ErrorNote, Loading, PageHeader, useLoad } from "../components/ui";

type Task = { id: string; title: string; kind: string; goal: number; rewardCoins: number; rewardExp: number; active: boolean; sortOrder: number; claimedToday: number };
type Form = { title: string; kind: string; goal: number; rewardCoins: number; rewardExp: number; active: boolean; sortOrder: number };

const KINDS: { value: string; label: string; unit: string }[] = [
  { value: "CHECK_IN", label: "Check in (open the app)", unit: "times" },
  { value: "VOICE_MINUTES", label: "Minutes in a voice room", unit: "minutes" },
  { value: "SEND_GIFT", label: "Send gifts", unit: "gifts" },
  { value: "PLAY_GAME", label: "Play games", unit: "games" },
  { value: "INVITE_FRIEND", label: "Invite friends", unit: "invites" },
  { value: "SEND_MESSAGE", label: "Send chat messages", unit: "messages" },
  { value: "POST_MOMENT", label: "Post a moment", unit: "posts" },
];
const blank: Form = { title: "", kind: "SEND_GIFT", goal: 1, rewardCoins: 100, rewardExp: 50, active: true, sortOrder: 0 };
const kindLabel = (k: string) => KINDS.find((x) => x.value === k)?.label ?? k;

/**
 * Daily tasks in the app: what people do each day and the coins they get.
 * Progress is counted by the server from real activity and resets at midnight
 * (India time). Claimed coins go straight into the user's balance.
 */
export function DailyTasksPage() {
  const { version, changed, toast } = useAdmin();
  const list = useLoad(() => apiRequest<Task[]>("/api/v1/admin/daily-tasks"), [version]);
  const [edit, setEdit] = useState<Record<string, Form>>({});
  const [adding, setAdding] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (id: string | null, f: Form) => {
    if (!f.title.trim()) return setError("Give the task a title.");
    setBusy(id ?? "new");
    setError(null);
    try {
      const body = { ...f, title: f.title.trim(), goal: Number(f.goal), rewardCoins: Number(f.rewardCoins), rewardExp: Number(f.rewardExp), sortOrder: Number(f.sortOrder) || 0 };
      await apiRequest(id ? `/api/v1/admin/daily-tasks/${id}` : "/api/v1/admin/daily-tasks", { method: id ? "PUT" : "POST", body });
      toast(id ? "Task saved" : "Task added");
      if (id) setEdit(({ [id]: _drop, ...rest }) => rest);
      else setAdding(null);
      changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(null);
    }
  };
  const remove = async (t: Task) => {
    if (!window.confirm(`Delete "${t.title}"? Today's progress on it is lost.`)) return;
    setBusy(t.id);
    try {
      await apiRequest(`/api/v1/admin/daily-tasks/${t.id}`, { method: "DELETE" });
      toast("Task deleted");
      changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete");
    } finally {
      setBusy(null);
    }
  };

  const fields = (f: Form, set: (f: Form) => void) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="sm:col-span-2">
        <label className="label">Title</label>
        <input className="field" maxLength={120} value={f.title} onChange={(e) => set({ ...f, title: e.target.value })} placeholder="Send a gift" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">What counts</label>
        <select className="field" value={f.kind} onChange={(e) => set({ ...f, kind: e.target.value })}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Goal ({KINDS.find((k) => k.value === f.kind)?.unit})</label>
        <input className="field font-mono" inputMode="numeric" value={f.goal} onChange={(e) => set({ ...f, goal: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
      </div>
      <div>
        <label className="label">Order</label>
        <input className="field font-mono" inputMode="numeric" value={f.sortOrder} onChange={(e) => set({ ...f, sortOrder: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
      </div>
      <div>
        <label className="label">Coins reward</label>
        <input className="field font-mono" inputMode="numeric" value={f.rewardCoins} onChange={(e) => set({ ...f, rewardCoins: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
      </div>
      <div>
        <label className="label">EXP reward</label>
        <input className="field font-mono" inputMode="numeric" value={f.rewardExp} onChange={(e) => set({ ...f, rewardExp: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
      </div>
      <label className="flex items-end gap-2 pb-2 text-sm">
        <input type="checkbox" checked={f.active} onChange={(e) => set({ ...f, active: e.target.checked })} /> Shown in the app
      </label>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Daily tasks"
        sub="What people do each day for coins. Progress is counted by the server and resets at midnight (India time). Claimed coins go straight to their balance."
        right={
          adding ? null : (
            <Button variant="primary" onClick={() => setAdding({ ...blank })}>
              <Plus className="h-4 w-4" /> Add task
            </Button>
          )
        }
      />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {adding ? (
        <Card title="New task" className="mb-4">
          <div className="space-y-3 p-4">
            {fields(adding, setAdding)}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(null)}>
                Cancel
              </Button>
              <Button variant="primary" busy={busy === "new"} onClick={() => void save(null, adding)}>
                Add task
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
      <Card
        title={
          <span className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-gold" aria-hidden /> Tasks
          </span>
        }
      >
        {list.error ? <ErrorNote>{list.error}</ErrorNote> : null}
        {!list.data ? (
          <Loading />
        ) : list.data.length === 0 ? (
          <Empty>No tasks yet. Add one.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {list.data.map((t) => {
              const f = edit[t.id];
              return (
                <li key={t.id} className="px-4 py-3">
                  {f ? (
                    <div className="space-y-3">
                      {fields(f, (n) => setEdit((e) => ({ ...e, [t.id]: n })))}
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setEdit(({ [t.id]: _drop, ...rest }) => rest)}>
                          Cancel
                        </Button>
                        <Button variant="primary" busy={busy === t.id} onClick={() => void save(t.id, f)}>
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 font-semibold">
                          {t.title} {t.active ? null : <Badge>hidden</Badge>}
                        </p>
                        <p className="text-xs text-muted">
                          {kindLabel(t.kind)} · goal {t.goal} · claimed today by {t.claimedToday}
                        </p>
                      </div>
                      <Badge tone="gold">+{t.rewardCoins.toLocaleString("en-IN")} coins</Badge>
                      <Badge tone="info">+{t.rewardExp} EXP</Badge>
                      <Button size="sm" variant="ghost" onClick={() => setEdit((e) => ({ ...e, [t.id]: { title: t.title, kind: t.kind, goal: t.goal, rewardCoins: t.rewardCoins, rewardExp: t.rewardExp, active: t.active, sortOrder: t.sortOrder } }))}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" busy={busy === t.id} onClick={() => void remove(t)} aria-label={`Delete ${t.title}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

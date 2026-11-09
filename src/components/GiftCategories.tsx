/** Gift categories: add your own, including VIP gifts (only VIP can send) and CP gifts (only to your CP partner). */
import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Button, Chips, ErrorNote, Modal } from "./ui";

export type GiftCategory = { name: string; kind: "NORMAL" | "VIP" | "CP"; sortOrder: number };
const base = "/api/v1/admin/manage/gifts/categories";

export function useGiftCategories() {
  const [cats, setCats] = useState<GiftCategory[]>([]);
  const reload = useCallback(async () => {
    try {
      setCats(await apiRequest<GiftCategory[]>(base));
    } catch {
      /* keep what is showing */
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { cats, reload };
}

const KIND_NOTE: Record<GiftCategory["kind"], string> = {
  NORMAL: "Anyone can send these gifts.",
  VIP: "Only people with active VIP can send these gifts.",
  CP: "These gifts can be sent only to your CP partner.",
};

export function GiftCategoriesDialog({ open, onClose, cats, onChanged }: { open: boolean; onClose: () => void; cats: GiftCategory[]; onChanged: () => void }) {
  const { toast } = useAdmin();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<GiftCategory["kind"]>("NORMAL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(base, { method: "POST", body: { name: name.trim(), kind } });
      toast(`Category "${name.trim()}" added`);
      setName("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add it");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (c: GiftCategory) => {
    try {
      await apiRequest(`${base}/${encodeURIComponent(c.name)}`, { method: "DELETE" });
      toast(`Category "${c.name}" removed`);
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't remove it", "error");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Gift categories" wide>
      <div className="space-y-5">
        <div className="space-y-3 rounded-2xl bg-ink p-4 ring-1 ring-line">
          <label className="label" htmlFor="cat-name">
            New category
          </label>
          <input id="cat-name" className="field h-10 w-full" maxLength={30} placeholder="e.g. Diwali" value={name} onChange={(e) => setName(e.target.value)} />
          <Chips
            label="Who can send"
            value={kind}
            onChange={setKind}
            options={[
              { value: "NORMAL", label: "Everyone" },
              { value: "VIP", label: "VIP gifts" },
              { value: "CP", label: "CP gifts" },
            ]}
          />
          <p className="text-xs text-muted">{KIND_NOTE[kind]}</p>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <Button variant="gold" busy={busy} disabled={name.trim().length < 2} onClick={add}>
            Add category
          </Button>
        </div>
        <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
          {cats.map((c) => (
            <li key={c.name} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1 font-semibold">{c.name}</span>
              <Badge tone={c.kind === "VIP" ? "gold" : c.kind === "CP" ? "coral" : "muted"}>{c.kind === "NORMAL" ? "Everyone" : c.kind === "VIP" ? "VIP only" : "CP partner only"}</Badge>
              <Button size="sm" variant="danger" onClick={() => void remove(c)} aria-label={`Remove ${c.name}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">A category with gifts in it can't be removed: move its gifts to another category first.</p>
      </div>
    </Modal>
  );
}

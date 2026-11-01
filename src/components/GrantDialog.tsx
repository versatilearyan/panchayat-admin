/** Give a user VIP, or an item from the Shop (chat bubble, ring, frame…), for some days or forever. */
import { useMemo, useState } from "react";
import { Crown } from "lucide-react";
import { adminApi, PRODUCT_KINDS, type AdminUser, type ProductKind } from "../api";
import { useAdmin } from "../context";
import { KIND_LABEL, ProductPreview } from "../pages/Shop";
import { Avatar, Button, Chips, ErrorNote, Modal, useLoad } from "./ui";

export type GrantKind = "vip" | "item";

const REASONS = ["Event winner", "Compensation", "Top supporter", "Host reward", "Promotion", "Testing"];

const VIP_DAYS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
  { value: null, label: "Forever" },
] as { value: number | null; label: string }[];

const ITEM_DAYS = [
  { value: 2, label: "2 days" },
  { value: 6, label: "6 days" },
  { value: 30, label: "30 days" },
  { value: null, label: "Forever" },
] as { value: number | null; label: string }[];

export function GrantDialog({ kind, user, onClose }: { kind: GrantKind | null; user: AdminUser; onClose: () => void }) {
  return (
    <Modal open={kind !== null} onClose={onClose} title={kind === "vip" ? "Give VIP" : "Give an item"}>
      {kind ? <GrantForm key={kind} kind={kind} user={user} onClose={onClose} /> : null}
    </Modal>
  );
}

function GrantForm({ kind, user, onClose }: { kind: GrantKind; user: AdminUser; onClose: () => void }) {
  const { changed, toast } = useAdmin();
  const products = useLoad(() => (kind === "item" ? adminApi.listProducts() : Promise.resolve([])), [kind]);
  const [level, setLevel] = useState(Math.min(10, Math.max(1, user.vip + 1)));
  const [itemKind, setItemKind] = useState<ProductKind>("bubble");
  const [productId, setProductId] = useState("");
  const [days, setDays] = useState<number | null>(kind === "vip" ? 30 : 6);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => (products.data ?? []).filter((p) => p.kind === itemKind), [products.data, itemKind]);
  const product = options.find((p) => p.id === productId);

  const pickKind = (k: ProductKind) => {
    setItemKind(k);
    setProductId("");
    setDays(k === "ring" ? null : k === "bubble" ? 6 : 30);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (kind === "vip") await adminApi.grantVip(user.id, level, days, reason);
      else await adminApi.grantItem(user.id, productId, days, reason);
      toast(kind === "vip" ? `${user.name} is now VIP ${level}` : `Gave ${user.name} ${product?.name ?? "the item"}`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-2xl bg-ink px-3.5 py-3 ring-1 ring-line">
        <Avatar name={user.name} color={user.color} photoUrl={user.photoUrl} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="text-xs text-muted">
            ID {user.uid} · {user.vip ? `VIP ${user.vip} now` : "Not VIP"}
          </p>
        </div>
      </div>

      {kind === "vip" ? (
        <div>
          <span className="label">VIP level</span>
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={level === l}
                onClick={() => setLevel(l)}
                className={`flex h-10 items-center justify-center gap-1 rounded-xl text-sm font-bold ring-1 transition ${level === l ? "bg-gradient-to-b from-[#f6d899] to-[#c9954a] text-[#2a1a0c] ring-gold" : "text-gold ring-line-strong hover:bg-gold/10"}`}
              >
                <Crown className="h-3.5 w-3.5" aria-hidden /> {l}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">This replaces any VIP given by staff before. VIP they earned by spending stays.</p>
        </div>
      ) : (
        <>
          <div>
            <span className="label">Kind</span>
            <Chips label="Kind" value={itemKind} onChange={pickKind} options={PRODUCT_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
          </div>
          <div>
            <span className="label">Item</span>
            {options.length ? (
              <div className="grid grid-cols-2 gap-2">
                {options.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={productId === p.id}
                    onClick={() => setProductId(p.id)}
                    className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left ring-1 transition [&_img]:h-8 [&_img]:w-8 ${productId === p.id ? "bg-cream/[0.08] ring-gold" : "ring-line-strong hover:bg-cream/[0.04]"}`}
                  >
                    <ProductPreview p={p} size={32} />
                    <span className="min-w-0 truncate text-sm font-semibold">{p.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{products.loading ? "Loading…" : `No ${KIND_LABEL[itemKind].toLowerCase()} yet. Add some on the Shop items page.`}</p>
            )}
          </div>
        </>
      )}

      <div>
        <span className="label">How long</span>
        <Chips label="How long" options={kind === "vip" ? VIP_DAYS : ITEM_DAYS} value={days} onChange={setDays} />
      </div>

      <div>
        <label className="label" htmlFor="gr-reason">
          Reason <span className="normal-case tracking-normal text-muted/70">(for the activity log)</span>
        </label>
        <input id="gr-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are they getting this?" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className="h-7 rounded-full px-2.5 text-xs font-medium text-muted ring-1 ring-line-strong hover:text-cream">
              {r}
            </button>
          ))}
        </div>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button variant="gold" busy={busy} onClick={submit} disabled={!reason.trim() || (kind === "item" && !productId)} className="flex-[1.4]">
          {kind === "vip" ? `Give VIP ${level}` : product ? `Give ${product.name}` : "Give item"}
        </Button>
      </div>
    </div>
  );
}

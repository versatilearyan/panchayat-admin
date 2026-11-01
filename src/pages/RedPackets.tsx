/**
 * Red packet products, live from the backend (/api/v1/admin/red-packets). Kept apart from coin
 * packs: different product, fields and endpoints. Images upload separately to
 * POST /api/v1/admin/red-packets/{id}/image (multipart, field "file").
 */
import { useMemo, useState, type InputHTMLAttributes } from "react";
import { Coins, ImageUp, Pencil, Plus, Power, PowerOff } from "lucide-react";
import { ImageUploadForm } from "../components/ImageUploadForm";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { Button, Card, Empty, ErrorNote, fmtCoins, Loading, Modal, PageHeader } from "../components/ui";
import {
  ActiveBadge,
  ConfirmDialog,
  Field,
  fmtInr,
  ListProblem,
  NeedsBackend,
  Pager,
  ProductImage,
  rupees,
  SearchBox,
  updatedAgo,
  useList,
  useSearchPages,
  wholeNumber,
} from "../components/WalletParts";
import { redPacketService, type RedPacketInput, type RedPacketPatch, type RedPacketProduct } from "../services/redPacketService";

type Dialog = { kind: "form"; item: RedPacketProduct | null } | { kind: "image"; item: RedPacketProduct; justCreated?: boolean } | { kind: "deactivate"; item: RedPacketProduct } | null;

const byOrder = (a: RedPacketProduct, b: RedPacketProduct) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || Number(a.priceInRupees) - Number(b.priceInRupees);

export function RedPacketsPage() {
  if (!BACKEND_ENABLED)
    return (
      <>
        <PageHeader title="Red packet products" sub="The red packets people can buy and send in rooms." />
        <NeedsBackend what="red packet products" />
      </>
    );
  return <RedPacketsLive />;
}

function RedPacketsLive() {
  const { version } = useAdmin();
  const list = useList(() => redPacketService.list(), version);
  const [dialog, setDialog] = useState<Dialog>(null);
  const sorted = useMemo(() => [...(list.data ?? [])].sort(byOrder), [list.data]);
  const s = useSearchPages(sorted, (p) => `${p.name} ${p.coinValue}`);
  const close = () => setDialog(null);
  const add = () => setDialog({ kind: "form", item: null });

  return (
    <>
      <PageHeader
        title="Red packet products"
        sub="Live from the server. Add red packets, edit them, upload their images, or turn them off."
        right={
          <Button variant="primary" onClick={add}>
            <Plus className="h-4 w-4" /> Create product
          </Button>
        }
      />
      {list.error && list.error.kind !== "forbidden" ? <ListProblem error={list.error} onRetry={list.retry} /> : null}
      {list.error?.kind === "forbidden" ? (
        <ListProblem error={list.error} onRetry={list.retry} />
      ) : (
        <Card
          title={list.data ? `${list.data.length} product${list.data.length === 1 ? "" : "s"} · ${list.data.filter((p) => p.active).length} active` : "Red packet products"}
          action={list.data?.length ? <SearchBox value={s.q} onChange={s.setQ} label="Search red packets" /> : null}
        >
          {list.loading && !list.data ? (
            <Loading />
          ) : !list.data ? (
            <Empty>Couldn't load red packet products.</Empty>
          ) : !list.data.length ? (
            <Empty>
              No red packet products yet. Create the first one.
              <span className="mt-3 flex justify-center">
                <Button variant="primary" onClick={add}>
                  <Plus className="h-4 w-4" /> Create product
                </Button>
              </span>
            </Empty>
          ) : !s.shown.length ? (
            <Empty>No products match “{s.q}”.</Empty>
          ) : (
            <>
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-[11px] tracking-wide text-muted uppercase">
                    <tr className="border-b border-line">
                      <th className="px-4 py-2.5 font-bold">Product</th>
                      <th className="px-2 py-2.5 text-right font-bold">Coin value</th>
                      <th className="px-2 py-2.5 text-right font-bold">Price</th>
                      <th className="px-2 py-2.5 text-right font-bold">Order</th>
                      <th className="px-2 py-2.5 font-bold">Status</th>
                      <th className="px-2 py-2.5 font-bold">Updated</th>
                      <th className="px-4 py-2.5 text-right font-bold">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {s.shown.map((p) => (
                      <Row key={p.id} item={p} onEdit={() => setDialog({ kind: "form", item: p })} onImage={() => setDialog({ kind: "image", item: p })} onDeactivate={() => setDialog({ kind: "deactivate", item: p })} />
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={s.page} pages={s.pages} total={s.total} onPage={s.setPage} />
            </>
          )}
        </Card>
      )}

      <Modal open={dialog?.kind === "form"} onClose={close} title={dialog?.kind === "form" && dialog.item ? `Edit ${dialog.item.name}` : "Create a red packet product"} wide>
        {dialog?.kind === "form" ? (
          <ProductForm key={dialog.item ? String(dialog.item.id) : "new"} item={dialog.item} onClose={close} onCreated={(item) => setDialog({ kind: "image", item, justCreated: true })} />
        ) : null}
      </Modal>
      <Modal open={dialog?.kind === "image"} onClose={close} title={dialog?.kind === "image" ? (dialog.item.imageUrl ? `Replace image · ${dialog.item.name}` : `Add image · ${dialog.item.name}`) : ""}>
        {dialog?.kind === "image" ? (
          <ImageUploadForm
            key={String(dialog.item.id)}
            item={dialog.item}
            justCreated={dialog.justCreated}
            onClose={close}
            inputId="rp-image"
            upload={(file, onProgress) => redPacketService.uploadImage((dialog as { item: RedPacketProduct }).item.id, file, onProgress)}
          />
        ) : null}
      </Modal>
      {dialog?.kind === "deactivate" ? <DeactivateDialog item={dialog.item} onClose={close} /> : null}
    </>
  );
}

function Row({ item: p, onEdit, onImage, onDeactivate }: { item: RedPacketProduct; onEdit: () => void; onImage: () => void; onDeactivate: () => void }) {
  const { changed, toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  const activate = async () => {
    setBusy(true);
    try {
      await redPacketService.setActive(p.id, true);
      toast(`${p.name} is active again`);
      changed();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't turn it on", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <tr className={p.active ? "" : "bg-cream/[0.015]"}>
      <td className="px-4 py-3">
        <div className={`flex items-center gap-3 ${p.active ? "" : "opacity-60"}`}>
          <ProductImage url={p.imageUrl} name={p.name} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{p.name}</p>
            <p className="text-xs text-muted">ID {p.id}</p>
          </div>
        </div>
      </td>
      <td className="px-2 py-3 text-right font-semibold whitespace-nowrap text-gold tabular-nums">
        <Coins className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
        {fmtCoins(p.coinValue)}
      </td>
      <td className="px-2 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{fmtInr(p.priceInRupees)}</td>
      <td className="px-2 py-3 text-right text-muted tabular-nums">{p.sortOrder ?? "—"}</td>
      <td className="px-2 py-3">
        <ActiveBadge active={p.active} />
      </td>
      <td className="px-2 py-3 whitespace-nowrap text-xs text-muted">{updatedAgo(p.updatedAt)}</td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${p.name}`}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={onImage} aria-label={`${p.imageUrl ? "Replace" : "Upload"} image for ${p.name}`}>
            <ImageUp className="h-3.5 w-3.5" /> {p.imageUrl ? "Replace" : "Image"}
          </Button>
          {p.active ? (
            <Button size="sm" variant="danger" onClick={onDeactivate} aria-label={`Deactivate ${p.name}`}>
              <PowerOff className="h-3.5 w-3.5" /> Deactivate
            </Button>
          ) : (
            <Button size="sm" variant="ok" busy={busy} onClick={activate} aria-label={`Activate ${p.name}`}>
              {busy ? null : <Power className="h-3.5 w-3.5" />} Activate
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function DeactivateDialog({ item, onClose }: { item: RedPacketProduct; onClose: () => void }) {
  const { changed, toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await redPacketService.setActive(item.id, false);
      toast(`${item.name} deactivated`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't deactivate it");
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog open title={`Deactivate ${item.name}?`} confirmLabel="Deactivate" busy={busy} error={error} onConfirm={confirm} onClose={onClose}>
      <p>People won't be able to buy this red packet ({fmtCoins(item.coinValue)} coins for {fmtInr(item.priceInRupees)}) until you activate it again.</p>
    </ConfirmDialog>
  );
}

/* ---------------- create / edit ---------------- */

type FormState = { name: string; coinValue: string; priceInRupees: string; sortOrder: string };
type Errors = Partial<Record<keyof FormState, string>>;

const toForm = (p: RedPacketProduct | null): FormState => ({
  name: p?.name ?? "",
  coinValue: p ? String(p.coinValue) : "",
  priceInRupees: p ? String(p.priceInRupees) : "",
  sortOrder: String(p?.sortOrder ?? 0),
});

function validate(f: FormState): { body: RedPacketInput | null; errors: Errors } {
  const errors: Errors = {};
  const name = f.name.trim();
  if (!name) errors.name = "Give the product a name.";
  else if (name.length > 100) errors.name = "Keep the name under 100 characters.";
  const coinValue = wholeNumber(f.coinValue, { min: 1, name: "the coin value" });
  if (typeof coinValue !== "number") errors.coinValue = coinValue ?? "Enter the coin value.";
  const price = rupees(f.priceInRupees, { name: "the price" });
  if (typeof price !== "number") errors.priceInRupees = price;
  const sortOrder = wholeNumber(f.sortOrder, { min: 0, required: false, name: "sort order" });
  if (typeof sortOrder === "string") errors.sortOrder = sortOrder;
  if (Object.keys(errors).length) return { body: null, errors };
  return { body: { name, coinValue: coinValue as number, priceInRupees: price as number, sortOrder: (sortOrder as number | null) ?? 0 }, errors };
}

function patchFor(item: RedPacketProduct, body: RedPacketInput): RedPacketPatch {
  const patch: RedPacketPatch = {};
  if (body.name !== item.name) patch.name = body.name;
  if (body.coinValue !== Number(item.coinValue)) patch.coinValue = body.coinValue;
  if (body.priceInRupees !== Number(item.priceInRupees)) patch.priceInRupees = body.priceInRupees;
  if (body.sortOrder !== Number(item.sortOrder ?? 0)) patch.sortOrder = body.sortOrder;
  return patch;
}

function ProductForm({ item, onClose, onCreated }: { item: RedPacketProduct | null; onClose: () => void; onCreated: (item: RedPacketProduct) => void }) {
  const { changed, toast } = useAdmin();
  const [f, setF] = useState<FormState>(() => toForm(item));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof FormState, v: string) => setF((x) => ({ ...x, [k]: v }));
  const { body, errors } = validate(f);
  const patch = item && body ? patchFor(item, body) : null;
  const unchanged = Boolean(patch && !Object.keys(patch).length);
  const show = (k: keyof FormState) => (touched ? errors[k] : null);

  const save = async () => {
    setTouched(true);
    if (busy || !body || unchanged) return;
    setBusy(true);
    setError(null);
    try {
      if (item) {
        await redPacketService.update(item.id, patch!);
        toast(`${body.name} saved`);
        changed();
        onClose();
      } else {
        const created = await redPacketService.create(body);
        toast(`${body.name} created`);
        changed();
        if (created && created.id !== undefined) onCreated(created);
        else onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  };

  const input = (k: keyof FormState, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input id={`rp-${k}`} className="field" value={f[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={Boolean(show(k))} aria-describedby={show(k) ? `rp-${k}-err` : undefined} {...props} />
  );

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Field id="rp-name" label="Product name" error={show("name")}>
        {input("name", { maxLength: 100, autoFocus: !item, placeholder: "Lucky red packet" })}
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="rp-coinValue" label="Coin value" hint="Coins inside the packet" error={show("coinValue")}>
          {input("coinValue", { inputMode: "numeric", placeholder: "1000" })}
        </Field>
        <Field id="rp-priceInRupees" label="Price (₹)" error={show("priceInRupees")}>
          {input("priceInRupees", { inputMode: "decimal", placeholder: "99" })}
        </Field>
        <Field id="rp-sortOrder" label="Sort order" hint="Lower shows first" error={show("sortOrder")}>
          {input("sortOrder", { inputMode: "numeric" })}
        </Field>
      </div>
      <div className="flex items-center gap-3 rounded-xl bg-cream/[0.04] px-3 py-2.5 ring-1 ring-line">
        <ProductImage url={item?.imageUrl} name={f.name || "?"} size={40} />
        <p className="text-xs text-muted">
          {item ? (item.imageUrl ? "Current image. Use Replace in the list to change it." : "No image yet. Use Image in the list to add one.") : "You can add the image right after creating the product."}
        </p>
      </div>
      {item ? <p className="text-xs text-muted">ID {item.id} · updated {updatedAgo(item.updatedAt)}</p> : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onClose} className="flex-1" disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={busy} disabled={unchanged || (touched && !body)} className="flex-[1.4]">
          {item ? (unchanged ? "No changes" : "Save changes") : "Create product"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Spend rewards (/api/v1/admin/manage/rewards): what people win for spending coins.
 *
 * Random: every N coins a user spends, they win ONE item at random. Priority sets
 * the odds: 1 is the most likely, 4 the least (weights 4, 3, 2, 1).
 * Guaranteed: after N coins they get EVERY item that can drop, once or every N coins.
 *
 * Items are gifts (into the user's bag) or effects: chat bubble, entry effect,
 * profile effect, or any new type you add. Each has a file (PNG, JPG, JPEG, SVGA,
 * MP4 or MP3), an optional sound, a validity, and a "Can drop" switch.
 */
import { useEffect, useMemo, useState } from "react";
import { Dice5, Gift as GiftIcon, Pencil, Plus, ShieldCheck, Trash2, Trophy } from "lucide-react";
import { useAdmin } from "../context";
import { Badge, Button, Card, Chips, Empty, fmtCoins, Loading, Modal, NumberField, PageHeader, Toggle } from "../components/ui";
import { ConfirmDialog, Field, ListProblem, Pager, useList } from "../components/WalletParts";
import { MEDIA_EXTS, rewardService, typeLabel, type ItemInput, type Paged, type RewardGrant, type RewardItem, type RewardKind, type RewardRule } from "../services/rewardService";
import { giftCatalogService, type ServerGift } from "../services/giftCatalogService";
import { MediaPreview, UploadSlot } from "../components/MediaParts";

type Tab = "RANDOM" | "GUARANTEED" | "winners";
type Dialog =
  | { kind: "rule"; rule: RewardRule | null; ruleKind: RewardKind }
  | { kind: "item"; ruleId: number; itemId: number | null }
  | { kind: "deleteRule"; rule: RewardRule }
  | { kind: "deleteItem"; item: RewardItem }
  | null;

const PRIORITY_HINT: Record<number, string> = { 1: "Most likely", 2: "Likely", 3: "Rare", 4: "Rarest" };

export function SpendRewardsPage() {
  const { version } = useAdmin();
  const list = useList(() => rewardService.list(), version);
  const gifts = useList(() => giftCatalogService.list(), version);
  const [tab, setTab] = useState<Tab>("RANDOM");
  const [dialog, setDialog] = useState<Dialog>(null);
  /** Each answer carries the whole rule: show it at once, before the list reloads. */
  const [local, setLocal] = useState<Record<number, RewardRule>>({});
  const rules = useMemo(() => (list.data ?? []).map((r) => local[r.id] ?? r), [list.data, local]);
  useEffect(() => setLocal({}), [list.data]);
  const put = (r: RewardRule) => setLocal((m) => ({ ...m, [r.id]: r }));
  const shown = rules.filter((r) => r.kind === tab);
  const close = () => setDialog(null);
  const dialogRule = dialog?.kind === "item" ? rules.find((r) => r.id === dialog.ruleId) : undefined;

  return (
    <>
      <PageHeader
        title="Spend rewards"
        sub="Give people effects and gifts for spending coins: a random prize every few coins, or a guaranteed one after a target."
        right={
          tab !== "winners" ? (
            <Button variant="primary" onClick={() => setDialog({ kind: "rule", rule: null, ruleKind: tab })}>
              <Plus className="h-4 w-4" /> {tab === "RANDOM" ? "Add random reward" : "Add guaranteed reward"}
            </Button>
          ) : null
        }
      />
      <div className="mb-4">
        <Chips
          label="Reward type"
          value={tab}
          onChange={setTab}
          options={[
            { value: "RANDOM", label: `Random (${rules.filter((r) => r.kind === "RANDOM").length})` },
            { value: "GUARANTEED", label: `Guaranteed (${rules.filter((r) => r.kind === "GUARANTEED").length})` },
            { value: "winners", label: "Winners" },
          ]}
        />
      </div>
      {list.error ? <ListProblem error={list.error} onRetry={list.retry} /> : null}

      {tab === "winners" ? (
        <Winners />
      ) : (
        <>
          <Explainer kind={tab} />
          {list.loading && !list.data ? (
            <Card>
              <Loading />
            </Card>
          ) : !shown.length ? (
            <Card>
              <Empty>
                No {tab === "RANDOM" ? "random" : "guaranteed"} rewards yet.
                <span className="mt-3 flex justify-center">
                  <Button variant="primary" onClick={() => setDialog({ kind: "rule", rule: null, ruleKind: tab })}>
                    <Plus className="h-4 w-4" /> Add one
                  </Button>
                </span>
              </Empty>
            </Card>
          ) : (
            <div className="space-y-4">
              {shown.map((r) => (
                <RuleCard key={r.id} rule={r} gifts={gifts.data ?? []} onChange={put} open={setDialog} />
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={dialog?.kind === "rule"} onClose={close} title={dialog?.kind === "rule" ? (dialog.rule ? `Edit ${dialog.rule.name}` : dialog.ruleKind === "RANDOM" ? "New random reward" : "New guaranteed reward") : ""}>
        {dialog?.kind === "rule" ? (
          <RuleForm
            rule={dialog.rule}
            kind={dialog.ruleKind}
            onSaved={(r) => {
              put(r);
              // A new reward: go straight to adding its first item
              setDialog(dialog.rule ? null : { kind: "item", ruleId: r.id, itemId: null });
            }}
          />
        ) : null}
      </Modal>
      <Modal open={dialog?.kind === "item" && Boolean(dialogRule)} onClose={close} title={dialog?.kind === "item" ? (dialog.itemId ? "Edit item" : `Add an item · ${dialogRule?.name ?? ""}`) : ""} wide>
        {dialog?.kind === "item" && dialogRule ? (
          <ItemForm
            key={`${dialog.ruleId}-${dialog.itemId ?? "new"}`}
            rule={dialogRule}
            item={dialog.itemId ? (dialogRule.items.find((i) => i.id === dialog.itemId) ?? null) : null}
            gifts={gifts.data ?? []}
            onSaved={(r, itemId) => {
              put(r);
              setDialog({ kind: "item", ruleId: r.id, itemId });
            }}
            onClose={close}
          />
        ) : null}
      </Modal>
      {dialog?.kind === "deleteRule" ? <DeleteRule rule={dialog.rule} onClose={close} /> : null}
      {dialog?.kind === "deleteItem" ? <DeleteItem item={dialog.item} onDone={put} onClose={close} /> : null}
    </>
  );
}

function Explainer({ kind }: { kind: RewardKind }) {
  return (
    <div className="mb-4 flex gap-3 rounded-2xl border border-line bg-surface/50 px-4 py-3 text-[13px] leading-relaxed text-muted">
      {kind === "RANDOM" ? <Dice5 className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden /> : <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />}
      {kind === "RANDOM" ? (
        <p>
          Every time a user spends the set number of coins, they win <b className="text-cream">one</b> item at random. <b className="text-cream">Priority</b> sets the odds: 1 = most likely, 4 = rarest. Turn
          off <b className="text-cream">Can drop</b> to keep an item out of the draw.
        </p>
      ) : (
        <p>
          When a user has spent the set number of coins, they get <b className="text-cream">every</b> item that can drop. Choose whether it's given once per user or again every time they spend that much.
        </p>
      )}
    </div>
  );
}

function RuleCard({ rule: r, gifts, onChange, open }: { rule: RewardRule; gifts: ServerGift[]; onChange: (r: RewardRule) => void; open: (d: Dialog) => void }) {
  const { toast, changed, can } = useAdmin();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<RewardRule>, msg?: string) => {
    setBusy(true);
    try {
      onChange(await fn());
      changed();
      if (msg) toast(msg);
    } catch (e) {
      toast(e instanceof Error ? e.message : "That didn't work.", "error");
    } finally {
      setBusy(false);
    }
  };
  const giftName = (id: string | null) => gifts.find((g) => g.id === id)?.name ?? id ?? "";
  const canDrop = r.items.filter((i) => i.enabled).length;

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          {r.name}
          <Badge tone={r.active ? "ok" : "muted"}>{r.active ? "Live" : "Off"}</Badge>
        </span>
      }
      action={
        <span className="flex items-center gap-1.5">
          <Toggle checked={r.active} disabled={busy} hideLabel label={`${r.name} is live`} onChange={(v) => run(() => rewardService.updateRule(r.id, { active: v }), v ? "Reward is live" : "Reward turned off")} />
          <Button size="sm" onClick={() => open({ kind: "rule", rule: r, ruleKind: r.kind })} aria-label={`Edit ${r.name}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {can("catalog.delete") ? (
            <Button size="sm" variant="ghost" onClick={() => open({ kind: "deleteRule", rule: r })} aria-label={`Delete ${r.name}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line px-4 py-3 text-sm">
        <span>
          {r.kind === "RANDOM" ? "Every " : "After "}
          <b className="text-gold">{fmtCoins(r.coinThreshold)} coins</b> spent
          {r.kind === "GUARANTEED" ? (r.repeatable ? " · every time" : " · once per user") : r.repeatable ? "" : " · once per user"}
        </span>
        <span className="text-muted">
          <Trophy className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          Won {fmtCoins(r.timesWon)} times by {fmtCoins(r.winners)} people
        </span>
        <span className="text-muted">{canDrop} of {r.items.length} items can drop</span>
      </div>
      {!r.items.length ? (
        <Empty>No items yet. Add what people can win.</Empty>
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-[11px] tracking-wide text-muted uppercase">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-bold">Item</th>
                {r.kind === "RANDOM" ? <th className="px-2 py-2 font-bold">Priority</th> : null}
                <th className="px-2 py-2 text-right font-bold">Chance</th>
                <th className="px-2 py-2 font-bold">Gives</th>
                <th className="px-2 py-2 font-bold">Can drop</th>
                <th className="px-4 py-2 text-right font-bold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.items.map((i) => (
                <tr key={i.id} className={i.enabled ? "" : "opacity-55"}>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-3">
                      <MediaPreview media={{ url: i.mediaUrl, format: i.mediaFormat }} size={44} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{i.name}</span>
                        <span className="block text-xs text-muted">
                          {typeLabel(i.itemType)}
                          {i.itemType === "GIFT" ? ` · ${giftName(i.giftId)}` : ""}
                          {i.mediaFormat ? ` · ${i.mediaFormat}` : " · no file"}
                          {i.soundUrl ? " + MP3" : ""}
                        </span>
                      </span>
                    </span>
                  </td>
                  {r.kind === "RANDOM" ? (
                    <td className="px-2 py-2.5">
                      <select
                        className="field h-9 w-auto py-1"
                        value={i.priority}
                        disabled={busy}
                        aria-label={`Priority of ${i.name}`}
                        onChange={(e) => run(() => rewardService.updateItem(i.id, { priority: Number(e.target.value) }))}
                      >
                        {[1, 2, 3, 4].map((p) => (
                          <option key={p} value={p}>
                            {p} · {PRIORITY_HINT[p]}
                          </option>
                        ))}
                      </select>
                    </td>
                  ) : null}
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums">{i.enabled ? `${i.chancePercent}%` : "—"}</td>
                  <td className="px-2 py-2.5 text-muted">
                    ×{i.quantity} · {i.durationDays ? `${i.durationDays} days` : "forever"}
                  </td>
                  <td className="px-2 py-2.5">
                    <Toggle checked={i.enabled} disabled={busy} hideLabel label={`${i.name} can drop`} onChange={(v) => run(() => rewardService.updateItem(i.id, { enabled: v }))} />
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <Button size="sm" onClick={() => open({ kind: "item", ruleId: r.id, itemId: i.id })} aria-label={`Edit ${i.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>{" "}
                    <Button size="sm" variant="ghost" onClick={() => open({ kind: "deleteItem", item: i })} aria-label={`Remove ${i.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t border-line px-4 py-3">
        <Button size="sm" onClick={() => open({ kind: "item", ruleId: r.id, itemId: null })}>
          <Plus className="h-3.5 w-3.5" /> Add item
        </Button>
      </div>
    </Card>
  );
}

function RuleForm({ rule, kind, onSaved }: { rule: RewardRule | null; kind: RewardKind; onSaved: (r: RewardRule) => void }) {
  const { toast, changed } = useAdmin();
  const [name, setName] = useState(rule?.name ?? "");
  const [coins, setCoins] = useState(rule?.coinThreshold ?? (kind === "RANDOM" ? 1000 : 50000));
  const [repeat, setRepeat] = useState(rule?.repeatable ?? kind === "RANDOM");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setError(null);
    if (!name.trim()) return setError("Give the reward a name.");
    if (!(coins >= 1)) return setError("Set how many coins must be spent.");
    setBusy(true);
    try {
      const body = { name: name.trim(), coinThreshold: coins, repeatable: repeat };
      // New rewards start off: they go live once they have items
      const r = rule ? await rewardService.updateRule(rule.id, body) : await rewardService.createRule({ ...body, kind, active: false });
      toast(rule ? "Reward saved" : "Reward added. Now add its items.");
      changed();
      onSaved(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save it.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <Field id="rule-name" label="Name">
        <input id="rule-name" className="field" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={kind === "RANDOM" ? "e.g. Lucky spender" : "e.g. Big spender 50K"} />
      </Field>
      <Field id="rule-coins" label={kind === "RANDOM" ? "Win a random item every … coins spent" : "Give the items after … coins spent"}>
        <NumberField id="rule-coins" value={coins} onChange={setCoins} suffix="coins" />
      </Field>
      <Toggle
        checked={repeat}
        onChange={setRepeat}
        label={kind === "RANDOM" ? "Keep giving" : "Give again every time"}
        hint={repeat ? `Again every ${fmtCoins(coins || 0)} coins spent.` : "Only once per user."}
      />
      {error ? (
        <p role="alert" className="text-sm text-[#ff9095]">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button variant="primary" busy={busy} onClick={save}>
          {rule ? "Save" : "Add reward"}
        </Button>
      </div>
    </div>
  );
}

const NEW_TYPE = "__new__";

function ItemForm({ rule, item, gifts, onSaved, onClose }: { rule: RewardRule; item: RewardItem | null; gifts: ServerGift[]; onSaved: (r: RewardRule, itemId: number) => void; onClose: () => void }) {
  const { toast, changed, version } = useAdmin();
  const typesList = useList(() => rewardService.types(), version);
  const [type, setType] = useState(item?.itemType ?? "CHAT_BUBBLE");
  const [newType, setNewType] = useState("");
  const [name, setName] = useState(item?.name ?? "");
  const [giftId, setGiftId] = useState(item?.giftId ?? "");
  const [qty, setQty] = useState(item?.quantity ?? 1);
  const [priority, setPriority] = useState<number>(item?.priority ?? 1);
  const [forever, setForever] = useState(item ? item.durationDays === null : false);
  const [days, setDays] = useState(item?.durationDays ?? 7);
  const [enabled, setEnabled] = useState(item?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const types = typesList.data ?? ["GIFT", "CHAT_BUBBLE", "ENTRY_EFFECT", "PROFILE_EFFECT"];
  const finalType = type === NEW_TYPE ? newType.trim().toUpperCase().replace(/[\s-]+/g, "_") : type;

  const save = async () => {
    setError(null);
    if (!finalType) return setError("Name the new type, e.g. Frame or Badge.");
    if (finalType === "GIFT" && !giftId) return setError("Choose which gift it gives.");
    const label = name.trim() || (finalType === "GIFT" ? (gifts.find((g) => g.id === giftId)?.name ?? "") : "");
    if (!label) return setError("Give the item a name.");
    setBusy(true);
    const body: ItemInput = {
      name: label,
      itemType: finalType,
      giftId: finalType === "GIFT" ? giftId : null,
      quantity: qty,
      priority,
      enabled,
      ...(forever ? { forever: true } : { durationDays: days }),
    };
    try {
      const r = item ? await rewardService.updateItem(item.id, body) : await rewardService.addItem(rule.id, body);
      const id = item?.id ?? Math.max(...r.items.map((i) => i.id));
      toast(item ? "Item saved" : "Item added. Upload its file below.");
      changed();
      onSaved(r, id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save it.");
    } finally {
      setBusy(false);
    }
  };

  const fileDone = (r: RewardRule, msg: string) => {
    changed();
    toast(msg);
    onSaved(r, item!.id);
  };
  const err = (m: string) => toast(m, "error");

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="item-type" label="Type">
          <select id="item-type" className="field" value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
            <option value={NEW_TYPE}>＋ Add a new type…</option>
          </select>
        </Field>
        {type === NEW_TYPE ? (
          <Field id="item-newtype" label="New type name" hint="e.g. Frame, Badge, Room theme">
            <input id="item-newtype" className="field" value={newType} maxLength={30} onChange={(e) => setNewType(e.target.value)} />
          </Field>
        ) : type === "GIFT" ? (
          <Field id="item-gift" label="Gift">
            <select id="item-gift" className="field" value={giftId} onChange={(e) => setGiftId(e.target.value)}>
              <option value="">Choose a gift…</option>
              {gifts.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · {fmtCoins(g.price)} coins
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div />
        )}
      </div>
      <Field id="item-name" label="Name" hint={type === "GIFT" ? "Leave empty to use the gift's name" : undefined}>
        <input id="item-name" className="field" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Golden chat bubble" />
      </Field>
      {rule.kind === "RANDOM" ? (
        <div>
          <span className="label">Priority</span>
          <Chips label="Priority" value={priority} onChange={setPriority} options={[1, 2, 3, 4].map((p) => ({ value: p, label: `${p} · ${PRIORITY_HINT[p]}` }))} />
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="item-qty" label="Quantity">
          <NumberField id="item-qty" value={qty} onChange={setQty} />
        </Field>
        <Field id="item-days" label="Valid for">
          {forever ? (
            <p className="field text-muted">Forever</p>
          ) : (
            <NumberField id="item-days" value={days} onChange={setDays} suffix="days" />
          )}
        </Field>
      </div>
      <div className="flex flex-wrap gap-6">
        <Toggle checked={forever} onChange={setForever} label="Never expires" />
        <Toggle checked={enabled} onChange={setEnabled} label="Can drop" hint={rule.kind === "RANDOM" ? "Off = never chosen in the draw" : "Off = not given"} />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[#ff9095]">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button variant="primary" busy={busy} onClick={save}>
          {item ? "Save item" : "Add item"}
        </Button>
      </div>

      {item ? (
        <div className="space-y-2.5 border-t border-line pt-4">
          <p className="label">Files</p>
          <UploadSlot
            label="Animation or picture"
            hint="PNG, JPG, JPEG, SVGA, MP4 or MP3"
            exts={MEDIA_EXTS}
            current={{ url: item.mediaUrl, format: item.mediaFormat }}
            upload={(f, p) => rewardService.upload(item.id, "media", f, p)}
            onDone={(r) => fileDone(r, "File uploaded")}
            onRemove={async () => fileDone(await rewardService.removeFile(item.id, "media"), "File removed")}
            onError={err}
          />
          <UploadSlot
            label="Sound (optional)"
            hint="MP3 · plays with the animation"
            exts={["mp3"]}
            current={{ url: item.soundUrl, format: item.soundUrl ? "MP3" : null }}
            upload={(f, p) => rewardService.upload(item.id, "sound", f, p)}
            onDone={(r) => fileDone(r, "Sound uploaded")}
            onRemove={async () => fileDone(await rewardService.removeFile(item.id, "sound"), "Sound removed")}
            onError={err}
          />
          {item.mediaFormat === "MP3" && item.mediaUrl ? <audio src={item.mediaUrl} controls className="w-full" /> : null}
          {item.soundUrl ? <audio src={item.soundUrl} controls className="w-full" /> : null}
          <div className="flex justify-end pt-1">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DeleteRule({ rule, onClose }: { rule: RewardRule; onClose: () => void }) {
  const { toast, changed } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    try {
      await rewardService.deleteRule(rule.id);
      toast(`${rule.name} deleted`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete it.");
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog open title={`Delete ${rule.name}?`} confirmLabel="Delete reward" busy={busy} error={error} onConfirm={go} onClose={onClose}>
      The reward, its items and everyone's progress towards it are removed. What people already won stays theirs. To pause it, turn it off instead.
    </ConfirmDialog>
  );
}

function DeleteItem({ item, onDone, onClose }: { item: RewardItem; onDone: (r: RewardRule) => void; onClose: () => void }) {
  const { toast, changed } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    try {
      onDone(await rewardService.deleteItem(item.id));
      toast(`${item.name} removed`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove it.");
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog open title={`Remove ${item.name}?`} confirmLabel="Remove item" busy={busy} error={error} onConfirm={go} onClose={onClose}>
      It can't be won any more, and its files are deleted. People who already won it keep it. If it was the last item that can drop, the reward is turned off.
    </ConfirmDialog>
  );
}

function Winners() {
  const { version } = useAdmin();
  const [page, setPage] = useState(0);
  const [user, setUser] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Paged<RewardGrant> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    rewardService
      .grants(page, query || undefined)
      .then((d) => live && (setData(d), setError(null)))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't load winners."));
    return () => {
      live = false;
    };
  }, [page, query, version]);
  const pages = data ? Math.ceil(data.totalElements / data.size) : 0;
  return (
    <Card
      title="Who won what"
      action={
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setQuery(/^\d+$/.test(user.trim()) ? user.trim() : "");
          }}
        >
          <input className="field h-9 w-36 py-1" inputMode="numeric" placeholder="User ID" value={user} onChange={(e) => setUser(e.target.value)} aria-label="Filter by user ID" />
          <Button size="sm" type="submit">
            Filter
          </Button>
        </form>
      }
    >
      {error ? <p className="px-4 py-3 text-sm text-[#ff9095]">{error}</p> : null}
      {!data ? (
        <Loading />
      ) : !data.content.length ? (
        <Empty>No wins yet.</Empty>
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-[11px] tracking-wide text-muted uppercase">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-bold">When</th>
                <th className="px-2 py-2 font-bold">User</th>
                <th className="px-2 py-2 font-bold">Won</th>
                <th className="px-2 py-2 font-bold">From</th>
                <th className="px-4 py-2 font-bold">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.content.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-2 whitespace-nowrap text-muted">{new Date(g.grantedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="px-2 py-2 font-mono">{g.userId}</td>
                  <td className="px-2 py-2">
                    <span className="flex items-center gap-2">
                      <MediaPreview media={{ url: g.mediaUrl, format: g.mediaFormat }} size={32} />
                      <span>
                        {g.itemName} <span className="text-muted">×{g.quantity}</span>
                        <span className="block text-xs text-muted">{typeLabel(g.itemType)}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <Badge tone={g.ruleKind === "RANDOM" ? "gold" : "ok"}>
                      {g.ruleKind === "RANDOM" ? <Dice5 className="h-3 w-3" /> : <GiftIcon className="h-3 w-3" />} {g.ruleName}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-muted">{g.expiresAt ? new Date(g.expiresAt).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data ? <Pager page={page} pages={pages} total={data.totalElements} onPage={setPage} /> : null}
    </Card>
  );
}

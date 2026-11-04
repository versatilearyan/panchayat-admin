/**
 * Sarpanch, live from the backend (/api/v1/admin/sarpanch/...):
 * the official account's profile and app ID, sending to people or to everyone
 * (broadcasts, with cancel), and the automatic message templates.
 * Only the server sends as Sarpanch; this page only asks it to.
 */
import { useEffect, useState } from "react";
import { BadgeCheck, ImagePlus, Megaphone, Send, Sparkles, X } from "lucide-react";
import { apiRequest, apiUpload } from "../lib/api";
import { useAdmin } from "../context";
import { Badge, Button, Card, Chips, Empty, ErrorNote, Loading, PageHeader, timeAgo, useLoad } from "../components/ui";

type Profile = { userId: string; name: string; bio?: string; avatarUrl?: string; displayId?: number; updatedAt?: string };
type Broadcast = {
  id: string;
  title?: string;
  body: string;
  imageUrl?: string;
  actionLabel?: string;
  actionUrl?: string;
  category: string;
  audience: Record<string, unknown>;
  status: string;
  createdBy?: string;
  createdAt: string;
  sentCount?: number;
  finishedAt?: string;
};
type Template = { key: string; title?: string; body: string; actionLabel?: string; actionUrl?: string; category: string; enabled?: boolean; updatedAt?: string };

const BASE = "/api/v1/admin/sarpanch";
const CATEGORIES = ["ANNOUNCEMENT", "REWARD", "SAFETY", "PAYMENT", "VIP", "RED_PACKET", "CP", "OTHER"];
const ACTIONS = [
  { value: "", label: "No button" },
  { value: "/wallet", label: "Wallet" },
  { value: "/shop", label: "Shop" },
  { value: "/bag", label: "Bag" },
  { value: "/vip", label: "VIP" },
  { value: "/rooms", label: "Rooms" },
  { value: "/discover", label: "Discover" },
  { value: "/tasks", label: "Daily tasks" },
  { value: "/moments", label: "Moments" },
];
const msg = (e: unknown) => (e instanceof Error ? e.message : "That didn't work");

export function SarpanchLive() {
  const { version } = useAdmin();
  const profile = useLoad(() => apiRequest<Profile>(`${BASE}/profile`), [version]);
  return (
    <>
      <PageHeader title="Sarpanch" sub="The official Panchayat account. Messages sent here arrive in everyone's pinned Sarpanch chat, and announcements also show on Discover." />
      {profile.error ? <ErrorNote>{profile.error}</ErrorNote> : null}
      {profile.data ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(340px,1fr)_minmax(0,1.3fr)]">
          <div className="flex flex-col gap-5">
            <ProfileCard key={profile.data.updatedAt ?? "p"} p={profile.data} />
            <Templates />
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <Compose />
            <Broadcasts />
          </div>
        </div>
      ) : (
        <Loading />
      )}
    </>
  );
}

function ProfileCard({ p }: { p: Profile }) {
  const { changed, toast } = useAdmin();
  const [name, setName] = useState(p.name ?? "");
  const [bio, setBio] = useState(p.bio ?? "");
  const [displayId, setDisplayId] = useState(p.displayId ? String(p.displayId) : "");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = name !== (p.name ?? "") || bio !== (p.bio ?? "") || displayId !== (p.displayId ? String(p.displayId) : "");

  const save = async () => {
    if (displayId && !/^\d{4,12}$/.test(displayId)) return setError("The ID must be 4 to 12 digits.");
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`${BASE}/profile`, { method: "PUT", body: { name, bio, displayId: displayId ? Number(displayId) : null } });
      toast("Sarpanch profile saved");
      changed();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };
  const photo = async (f?: File) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setError("Pictures can be up to 5 MB.");
    const form = new FormData();
    form.append("file", f);
    setPhotoBusy(true);
    setError(null);
    try {
      await apiUpload(`${BASE}/profile/photo`, form).promise;
      toast("Photo updated");
      changed();
    } catch (e) {
      setError(msg(e));
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <Card title="Profile in the app">
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-[#3a1d5c] via-[#251733] to-ink px-4 py-4 ring-1 ring-gold/25">
          <label className="relative shrink-0 cursor-pointer" title="Change photo">
            <span className="block rounded-full bg-gradient-to-br from-[#fff1c9] via-[#e7bc72] to-[#9a6a24] p-[3px] shadow-[0_0_18px_rgba(231,188,114,0.35)]">
              <span className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-full bg-ink font-display text-2xl font-bold">
                {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" /> : (name || "S").slice(0, 1)}
              </span>
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-ink">
              <BadgeCheck className="h-6 w-6 fill-[#3b82f6] text-white" aria-label="Official" />
            </span>
            <input type="file" accept="image/png,image/jpeg" className="hidden" disabled={photoBusy} onChange={(e) => void photo(e.target.files?.[0])} />
          </label>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-bold">{name || "Sarpanch"}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-ink">OFFICIAL</span>
              <span className="rounded-full bg-[#7b5cff]/30 px-2 py-0.5 text-[10px] font-bold">Panchayat Team</span>
            </div>
            <p className="mt-1 font-mono text-xs text-muted">ID {displayId || "—"}</p>
          </div>
        </div>
        <p className="text-xs text-muted">{photoBusy ? "Uploading photo…" : "Click the photo to change it (PNG or JPG, up to 5 MB)."}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sp-name">
              Name
            </label>
            <input id="sp-name" className="field" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="sp-id">
              App ID (shown on the profile)
            </label>
            <input id="sp-id" className="field font-mono" inputMode="numeric" value={displayId} onChange={(e) => setDisplayId(e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="10000001" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="sp-bio">
            Bio
          </label>
          <textarea id="sp-bio" rows={3} maxLength={300} className="field resize-none" value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">{p.updatedAt ? `Updated ${timeAgo(Date.parse(p.updatedAt))}` : ""}</p>
          <Button variant="primary" busy={busy} disabled={!dirty} onClick={save}>
            Save profile
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Compose() {
  const { changed, toast } = useAdmin();
  const [to, setTo] = useState<"all" | "filter" | "users">("all");
  const [ids, setIds] = useState("");
  const [vipOnly, setVipOnly] = useState(false);
  const [activeDays, setActiveDays] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("ANNOUNCEMENT");
  const [actionUrl, setActionUrl] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [image, setImage] = useState<{ imageUrl: string; previewUrl: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (f?: File) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setError("Pictures can be up to 5 MB.");
    const form = new FormData();
    form.append("file", f);
    setUploading(true);
    setError(null);
    try {
      setImage(await apiUpload<{ imageUrl: string; previewUrl: string }>(`${BASE}/images`, form).promise);
    } catch (e) {
      setError(msg(e));
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    const userIds = ids
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isSafeInteger(n) && n > 0);
    if (to === "users" && !userIds.length) return setError("Enter at least one user ID.");
    if (to !== "users" && !window.confirm(to === "all" ? "Send this to everyone on Panchayat?" : "Send this to everyone who matches the filter?")) return;
    const message = { title: title.trim() || null, body: body.trim(), category, imageUrl: image?.imageUrl ?? null, actionUrl: actionUrl || null, actionLabel: actionUrl ? actionLabel.trim() || ACTIONS.find((a) => a.value === actionUrl)?.label : null };
    setBusy(true);
    setError(null);
    try {
      if (to === "users") {
        const r = await apiRequest<{ sent: number; skipped: number }>(`${BASE}/messages`, { method: "POST", body: { ...message, userIds } });
        toast(`Sent to ${r.sent} ${r.sent === 1 ? "person" : "people"}${r.skipped ? ` · ${r.skipped} skipped` : ""}`);
      } else {
        const audience = to === "all" ? { type: "ALL" } : { type: "FILTER", vipOnly, ...(activeDays ? { activeInLastDays: Number(activeDays) } : {}) };
        await apiRequest(`${BASE}/broadcasts`, { method: "POST", body: { ...message, audience } });
        toast("Broadcast started. It goes out in batches.");
      }
      setTitle("");
      setBody("");
      setImage(null);
      changed();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-gold" aria-hidden /> Send as Sarpanch
        </span>
      }
    >
      <div className="space-y-4 p-4">
        <div>
          <span className="label">To</span>
          <Chips
            label="To"
            value={to}
            onChange={setTo}
            options={[
              { value: "all", label: "Everyone (also on Discover)" },
              { value: "filter", label: "Filtered" },
              { value: "users", label: "Specific users" },
            ]}
          />
          {to === "users" ? (
            <input className="field mt-2 font-mono" value={ids} onChange={(e) => setIds(e.target.value)} placeholder="User IDs, e.g. 4228012, 5119003" aria-label="User IDs" />
          ) : null}
          {to === "filter" ? (
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={vipOnly} onChange={(e) => setVipOnly(e.target.checked)} /> VIP only
              </label>
              <label className="flex items-center gap-2">
                Active in last
                <input className="field !w-20" inputMode="numeric" value={activeDays} onChange={(e) => setActiveDays(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="any" /> days
              </label>
            </div>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <div>
            <label className="label" htmlFor="sp-title">
              Title
            </label>
            <input id="sp-title" className="field" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diwali Mehfil Week is here!" />
          </div>
          <div>
            <label className="label" htmlFor="sp-cat">
              Category
            </label>
            <select id="sp-cat" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ").toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="sp-body">
            Message
          </label>
          <textarea id="sp-body" rows={4} maxLength={1000} className="field resize-none" value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="mt-1 text-right text-[11px] text-muted">{body.length}/1000</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sp-act">
              Button opens
            </label>
            <select id="sp-act" className="field" value={actionUrl} onChange={(e) => setActionUrl(e.target.value)}>
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sp-actl">
              Button text
            </label>
            <input id="sp-actl" className="field" maxLength={40} disabled={!actionUrl} value={actionLabel} onChange={(e) => setActionLabel(e.target.value)} placeholder={ACTIONS.find((a) => a.value === actionUrl)?.label ?? ""} />
          </div>
        </div>
        <div>
          <span className="label">Picture (optional)</span>
          {image ? (
            <div className="relative w-fit">
              <img src={image.previewUrl} alt="" className="max-h-40 rounded-xl" />
              <button type="button" onClick={() => setImage(null)} className="absolute right-1 top-1 rounded-full bg-ink/80 p-1" aria-label="Remove picture">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted hover:text-cream">
              <ImagePlus className="h-4 w-4" /> {uploading ? "Uploading…" : "Add a picture"}
              <input type="file" accept="image/png,image/jpeg" className="hidden" disabled={uploading} onChange={(e) => void upload(e.target.files?.[0])} />
            </label>
          )}
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <div className="flex justify-end">
          <Button variant="primary" busy={busy} disabled={!body.trim() || uploading} onClick={send}>
            <Send className="h-4 w-4" /> Send
          </Button>
        </div>
      </div>
    </Card>
  );
}

function audienceText(a: Record<string, unknown>) {
  const t = String(a.type ?? "ALL");
  if (t === "ALL") return "Everyone";
  if (t === "USERS") return `${Array.isArray(a.userIds) ? a.userIds.length : 0} users`;
  const parts = [a.vipOnly ? "VIP" : "", a.activeInLastDays ? `active ${a.activeInLastDays}d` : ""].filter(Boolean);
  return parts.length ? parts.join(", ") : "Filtered";
}

function Broadcasts() {
  const { version, changed, toast } = useAdmin();
  const [tick, setTick] = useState(0);
  const list = useLoad(() => apiRequest<{ items: Broadcast[] }>(`${BASE}/broadcasts?page=0&size=30`), [version, tick]);
  // Refresh while something is still sending
  const sending = list.data?.items.some((b) => b.status === "SENDING" || b.status === "SCHEDULED");
  useEffect(() => {
    if (!sending) return;
    const t = window.setTimeout(() => setTick((n) => n + 1), 4000);
    return () => window.clearTimeout(t);
  }, [sending, list.data]);
  const cancel = async (id: string) => {
    if (!window.confirm("Stop this broadcast? People who already got it keep it.")) return;
    try {
      await apiRequest(`${BASE}/broadcasts/${id}/cancel`, { method: "POST" });
      toast("Broadcast stopped");
      changed();
    } catch (e) {
      toast(msg(e));
    }
  };
  const tone = (s: string) => (s === "SENT" ? "ok" : s === "SENDING" ? "info" : s === "CANCELLED" ? "muted" : "warn");
  return (
    <Card title="Broadcasts">
      {list.error ? <ErrorNote>{list.error}</ErrorNote> : null}
      {!list.data ? (
        <Loading />
      ) : list.data.items.length ? (
        <ul className="max-h-[480px] divide-y divide-line overflow-y-auto">
          {list.data.items.map((b) => (
            <li key={b.id} className="flex gap-3 px-4 py-3">
              {b.imageUrl ? <img src={b.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{b.title ?? "(no title)"}</p>
                  <Badge tone={tone(b.status)}>{b.status.toLowerCase()}</Badge>
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-cream/80">{b.body}</p>
                <p className="mt-1 text-xs text-muted">
                  {audienceText(b.audience)} · {b.sentCount ?? 0} delivered · {b.createdBy ?? "admin"} · {timeAgo(Date.parse(b.createdAt))}
                </p>
              </div>
              {b.status === "SENDING" || b.status === "SCHEDULED" ? (
                <Button size="sm" variant="ghost" onClick={() => void cancel(b.id)}>
                  Stop
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No broadcasts yet.</Empty>
      )}
    </Card>
  );
}

function Templates() {
  const { version, changed, toast } = useAdmin();
  const list = useLoad(() => apiRequest<Template[]>(`${BASE}/templates`), [version]);
  const [edit, setEdit] = useState<Template | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      await apiRequest(`${BASE}/templates/${encodeURIComponent(edit.key)}`, { method: "PUT", body: edit });
      toast("Template saved");
      setEdit(null);
      changed();
    } catch (e) {
      toast(msg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" aria-hidden /> Automatic messages
        </span>
      }
    >
      <p className="px-4 pt-3 text-xs text-muted">Sent by the server when something happens (payment done, VIP active, new CP…). Words in {"{braces}"} are filled in.</p>
      {!list.data ? (
        <Loading />
      ) : (
        <ul className="divide-y divide-line">
          {list.data.map((t) =>
            edit?.key === t.key ? (
              <li key={t.key} className="space-y-2 px-4 py-3">
                <p className="font-mono text-xs text-gold">{t.key}</p>
                <input className="field" value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Title" aria-label="Title" />
                <textarea className="field resize-none" rows={3} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} aria-label="Message" />
                <div className="grid grid-cols-2 gap-2">
                  <input className="field" value={edit.actionLabel ?? ""} onChange={(e) => setEdit({ ...edit, actionLabel: e.target.value })} placeholder="Button text" aria-label="Button text" />
                  <select className="field" value={edit.actionUrl ?? ""} onChange={(e) => setEdit({ ...edit, actionUrl: e.target.value })} aria-label="Button opens">
                    {ACTIONS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="primary" busy={busy} disabled={!edit.body.trim()} onClick={save}>
                    Save
                  </Button>
                </div>
              </li>
            ) : (
              <li key={t.key} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {t.title ?? t.key} <span className="ml-1 font-mono text-[10px] text-muted">{t.key}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-cream/75">{t.body}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEdit({ ...t })}>
                  Edit
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
    </Card>
  );
}

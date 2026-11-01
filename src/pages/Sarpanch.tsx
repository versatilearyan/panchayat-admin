import { useMemo, useState } from "react";
import { BadgeCheck, Megaphone, Send } from "lucide-react";
import { adminApi, type SarpanchProfile } from "../api";
import { useAdmin } from "../context";
import { FileField, FileImage } from "../components/media";
import { Button, Card, Chips, Empty, ErrorNote, fmtDate, Loading, PageHeader, timeAgo, useLoad } from "../components/ui";

/** The official Sarpanch account in the app: its profile, and messages sent as Sarpanch. */
export function SarpanchPage() {
  const { version } = useAdmin();
  const profile = useLoad(() => adminApi.getSarpanch(), [version]);
  return (
    <>
      <PageHeader title="Sarpanch" sub="The official Panchayat account in the app. Everything you send here shows as coming from Sarpanch." />
      {profile.error ? <ErrorNote>{profile.error}</ErrorNote> : null}
      {profile.data ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <ProfileCard key={profile.data.updatedAt} profile={profile.data} />
          <div className="space-y-5">
            <Compose />
            <Sent />
          </div>
        </div>
      ) : (
        <Loading />
      )}
    </>
  );
}

function ProfileCard({ profile }: { profile: SarpanchProfile }) {
  const { changed, toast } = useAdmin();
  const [f, setF] = useState({ name: profile.name, handle: profile.handle, bio: profile.bio, photo: profile.photo });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = f.name !== profile.name || f.handle !== profile.handle || f.bio !== profile.bio || f.photo !== profile.photo;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.saveSarpanch(f);
      toast("Sarpanch profile saved");
      changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  };

  return (
    <Card title="Profile in the app">
      <div className="space-y-4 px-4 py-4">
        {/* How it looks to users */}
        <div className="flex items-center gap-3 rounded-2xl bg-ink px-3.5 py-3 ring-1 ring-line">
          <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#7a2f45] to-[#16151a] font-display text-xl font-bold ring-2 ring-gold/60 [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
            {f.photo ? <FileImage fileRef={f.photo} /> : f.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-display text-lg font-bold">
              <span className="truncate">{f.name || "Sarpanch"}</span>
              <BadgeCheck className="h-5 w-5 shrink-0 text-gold" aria-label="Official" />
            </p>
            <p className="text-xs text-muted">{f.handle} · Official account</p>
            {f.bio ? <p className="mt-1 line-clamp-2 text-xs text-cream/80">{f.bio}</p> : null}
          </div>
        </div>
        <FileField kind="image" label="Profile photo" value={f.photo} onChange={(v) => setF((x) => ({ ...x, photo: v }))} hint="Square image. Shown with a gold ring and the official tick." />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sp-name">
              Name
            </label>
            <input id="sp-name" className="field" value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="sp-handle">
              Username
            </label>
            <input id="sp-handle" className="field" autoCapitalize="none" value={f.handle} onChange={(e) => setF((x) => ({ ...x, handle: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="sp-bio">
            Bio
          </label>
          <textarea id="sp-bio" rows={3} maxLength={160} className="field resize-none" value={f.bio} onChange={(e) => setF((x) => ({ ...x, bio: e.target.value }))} />
        </div>
        <p className="text-xs leading-snug text-muted">
          Nobody can ban, mute or kick Sarpanch, and normal users can't take names or usernames with “sarpanch”, “panchayat”, “admin” or “official” in them.
        </p>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">
            Last changed by {profile.updatedBy} · {timeAgo(profile.updatedAt)}
          </p>
          <Button variant="primary" busy={busy} disabled={!dirty} onClick={save}>
            Save profile
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Compose() {
  const { changed, toast, version } = useAdmin();
  const users = useLoad(() => adminApi.listUsers(), [version]);
  const [to, setTo] = useState<"all" | "one">("all");
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const people = useMemo(() => (users.data ?? []).filter((u) => !u.official).sort((a, b) => a.name.localeCompare(b.name)), [users.data]);

  const send = async () => {
    if (to === "all" && !window.confirm("Send this to everyone on Panchayat?")) return;
    setBusy(true);
    setError(null);
    try {
      await adminApi.sendAsSarpanch(to === "all" ? null : userId, title, body);
      toast(to === "all" ? "Sent to everyone as Sarpanch" : `Sent to ${people.find((p) => p.id === userId)?.name ?? "them"} as Sarpanch`);
      setTitle("");
      setBody("");
      changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send");
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
      <div className="space-y-4 px-4 py-4">
        <div>
          <span className="label">To</span>
          <Chips
            label="To"
            value={to}
            onChange={setTo}
            options={[
              { value: "all", label: "Everyone (announcement)" },
              { value: "one", label: "One user (inbox)" },
            ]}
          />
          {to === "one" ? (
            <select className="field mt-2" aria-label="User" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Pick a user…</option>
              {people.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.handle} · ID {u.uid}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <div>
          <label className="label" htmlFor="sp-title">
            Title
          </label>
          <input id="sp-title" className="field" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diwali Mehfil Week is here!" />
        </div>
        <div>
          <label className="label" htmlFor="sp-body">
            Message
          </label>
          <textarea id="sp-body" rows={4} maxLength={1000} className="field resize-none" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <div className="flex justify-end">
          <Button variant="primary" busy={busy} disabled={!title.trim() || !body.trim() || (to === "one" && !userId)} onClick={send}>
            <Send className="h-4 w-4" /> Send
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Sent() {
  const { version, openUser } = useAdmin();
  const msgs = useLoad(() => adminApi.listSarpanchMessages(), [version]);
  const users = useLoad(() => adminApi.listUsers(), [version]);
  const nameOf = (id: string) => users.data?.find((u) => u.id === id)?.name ?? id;
  return (
    <Card title="Sent">
      {msgs.loading && !msgs.data ? (
        <Loading />
      ) : msgs.data?.length ? (
        <ul className="divide-y divide-line">
          {msgs.data.map((m) => (
            <li key={m.id} className="px-4 py-3">
              <p className="text-sm font-semibold">{m.title}</p>
              <p className="mt-0.5 line-clamp-3 text-sm text-cream/80">{m.body}</p>
              <p className="mt-1 text-xs text-muted">
                To{" "}
                {m.toUserId ? (
                  <button type="button" className="font-semibold hover:underline" onClick={() => openUser(m.toUserId!)}>
                    {nameOf(m.toUserId)}
                  </button>
                ) : (
                  "everyone"
                )}{" "}
                · written by {m.by} · {fmtDate(m.sentAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Nothing sent as Sarpanch yet.</Empty>
      )}
    </Card>
  );
}

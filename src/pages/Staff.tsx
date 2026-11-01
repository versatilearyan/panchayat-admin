import { useState } from "react";
import { Check, KeyRound, Plus, ShieldCheck, X } from "lucide-react";
import { adminApi, can, ROLE_LABEL, ROLE_SUMMARY, type Permission, type Role, type StaffMember } from "../api";
import { useAdmin } from "../context";
import { Avatar, Badge, Button, Card, Chips, Empty, ErrorNote, Loading, Modal, PageHeader, Toggle, useLoad } from "../components/ui";

const ROLES: Role[] = ["moderator", "admin", "super_admin"];
const ROLE_TONE: Record<Role, "info" | "gold" | "coral"> = { moderator: "info", admin: "gold", super_admin: "coral" };

/** What each role can do, as rows in the table at the bottom of the page. */
const MATRIX: [string, Permission][] = [
  ["Warn, mute and kick users", "users.mute"],
  ["Handle reports", "reports.handle"],
  ["Ban and unban", "users.ban"],
  ["Add or remove coins", "users.coins"],
  ["Give VIP", "users.vip"],
  ["Give chat bubbles, rings and other items", "users.items"],
  ["Create and edit rooms", "rooms.create"],
  ["Add and edit gifts (SVGA)", "gifts.manage"],
  ["Add and edit Shop items", "store.manage"],
  ["See prices", "pricing.view"],
  ["Change prices (VIP, coins, rings, bubbles, gifts)", "pricing.edit"],
  ["Delete gifts, Shop items and rooms", "gifts.delete"],
  ["Change any user's name and username", "users.rename"],
  ["Run the Sarpanch account", "sarpanch.manage"],
  ["Manage staff accounts", "staff.manage"],
  ["App settings and maintenance mode", "settings.edit"],
];

export function StaffPage() {
  const { version, session } = useAdmin();
  const { data, error, loading } = useLoad(() => adminApi.listStaff(), [version]);
  const [edit, setEdit] = useState<StaffMember | "new" | null>(null);
  const order = (m: StaffMember) => ROLES.length - ROLES.indexOf(m.role);

  return (
    <>
      <PageHeader
        title="Staff"
        sub="Who can sign in to this panel, and what they're allowed to do."
        right={
          <Button variant="primary" onClick={() => setEdit("new")}>
            <Plus className="h-4 w-4" /> Add staff
          </Button>
        }
      />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Card className="mb-5">
        {loading && !data ? (
          <Loading />
        ) : data?.length ? (
          <ul className="divide-y divide-line">
            {[...data]
              .sort((a, b) => order(b) - order(a) || a.name.localeCompare(b.name))
              .map((m) => (
                <li key={m.username} className={`flex items-center gap-3 px-4 py-3 ${m.active ? "" : "opacity-55"}`}>
                  <Avatar name={m.name} color={m.role === "super_admin" ? "#7a2f45" : m.role === "admin" ? "#7a5a2a" : "#2f4a63"} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{m.name}</span>
                      <Badge tone={ROLE_TONE[m.role]}>{m.title}</Badge>
                      {m.username === session.username ? <Badge tone="ok">You</Badge> : null}
                      {!m.active ? <Badge>Disabled</Badge> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      @{m.username} · {ROLE_LABEL[m.role]}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEdit(m)}>
                    Edit
                  </Button>
                </li>
              ))}
          </ul>
        ) : (
          <Empty>No staff yet.</Empty>
        )}
      </Card>

      <Card title="What each role can do">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[11px] tracking-wider text-muted uppercase">
                <th className="px-4 py-2.5 font-bold">Action</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-3 py-2.5 text-center font-bold">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {MATRIX.map(([label, p]) => (
                <tr key={p}>
                  <td className="px-4 py-2">{label}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-3 py-2 text-center">
                      {can(r, p) ? <Check className="mx-auto h-4 w-4 text-ok" aria-label="Yes" /> : <X className="mx-auto h-4 w-4 text-muted/50" aria-label="No" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-2.5 text-xs text-muted">Admins can add or remove up to 1,00,000 coins at a time; super admins up to 1,00,00,000.</p>
      </Card>

      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === "new" ? "Add staff" : edit ? `Edit ${edit.name}` : ""}>
        {edit ? <StaffForm key={edit === "new" ? "new" : edit.username} member={edit === "new" ? null : edit} onClose={() => setEdit(null)} /> : null}
      </Modal>
    </>
  );
}

function StaffForm({ member, onClose }: { member: StaffMember | null; onClose: () => void }) {
  const { changed, toast, session } = useAdmin();
  const [f, setF] = useState<StaffMember>(member ?? { username: "", name: "", role: "moderator", title: "Moderator", active: true, createdAt: Date.now() });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof StaffMember>(k: K, v: StaffMember[K]) => setF((x) => ({ ...x, [k]: v }));
  const isMe = member?.username === session.username;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.saveStaff({ ...f, password: password || undefined }, !member);
      toast(member ? `${f.name} saved` : `${f.name} can sign in now`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="s-name">
            Name
          </label>
          <input id="s-name" className="field" value={f.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="s-user">
            Username
          </label>
          <input id="s-user" className="field disabled:opacity-60" autoCapitalize="none" disabled={Boolean(member)} value={f.username} onChange={(e) => set("username", e.target.value.toLowerCase())} />
        </div>
      </div>
      <div>
        <span className="label">Role</span>
        <Chips
          label="Role"
          value={f.role}
          onChange={(r) => setF((x) => ({ ...x, role: r, title: !x.title || x.title === ROLE_LABEL[x.role] ? ROLE_LABEL[r] : x.title }))}
          options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
        />
        <p className="mt-2 text-xs leading-snug text-muted">{ROLE_SUMMARY[f.role]}</p>
        {isMe ? <p className="mt-1 text-xs text-warn">You can't take away your own super admin access.</p> : null}
      </div>
      <div>
        <label className="label" htmlFor="s-title">
          Title <span className="normal-case tracking-normal text-muted/70">(shown next to their name, e.g. Moderator 1)</span>
        </label>
        <input id="s-title" className="field" value={f.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="s-pass">
          {member ? "New password" : "Password"} {member ? <span className="normal-case tracking-normal text-muted/70">(leave empty to keep it)</span> : null}
        </label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input id="s-pass" type="password" autoComplete="new-password" className="field pl-9" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        </div>
      </div>
      {member ? <Toggle checked={f.active} onChange={(v) => set("active", v)} label="Can sign in" hint="Turn off to lock the account without deleting its history." disabled={isMe} /> : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button variant="primary" busy={busy} onClick={save} disabled={!f.name.trim() || !f.username.trim() || (!member && password.length < 8)} className="flex-[1.4]">
          <ShieldCheck className="h-4 w-4" /> {member ? "Save" : "Add staff"}
        </Button>
      </div>
    </div>
  );
}

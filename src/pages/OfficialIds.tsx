import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Plus, Trash2, UserCheck } from "lucide-react";
import { BACKEND_ENABLED } from "../config/api";
import { apiRequest } from "../lib/api";
import { useAdmin } from "../context";
import { Avatar, Badge, Button, Card, Empty, Loading, PageHeader, timeAgo } from "../components/ui";

type Official = { userId: string; code: string; name: string; email: string; bio?: string | null; avatarUrl?: string | null; publicId: number; createdAt?: string | null; chats: number };

/**
 * Official IDs: accounts numbered 001, 002, 003, ... with a blue tick and an OFFICIAL tag. Anyone can message them
 * (no message requests). You run one by signing in to the app with its email (Google, or the email code).
 */
export function OfficialIdsPage() {
  const { version, openUser, changed, toast } = useAdmin();
  const [rows, setRows] = useState<Official[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [existing, setExisting] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => {
    setRows(null);
    apiRequest<Official[]>("/api/v1/admin/officials").then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(load, [load, version]);

  const run = async (key: string, f: () => Promise<{ code?: string } | unknown>, ok: (r: { code?: string }) => string) => {
    setBusy(key);
    try {
      const r = (await f()) as { code?: string };
      toast(ok(r ?? {}));
      changed();
      load();
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (!BACKEND_ENABLED) return <Empty>Official IDs need the live backend.</Empty>;
  return (
    <>
      <PageHeader
        title="Official IDs"
        sub="Accounts numbered 001, 002, 003 … with a blue tick and an OFFICIAL tag. Anyone can message them without a message request. To run one, sign in to the app with its email (Google, or the email code)."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Create a new official ID">
          <div className="space-y-3 p-4">
            <div>
              <label className="label" htmlFor="of-name">
                Name
              </label>
              <input id="of-name" className="field" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Panchayat Support" />
            </div>
            <div>
              <label className="label" htmlFor="of-email">
                Sign-in email
              </label>
              <input id="of-email" className="field" type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="an email you can sign in with" />
              <p className="mt-1 text-xs text-muted">You open this ID by signing in to the app with this email. It must not already have an account.</p>
            </div>
            <div>
              <label className="label" htmlFor="of-bio">
                Bio (optional)
              </label>
              <textarea id="of-bio" rows={2} maxLength={120} className="field resize-none" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="e.g. Official help desk. Message us any time." />
            </div>
            <Button
              variant="gold"
              busy={busy === "create"}
              disabled={name.trim().length < 2 || !email.includes("@")}
              onClick={async () => {
                const ok = await run("create", () => apiRequest("/api/v1/admin/officials", { method: "POST", body: { name: name.trim(), email: email.trim(), bio: bio.trim() } }), (r) => `Official ID ${r.code ?? ""} created`);
                if (ok) {
                  setName("");
                  setEmail("");
                  setBio("");
                }
              }}
            >
              <Plus className="h-4 w-4" aria-hidden /> Create official ID
            </Button>
          </div>
        </Card>
        <Card title="Make an existing account official">
          <div className="space-y-3 p-4">
            <div>
              <label className="label" htmlFor="of-user">
                Account ID
              </label>
              <input id="of-user" className="field" inputMode="numeric" value={existing} onChange={(e) => setExisting(e.target.value.replace(/\D/g, ""))} placeholder="7-digit user ID, e.g. 6372289" />
              <p className="mt-1 text-xs text-muted">It gets the next number (001, 002, …), the blue tick, and open messages. You run it by signing in as that account.</p>
            </div>
            <Button
              variant="primary"
              busy={busy === "make"}
              disabled={!existing}
              onClick={async () => {
                const ok = await run("make", () => apiRequest("/api/v1/admin/officials/make", { method: "POST", body: { user: existing } }), (r) => `Now official ID ${r.code ?? ""}`);
                if (ok) setExisting("");
              }}
            >
              <UserCheck className="h-4 w-4" aria-hidden /> Make official
            </Button>
          </div>
        </Card>
      </div>

      <Card title={rows ? `Official IDs (${rows.length})` : "Official IDs"} className="mt-4">
        {!rows ? (
          <Loading />
        ) : rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.userId} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="w-12 shrink-0 text-center font-display text-lg font-bold text-info">{r.code}</span>
                  <Avatar name={r.name} color="#3b82f6" photoUrl={r.avatarUrl ?? undefined} size={40} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-semibold text-cream">
                      {r.name} <BadgeCheck className="h-4 w-4 shrink-0 fill-[#3b82f6] text-white" aria-label="Official" />
                    </p>
                    <p className="truncate text-xs text-muted">
                      {r.email} · user ID {r.publicId} · {r.chats} chats{r.createdAt ? ` · since ${timeAgo(Date.parse(r.createdAt))}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Badge tone="info">ID {r.code}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => openUser(r.userId)}>
                    Open user
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    busy={busy === `rm${r.userId}`}
                    onClick={() => {
                      if (!window.confirm(`Remove official status from ${r.name} (${r.code})? The account stays; it loses the tick, the number and open messages.`)) return;
                      void run(`rm${r.userId}`, () => apiRequest(`/api/v1/admin/officials/${r.userId}`, { method: "DELETE" }), () => `${r.name} is no longer official`);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden /> Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No official IDs yet. Create the first one above: it will be 001.</Empty>
        )}
      </Card>
    </>
  );
}

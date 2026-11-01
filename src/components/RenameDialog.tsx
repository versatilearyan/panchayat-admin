/** Change a user's display name and @username. */
import { useState } from "react";
import { adminApi, type AdminUser } from "../api";
import { useAdmin } from "../context";
import { Avatar, Button, ErrorNote, Modal } from "./ui";

const REASONS = ["User asked for it", "Offensive name", "Impersonation", "Reserved name", "Spam name"];

export function RenameDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { changed, toast } = useAdmin();
  const [name, setName] = useState(user.name);
  const [handle, setHandle] = useState(user.handle.replace(/^@/, ""));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const same = name.trim() === user.name && `@${handle.trim().toLowerCase()}` === user.handle;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const u = await adminApi.renameUser(user.id, name, handle, reason);
      toast(`Saved: ${u.name} (${u.handle})`);
      changed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Change name or username">
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-2xl bg-ink px-3.5 py-3 ring-1 ring-line">
          <Avatar name={name || user.name} color={user.color} photoUrl={user.photoUrl} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{name || user.name}</p>
            <p className="text-xs text-muted">
              @{handle.replace(/^@/, "").toLowerCase() || "…"} · ID {user.uid} (the ID never changes)
            </p>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="rn-name">
            Name
          </label>
          <input id="rn-name" className="field" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="rn-handle">
            Username
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-muted">@</span>
            <input
              id="rn-handle"
              className="field pl-8"
              maxLength={21}
              autoCapitalize="none"
              spellCheck={false}
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/^@/, "").toLowerCase())}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted">3 to 20 letters, numbers, dots or underscores. Must not be taken by someone else.</p>
        </div>
        <div>
          <label className="label" htmlFor="rn-reason">
            Reason <span className="normal-case tracking-normal text-muted/70">(for the activity log)</span>
          </label>
          <input id="rn-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} />
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
          <Button variant="primary" busy={busy} disabled={same || !reason.trim() || name.trim().length < 2 || handle.trim().length < 3} onClick={save} className="flex-[1.4]">
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

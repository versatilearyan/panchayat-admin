/**
 * Chat moderation, live from the backend (/api/v1/admin/moderation).
 *
 * An admin-managed banned-word list: any chat message (private or in a room) that uses one is flagged
 * here for review — never blocked, so nobody's conversation breaks. Also a manual image review queue
 * (recent Moments photos/video) since there's no automated NSFW scan (that needs a paid third-party API).
 */
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ImageIcon, ListChecks, Plus, X } from "lucide-react";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Button, Card, Chips, Empty, ErrorNote, Loading, PageHeader } from "../components/ui";

type BannedWord = { id: number; word: string; createdAt: string };
type Violation = {
  id: number;
  userId: string;
  userName: string;
  userPublicId?: number;
  source: "PRIVATE_CHAT" | "ROOM_CHAT";
  roomId?: number | null;
  matchedWord: string;
  snippet: string;
  createdAt: string;
  reviewed: boolean;
};
type MomentImage = {
  momentId: string;
  userId: string;
  userName: string;
  userPublicId?: number;
  createdAt: string;
  media: { url: string; type: "IMAGE" | "VIDEO" }[];
};

const base = "/api/v1/admin/moderation";
const TABS = ["Violations", "Banned words", "Image review"] as const;
type Tab = (typeof TABS)[number];

export function ModerationPage() {
  const [tab, setTab] = useState<Tab>("Violations");
  return (
    <>
      <PageHeader title="Moderation" sub="Chat messages that use a banned word are flagged here, never blocked. Review recent Moments photos/video separately." />
      <Chips label="Section" value={tab} onChange={setTab} options={TABS.map((t) => ({ value: t, label: t }))} />
      <div className="mt-4">
        {tab === "Violations" ? <ViolationsTab /> : tab === "Banned words" ? <WordsTab /> : <ImagesTab />}
      </div>
    </>
  );
}

function ViolationsTab() {
  const { toast, version } = useAdmin();
  const [onlyUnreviewed, setOnlyUnreviewed] = useState(true);
  const [items, setItems] = useState<Violation[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    apiRequest<Violation[]>(`${base}/violations${onlyUnreviewed ? "?reviewed=false" : ""}`)
      .then((r) => {
        setItems(r);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load violations"));
  }, [onlyUnreviewed]);
  useEffect(load, [load, version]);

  const markReviewed = async (id: number) => {
    setBusy(id);
    try {
      await apiRequest(`${base}/violations/${id}/reviewed`, { method: "POST" });
      toast("Marked as reviewed");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted">
        <input type="checkbox" checked={onlyUnreviewed} onChange={(e) => setOnlyUnreviewed(e.target.checked)} /> Only what's still unreviewed
      </label>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!items && !error ? (
        <Loading />
      ) : items && items.length ? (
        <div className="space-y-3">
          {items.map((v) => (
            <Card key={v.id}>
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-display text-[14px] font-bold">{v.userName}</span>
                    {v.userPublicId ? <span className="text-xs text-muted">ID {v.userPublicId}</span> : null}
                    <Badge tone="info">{v.source === "ROOM_CHAT" ? `Room chat${v.roomId ? ` · room ${v.roomId}` : ""}` : "Private chat"}</Badge>
                    <Badge tone="warn">"{v.matchedWord}"</Badge>
                    {v.reviewed ? <Badge tone="ok">Reviewed</Badge> : null}
                  </p>
                  <p className="mt-1.5 text-sm text-cream/85">{v.snippet}</p>
                  <p className="mt-1.5 text-xs text-muted">{new Date(v.createdAt).toLocaleString()}</p>
                </div>
                {!v.reviewed ? (
                  <Button size="sm" busy={busy === v.id} onClick={() => markReviewed(v.id)}>
                    <CheckCircle2 className="h-4 w-4" /> Mark reviewed
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Empty>
            <ListChecks className="mx-auto mb-2 h-6 w-6" aria-hidden /> Nothing flagged.
          </Empty>
        </Card>
      )}
    </div>
  );
}

function WordsTab() {
  const { toast } = useAdmin();
  const [items, setItems] = useState<BannedWord[] | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    apiRequest<BannedWord[]>(`${base}/words`)
      .then((r) => {
        setItems(r);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the word list"));
  }, []);
  useEffect(load, [load]);

  const add = async () => {
    const word = draft.trim();
    if (!word) return;
    setBusy("add");
    try {
      await apiRequest(`${base}/words`, { method: "POST", body: { word } });
      setDraft("");
      toast(`"${word}" added`);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(null);
    }
  };
  const remove = async (w: BannedWord) => {
    setBusy(`del-${w.id}`);
    try {
      await apiRequest(`${base}/words/${w.id}`, { method: "DELETE" });
      toast(`"${w.word}" removed`);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex max-w-md gap-2">
        <input
          className="field"
          placeholder="Add a word (whole-word, case-insensitive match)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          aria-label="New banned word"
        />
        <Button variant="primary" busy={busy === "add"} disabled={!draft.trim()} onClick={add}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!items && !error ? (
        <Loading />
      ) : items && items.length ? (
        <ul className="flex flex-wrap gap-2">
          {items.map((w) => (
            <li key={w.id} className="flex items-center gap-1.5 rounded-full bg-cream/8 px-3 py-1.5 text-sm font-semibold">
              {w.word}
              <button type="button" aria-label={`Remove "${w.word}"`} disabled={busy === `del-${w.id}`} className="text-muted hover:text-[#ff9095]" onClick={() => remove(w)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <Empty>No banned words yet.</Empty>
        </Card>
      )}
    </div>
  );
}

function ImagesTab() {
  const [items, setItems] = useState<MomentImage[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<MomentImage[]>(`${base}/images`)
      .then((r) => {
        setItems(r);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load images"));
  }, []);

  return (
    <div>
      <p className="mb-3 text-sm text-muted">Recent Moments photos and video, for a manual look — there's no automated NSFW scan.</p>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!items && !error ? (
        <Loading />
      ) : items && items.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.flatMap((m) =>
            m.media.map((f, i) => (
              <a key={`${m.momentId}-${i}`} href={f.url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-xl ring-1 ring-line">
                {f.type === "VIDEO" ? (
                  <video src={f.url} className="aspect-square w-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt="" className="aspect-square w-full object-cover" />
                )}
                <span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">{m.userName}</span>
              </a>
            )),
          )}
        </div>
      ) : (
        <Card>
          <Empty>
            <ImageIcon className="mx-auto mb-2 h-6 w-6" aria-hidden /> No recent images.
          </Empty>
        </Card>
      )}
    </div>
  );
}

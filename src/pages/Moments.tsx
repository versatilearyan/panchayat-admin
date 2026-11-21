/**
 * Moments moderation, live from the backend (/api/v1/admin/moments).
 *
 * Hide a Moment (same as the author deleting it: comes off every feed, but stays in the database so you
 * can see a repeat offender's history and put it back), or erase one for good (the row, its likes and
 * comments, and its uploaded photos/video are all gone).
 */
import { useCallback, useEffect, useState } from "react";
import { EyeOff, ImageOff, RotateCcw, Search, Trash2 } from "lucide-react";
import { useAdmin } from "../context";
import { apiRequest } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorNote, Loading, PageHeader } from "../components/ui";

type MomentFile = { url: string; type: "IMAGE" | "VIDEO" };
type Moment = {
  id: string;
  userId: string;
  authorName: string;
  authorPublicId: number;
  body?: string | null;
  visibility: "PUBLIC" | "FRIENDS";
  likeCount: number;
  commentCount: number;
  createdAt: string;
  hidden: boolean;
  deletedAt?: string | null;
  media: MomentFile[];
};

const base = "/api/v1/admin/moments";

export function MomentsPage() {
  const { toast, version } = useAdmin();
  const [q, setQ] = useState("");
  const [includeHidden, setIncludeHidden] = useState(false);
  const [items, setItems] = useState<Moment[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    apiRequest<{ items: Moment[] }>(`${base}?q=${encodeURIComponent(q.trim())}&includeHidden=${includeHidden}&limit=60`)
      .then((r) => {
        setItems(r.items);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load Moments"));
  }, [q, includeHidden]);
  useEffect(() => {
    const t = window.setTimeout(load, q ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [load, q, version]);

  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast(done);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Moments" sub="Hide a Moment to pull it off every feed (it can be put back), or erase one for good — photos, video, likes and comments included." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative md:w-96">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input className="field pl-9" placeholder="Search by text, author or Moment ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search Moments" />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-muted">
          <input type="checkbox" checked={includeHidden} onChange={(e) => setIncludeHidden(e.target.checked)} /> Show hidden ones too
        </label>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {!items && !error ? (
        <Loading />
      ) : items && items.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((m) => (
            <Card key={m.id}>
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-display text-[14px] font-bold">{m.authorName}</span>
                    <span className="text-xs text-muted">ID {m.authorPublicId}</span>
                    {m.visibility === "FRIENDS" ? <Badge tone="info">Friends only</Badge> : null}
                    {m.hidden ? <Badge tone="warn">Hidden</Badge> : null}
                  </p>
                  {m.body ? <p className="mt-1.5 line-clamp-3 text-sm text-cream/85">{m.body}</p> : null}
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                    {m.media.length ? (
                      <span className="inline-flex items-center gap-1">
                        <ImageOff className="h-3 w-3" aria-hidden />
                        {m.media.length} {m.media[0]?.type === "VIDEO" ? "video" : "photo" + (m.media.length > 1 ? "s" : "")}
                      </span>
                    ) : null}
                    <span>{m.likeCount} likes · {m.commentCount} comments</span>
                    <span>Moment ID {m.id}</span>
                    <span>{new Date(m.createdAt).toLocaleString()}</span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {m.hidden ? (
                    <Button size="sm" busy={busy === `restore-${m.id}`} onClick={() => act(`restore-${m.id}`, () => apiRequest(`${base}/${m.id}/restore`, { method: "POST" }), "Moment is back in the feed")}>
                      <RotateCcw className="h-4 w-4" /> Restore
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" busy={busy === `hide-${m.id}`} onClick={() => act(`hide-${m.id}`, () => apiRequest(`${base}/${m.id}`, { method: "DELETE" }), "Moment hidden from every feed")}>
                      <EyeOff className="h-4 w-4" /> Hide
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    busy={busy === `del-${m.id}`}
                    onClick={() =>
                      window.confirm("Erase this Moment for good? Its photos/video, likes and comments all go with it. This can't be undone.") &&
                      act(`del-${m.id}`, () => apiRequest(`${base}/${m.id}/permanent`, { method: "DELETE" }), "Moment erased for good")
                    }
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Empty>No Moments to show.</Empty>
        </Card>
      )}
    </>
  );
}

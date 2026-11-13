/** Parivar library: upload animations, badges, titles and gift art once; use their ID as a "COLLECTIBLE" reward in Family Treasure chests. */
import { useCallback, useEffect, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { useAdmin } from "../context";
import { apiRequest, apiUpload } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorNote, Loading, Toggle } from "./ui";
import { MediaPreview } from "./MediaParts";

const base = "/api/v1/admin/parivar/library";
type Item = { id: number; kind: string; name: string; description: string | null; mediaUrl: string; format: string; rarity: string; active: boolean; usedInRewards: number };
const KINDS = ["BADGE", "ANIMATION", "GIFT", "TITLE"];
const RARITIES = ["COMMON", "PREMIUM", "EPIC", "LEGENDARY", "ULTRA_RARE"];
const msg = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);

export function ParivarLibrary({ canSave }: { canSave: boolean }) {
  const { toast } = useAdmin();
  const [rows, setRows] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState("BADGE");
  const [rarity, setRarity] = useState("COMMON");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await apiRequest<Item[]>(base));
      setError(null);
    } catch (e) {
      setError(msg(e, "Could not load the library."));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const upload = async () => {
    if (!file || !name.trim()) return toast("Choose a file and give it a name", "error");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      form.append("name", name.trim());
      form.append("rarity", rarity);
      if (desc.trim()) form.append("description", desc.trim());
      await apiUpload(base, form).promise;
      toast("Added to the library");
      setName("");
      setDesc("");
      setFile(null);
      await load();
    } catch (e) {
      toast(msg(e, "Could not upload"), "error");
    } finally {
      setBusy(false);
    }
  };
  const patch = async (id: number, body: Record<string, unknown>) => {
    try {
      await apiRequest(`${base}/${id}`, { method: "PUT", body });
      await load();
    } catch (e) {
      toast(msg(e, "Could not save"), "error");
    }
  };
  const del = async (i: Item) => {
    if (!window.confirm(`Delete "${i.name}"? People who already won it keep it.`)) return;
    try {
      await apiRequest(`${base}/${i.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      toast(msg(e, "Could not delete"), "error");
    }
  };

  return (
    <>
      <Card title="Add to the Parivar library">
        <div className="space-y-3 px-4 py-3">
          <p className="text-xs text-muted">
            Upload a badge or gift picture (PNG, JPG), or an animation (SVGA, MP4). Then open the <b>Family Treasure</b> tab, add a reward of kind <b>COLLECTIBLE</b> and write this item&apos;s ID in &quot;Item ID&quot;. The winner gets it in their Parivar
            collection (&quot;My rewards&quot;) with its picture or animation.
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-xs font-semibold text-muted">
              Type
              <select className="field mt-1 h-9 w-full py-1" value={kind} onChange={(e) => setKind(e.target.value)} disabled={!canSave}>
                {KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Rarity
              <select className="field mt-1 h-9 w-full py-1" value={rarity} onChange={(e) => setRarity(e.target.value)} disabled={!canSave}>
                {RARITIES.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Name (shown to the winner)
              <input className="field mt-1 h-9 w-full py-1" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} disabled={!canSave} />
            </label>
          </div>
          <label className="block text-xs font-semibold text-muted">
            Short note (optional)
            <input className="field mt-1 h-9 w-full py-1" maxLength={200} value={desc} onChange={(e) => setDesc(e.target.value)} disabled={!canSave} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" accept=".png,.jpg,.jpeg,.svga,.mp4" disabled={!canSave || busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-xs" />
            <Button variant="gold" busy={busy} disabled={!canSave || !file || !name.trim()} onClick={() => void upload()}>
              <Upload className="h-4 w-4" /> Upload
            </Button>
          </div>
        </div>
      </Card>
      <Card className="mt-4" title="Library">
        {error ? (
          <ErrorNote>{error}</ErrorNote>
        ) : !rows ? (
          <Loading />
        ) : !rows.length ? (
          <Empty>Nothing uploaded yet.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <MediaPreview media={{ url: i.mediaUrl, format: i.format }} size={56} />
                <div className="min-w-[160px] flex-1">
                  <p className="text-sm font-bold text-cream">
                    {i.name} <span className="font-mono text-xs text-gold">ID {i.id}</span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-1.5">
                    <Badge tone="gold">{i.kind}</Badge>
                    <Badge>{i.rarity}</Badge>
                    <Badge>{i.format}</Badge>
                    {i.usedInRewards > 0 ? <Badge tone="ok">in {i.usedInRewards} chest reward(s)</Badge> : null}
                  </p>
                </div>
                <Toggle checked={i.active} onChange={(v) => void patch(i.id, { active: v })} label="On" disabled={!canSave} />
                <Button size="sm" variant="danger" disabled={!canSave} onClick={() => void del(i)} aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

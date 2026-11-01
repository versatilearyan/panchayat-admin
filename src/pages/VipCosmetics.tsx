/**
 * VIP Management → Cosmetics, live from the backend (/api/v1/admin/vip/cosmetics).
 * Super Admins upload each VIP level's frame, chat bubble, entry animation and badge;
 * the backend stores them on Cloudinary. Everything shown here comes from the server's
 * list: the counts, the per-level completeness and the table.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { CheckCircle2, Circle, ExternalLink, FileUp, ImageOff, Layers, Lock, Play, RotateCcw, Search, Sparkles, Upload, X } from "lucide-react";
import { BACKEND_ENABLED } from "../config/api";
import { useAdmin } from "../context";
import { ApiError } from "../lib/api";
import { Badge, Button, Card, Empty, ErrorNote, fmtDate, Loading, Modal, PageHeader } from "../components/ui";
import { SvgaPlayer } from "../components/media";
import { Field, NeedsBackend } from "../components/WalletParts";
import {
  COSMETIC_TYPES,
  FORMATS_FOR,
  VIP_LEVELS,
  cosmeticFileProblem,
  cosmeticForm,
  getVipCosmetics,
  typeLabel,
  uploadVipCosmetic,
  type CosmeticFormat,
  type CosmeticType,
  type VipCosmetic,
} from "../services/vipCosmeticService";

const at = (s?: string) => {
  const t = s ? Date.parse(s) : NaN;
  return Number.isFinite(t) ? t : 0;
};
const when = (s?: string) => (at(s) ? fmtDate(at(s)) : "—");
const fileSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function VipCosmeticsPage() {
  if (!BACKEND_ENABLED)
    return (
      <>
        <PageHeader title="VIP Cosmetics Management" sub="Manage VIP frames, chat bubbles, entry animations, and badges." />
        <NeedsBackend what="VIP cosmetics" />
      </>
    );
  return <CosmeticsLive />;
}

type Load = { data: VipCosmetic[] | null; loading: boolean; error: { message: string; kind: string } | null };

function useCosmetics() {
  const [state, setState] = useState<Load>({ data: null, loading: true, error: null });
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await getVipCosmetics();
      if (n === seq.current) setState({ data, loading: false, error: null });
    } catch (e) {
      if (n === seq.current) setState((s) => ({ data: s.data, loading: false, error: { message: e instanceof Error ? e.message : "Something went wrong.", kind: e instanceof ApiError ? e.kind : "unknown" } }));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { ...state, reload };
}

type Sort = "level-asc" | "level-desc" | "newest" | "oldest";

function CosmeticsLive() {
  const { toast } = useAdmin();
  const { data, loading, error, reload } = useCosmetics();
  const rows = useMemo(() => data ?? [], [data]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<VipCosmetic | null>(null);
  const [level, setLevel] = useState<number | "">("");
  const [type, setType] = useState<CosmeticType | "">("");
  const [format, setFormat] = useState<CosmeticFormat | "">("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("level-asc");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = rows.filter(
      (r) => (level === "" || r.vipLevel === level) && (type === "" || r.cosmeticType === type) && (format === "" || r.format === format) && (!needle || (r.originalFilename ?? "").toLowerCase().includes(needle)),
    );
    const typeOrder = (t: string) => COSMETIC_TYPES.findIndex((x) => x.value === t);
    return out.sort((a, b) =>
      sort === "newest"
        ? at(b.createdAt) - at(a.createdAt)
        : sort === "oldest"
          ? at(a.createdAt) - at(b.createdAt)
          : (sort === "level-asc" ? a.vipLevel - b.vipLevel : b.vipLevel - a.vipLevel) || typeOrder(a.cosmeticType) - typeOrder(b.cosmeticType) || a.format.localeCompare(b.format),
    );
  }, [rows, level, type, format, q, sort]);

  const filtered = level !== "" || type !== "" || format !== "" || q.trim() !== "";
  const clear = () => {
    setLevel("");
    setType("");
    setFormat("");
    setQ("");
  };

  const forbidden = error?.kind === "forbidden";

  return (
    <>
      <PageHeader
        title="VIP Cosmetics Management"
        sub="Manage VIP frames, chat bubbles, entry animations, and badges."
        right={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => reload()} busy={loading} aria-label="Refresh cosmetics">
              <RotateCcw className="h-4 w-4" /> Refresh
            </Button>
            <Button variant="primary" onClick={() => setUploading(true)} disabled={forbidden || !data}>
              <Upload className="h-4 w-4" /> Upload Cosmetic
            </Button>
          </div>
        }
      />

      {forbidden ? (
        <Card>
          <div className="px-4 py-12 text-center text-sm text-muted">
            <Lock className="mx-auto mb-2 h-6 w-6" aria-hidden />
            <p className="font-semibold text-cream">Access denied</p>
            <p className="mt-1">Only a Super Admin can manage VIP cosmetics. The server turned down your account for it.</p>
          </div>
        </Card>
      ) : !data && loading ? (
        <Card>
          <Loading />
        </Card>
      ) : !data ? (
        <Card>
          <div className="p-4">
            <ErrorNote>{error?.message ?? "Couldn't load the cosmetics."}</ErrorNote>
            <Button size="sm" variant="danger" className="mt-3" onClick={() => reload()}>
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {error ? (
            <div role="alert" className="mb-4">
              <ErrorNote>Couldn't refresh: {error.message} Showing the last list the server sent.</ErrorNote>
            </div>
          ) : null}
          <Summary rows={rows} />
          <LevelsOverview rows={rows} active={level} onPick={(l) => setLevel((cur) => (cur === l ? "" : l))} />

          <Card title="All cosmetics" className="mt-4">
            <div className="flex flex-wrap items-end gap-2.5 border-b border-line px-4 py-3">
              <label className="relative block min-w-[200px] flex-1">
                <span className="sr-only">Search by file name</span>
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input type="search" className="field pl-9" placeholder="Search by file name" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <Select label="VIP level" value={String(level)} onChange={(v) => setLevel(v ? Number(v) : "")} options={[["", "All levels"], ...VIP_LEVELS.map((l) => [String(l), `VIP ${l}`] as [string, string])]} />
              <Select label="Type" value={type} onChange={(v) => setType(v as CosmeticType | "")} options={[["", "All types"], ...COSMETIC_TYPES.map((t) => [t.value, t.label] as [string, string])]} />
              <Select label="Format" value={format} onChange={(v) => setFormat(v as CosmeticFormat | "")} options={[["", "All formats"], ["SVGA", "SVGA"], ["PNG", "PNG"]]} />
              <Select label="Sort" value={sort} onChange={(v) => setSort(v as Sort)} options={[["level-asc", "VIP level ↑"], ["level-desc", "VIP level ↓"], ["newest", "Newest first"], ["oldest", "Oldest first"]]} />
              {filtered ? (
                <Button size="sm" variant="ghost" onClick={clear} className="h-10">
                  <X className="h-3.5 w-3.5" /> Clear
                </Button>
              ) : null}
            </div>
            {rows.length === 0 ? (
              <Empty>
                No VIP cosmetics have been uploaded yet. Use <b>Upload Cosmetic</b> to add VIP 1's frame, bubble, entry animation and badge.
              </Empty>
            ) : shown.length === 0 ? (
              <Empty>No cosmetics match these filters.</Empty>
            ) : (
              <CosmeticTable rows={shown} onPreview={setPreview} />
            )}
            {rows.length ? (
              <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
                {shown.length === rows.length ? `${rows.length} cosmetics` : `${shown.length} of ${rows.length} cosmetics`}. To change a file, the backend needs a replace endpoint; it doesn't have one yet.
              </p>
            ) : null}
          </Card>
        </>
      )}

      {uploading && data ? (
        <UploadDialog
          existing={rows}
          onClose={() => setUploading(false)}
          onDone={(msg) => {
            setUploading(false);
            toast(msg);
            void reload();
          }}
        />
      ) : null}
      <PreviewDialog item={preview} onClose={() => setPreview(null)} />
    </>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="field pr-8" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ---------- summary and levels ---------- */

function Summary({ rows }: { rows: VipCosmetic[] }) {
  const levels = new Set(rows.map((r) => r.vipLevel).filter((l) => l >= 1 && l <= 7)).size;
  const stats: [string, string][] = [
    ["Total assets", String(rows.length)],
    ["VIP levels configured", `${levels} / 7`],
    ["SVGA assets", String(rows.filter((r) => r.format === "SVGA").length)],
    ["PNG assets", String(rows.filter((r) => r.format === "PNG").length)],
  ];
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="summary">
      {stats.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-line bg-ink-2 px-4 py-3.5">
          <p className="text-xs font-semibold text-muted">{label}</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-cream">{value}</p>
        </div>
      ))}
    </div>
  );
}

type LevelState = { formats: Record<CosmeticType, string[]>; total: number; done: number };

/** Which slots each level has, from the server's list. A badge counts in either format. */
function levelState(rows: VipCosmetic[], level: number): LevelState {
  const formats = { FRAME: [], BUBBLE: [], ENTRY: [], BADGE: [] } as Record<CosmeticType, string[]>;
  let total = 0;
  for (const r of rows)
    if (r.vipLevel === level) {
      total++;
      const t = r.cosmeticType as CosmeticType;
      if (t in formats && !formats[t].includes(r.format)) formats[t].push(r.format);
    }
  const done = COSMETIC_TYPES.filter((t) => formats[t.value].length > 0).length;
  return { formats, total, done };
}

function LevelsOverview({ rows, active, onPick }: { rows: VipCosmetic[]; active: number | ""; onPick: (level: number) => void }) {
  return (
    <Card title={<span className="flex items-center gap-2"><Layers className="h-4 w-4 text-gold" aria-hidden /> VIP levels</span>}>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7" data-testid="levels">
        {VIP_LEVELS.map((l) => {
          const s = levelState(rows, l);
          const status = s.done === 4 ? "Complete" : s.done === 0 ? "Not Configured" : "Partially Configured";
          return (
            <button
              key={l}
              type="button"
              onClick={() => onPick(l)}
              aria-pressed={active === l}
              aria-label={`VIP ${l}: ${status}. ${active === l ? "Showing only this level; press to show all." : "Press to show only this level."}`}
              className={`rounded-xl border p-3 text-left transition ${active === l ? "border-gold/60 bg-gold/[0.07]" : "border-line hover:border-line-strong hover:bg-cream/[0.03]"}`}
              data-level={l}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-lg font-extrabold">VIP {l}</span>
                <span className="text-[11px] text-muted">{s.total} {s.total === 1 ? "asset" : "assets"}</span>
              </div>
              <div className="mt-1.5">
                <Badge tone={status === "Complete" ? "ok" : status === "Not Configured" ? "muted" : "warn"}>{status}</Badge>
              </div>
              <ul className="mt-2.5 space-y-1 text-xs">
                {COSMETIC_TYPES.map((t) => {
                  const f = s.formats[t.value];
                  return (
                    <li key={t.value} className="flex items-center gap-1.5">
                      {f.length ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-ok" aria-hidden /> : <Circle className="h-3.5 w-3.5 shrink-0 text-muted/60" aria-hidden />}
                      <span className={f.length ? "text-cream/90" : "text-muted"}>{t.label}</span>
                      <span className="ml-auto text-[10px] font-semibold text-muted">{f.length ? f.sort().join(" + ") : "Missing"}</span>
                    </li>
                  );
                })}
              </ul>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------- table ---------- */

function CosmeticTable({ rows, onPreview }: { rows: VipCosmetic[]; onPreview: (c: VipCosmetic) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="text-[11px] tracking-wide text-muted uppercase">
          <tr className="border-b border-line">
            <th className="px-4 py-2.5 font-semibold">Preview</th>
            <th className="px-3 py-2.5 font-semibold">VIP level</th>
            <th className="px-3 py-2.5 font-semibold">Type</th>
            <th className="px-3 py-2.5 font-semibold">Format</th>
            <th className="px-3 py-2.5 font-semibold">File</th>
            <th className="px-3 py-2.5 font-semibold">Uploaded</th>
            <th className="px-3 py-2.5 font-semibold">Status</th>
            <th className="px-4 py-2.5 text-right font-semibold">Asset</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line last:border-0">
              <td className="px-4 py-2">
                <Thumb item={r} onPreview={() => onPreview(r)} />
              </td>
              <td className="px-3 py-2 font-semibold">VIP {r.vipLevel}</td>
              <td className="px-3 py-2">{typeLabel(r.cosmeticType)}</td>
              <td className="px-3 py-2">
                <Badge tone={r.format === "SVGA" ? "coral" : "info"}>{r.format}</Badge>
              </td>
              <td className="max-w-[220px] px-3 py-2">
                <p className="truncate font-mono text-xs text-cream/90" title={r.originalFilename}>
                  {r.originalFilename ?? "—"}
                </p>
                {r.publicId ? (
                  <p className="truncate font-mono text-[10px] text-muted" title={r.publicId}>
                    {r.publicId}
                  </p>
                ) : null}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-cream/80">{when(r.createdAt)}</td>
              <td className="px-3 py-2">{r.secureUrl ? <Badge tone="ok">Available</Badge> : <Badge tone="warn">No file link</Badge>}</td>
              <td className="px-4 py-2 text-right">
                {r.secureUrl ? (
                  <a href={r.secureUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline">
                    Open <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A PNG shows as a small picture; an SVGA gets a play button (they're large, so they only load when asked). */
function Thumb({ item, onPreview }: { item: VipCosmetic; onPreview: () => void }) {
  const [broken, setBroken] = useState(false);
  if (!item.secureUrl)
    return (
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-cream/[0.06]" title="The server sent no file link">
        <ImageOff className="h-4 w-4 text-muted" aria-label="No file link" />
      </span>
    );
  if (item.format === "PNG" && !broken)
    return (
      <button type="button" onClick={onPreview} className="block rounded-xl bg-cream/[0.06]" aria-label={`Preview VIP ${item.vipLevel} ${typeLabel(item.cosmeticType)}`}>
        <img src={item.secureUrl} alt="" loading="lazy" className="h-11 w-11 object-contain" onError={() => setBroken(true)} />
      </button>
    );
  if (item.format === "PNG")
    return (
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-cream/[0.06]" title="The image didn't load">
        <ImageOff className="h-4 w-4 text-muted" aria-label="Image didn't load" />
      </span>
    );
  return (
    <button type="button" onClick={onPreview} className="grid h-11 w-11 place-items-center rounded-xl bg-coral/10 text-[#ff9095] ring-1 ring-coral/25 hover:bg-coral/20" aria-label={`Play VIP ${item.vipLevel} ${typeLabel(item.cosmeticType)} animation`}>
      <Play className="h-4 w-4" />
    </button>
  );
}

function PreviewDialog({ item, onClose }: { item: VipCosmetic | null; onClose: () => void }) {
  return (
    <Modal open={Boolean(item)} onClose={onClose} title={item ? `VIP ${item.vipLevel} · ${typeLabel(item.cosmeticType)} (${item.format})` : ""}>
      {item?.secureUrl ? (
        <div className="space-y-3">
          {item.format === "SVGA" ? (
            <SvgaPlayer src={item.secureUrl} className="mx-auto aspect-square w-full max-w-[320px]" loop />
          ) : (
            <img src={item.secureUrl} alt={`VIP ${item.vipLevel} badge`} className="mx-auto max-h-[320px] rounded-xl bg-cream/[0.04] object-contain" />
          )}
          <p className="truncate text-center font-mono text-xs text-muted">{item.originalFilename}</p>
          <a href={item.secureUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-xs font-semibold text-gold hover:underline">
            Open the file <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
      ) : null}
    </Modal>
  );
}

/* ---------- upload ---------- */

function UploadDialog({ existing, onClose, onDone }: { existing: VipCosmetic[]; onClose: () => void; onDone: (message: string) => void }) {
  const [level, setLevel] = useState<number>(1);
  const [type, setType] = useState<CosmeticType>("FRAME");
  const [format, setFormat] = useState<CosmeticFormat>("SVGA");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const busy = progress !== null;
  const inFlight = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const formats = FORMATS_FOR[type];
  // Keep the format valid when the type changes (only a badge can be a PNG)
  useEffect(() => {
    if (!formats.includes(format)) setFormat(formats[0]);
  }, [formats, format]);
  // Re-check the chosen file against the format
  useEffect(() => setFileError(file ? cosmeticFileProblem(file, format) : null), [file, format]);

  const duplicate = existing.some((c) => c.vipLevel === level && c.cosmeticType === type && c.format === format);

  const pick = (f?: File | null) => {
    if (!f) return;
    setError(null);
    setFile(f);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!busy) pick(e.dataTransfer.files?.[0]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || fileError || duplicate || inFlight.current) return;
    if (!formats.includes(format)) return setError("Pick a format this type allows.");
    inFlight.current = true;
    setError(null);
    setProgress(0);
    try {
      await uploadVipCosmetic(cosmeticForm(file, level, type, format), (f) => setProgress(f)).promise;
      onDone(`VIP ${level} ${typeLabel(type).toLowerCase()} (${format}) uploaded`);
    } catch (err) {
      // Keep the file and the choices so it can be sent again
      setError(err instanceof Error ? err.message : "The upload failed.");
    } finally {
      inFlight.current = false;
      setProgress(null);
    }
  };

  const accept = format === "SVGA" ? ".svga" : ".png,image/png";

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Upload Cosmetic">
      <form onSubmit={submit} className="space-y-4" noValidate aria-label="Upload cosmetic">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="cos-level" label="VIP level">
            <select id="cos-level" className="field" value={level} onChange={(e) => setLevel(Number(e.target.value))} disabled={busy} required>
              {VIP_LEVELS.map((l) => (
                <option key={l} value={l}>
                  VIP {l}
                </option>
              ))}
            </select>
          </Field>
          <Field id="cos-type" label="Cosmetic type">
            <select id="cos-type" className="field" value={type} onChange={(e) => setType(e.target.value as CosmeticType)} disabled={busy} required>
              {COSMETIC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="cos-format" label="Format">
            <select id="cos-format" className="field" value={format} onChange={(e) => setFormat(e.target.value as CosmeticFormat)} disabled={busy || formats.length === 1} required>
              {formats.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted">Frames, bubbles and entry animations are SVGA only. A badge can be SVGA or PNG.</p>

        <div>
          <span className="label" id="cos-file-label">
            File
          </span>
          <input ref={input} id="cos-file" type="file" className="sr-only" accept={accept} aria-labelledby="cos-file-label" onChange={(e) => pick(e.target.files?.[0])} disabled={busy} />
          {file ? (
            <div className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${fileError ? "border-coral/40 bg-coral/[0.06]" : "border-line bg-cream/[0.03]"}`} data-testid="picked-file">
              {format === "SVGA" ? <Sparkles className="h-5 w-5 shrink-0 text-[#ff9095]" aria-hidden /> : <FileUp className="h-5 w-5 shrink-0 text-info" aria-hidden />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm text-cream">{file.name}</p>
                <p className="text-xs text-muted">{fileSize(file.size)}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => input.current?.click()} disabled={busy}>
                Change
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFile(null);
                  if (input.current) input.current.value = "";
                }}
                disabled={busy}
                aria-label="Remove file"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-7 text-center text-sm transition ${dragging ? "border-gold bg-gold/[0.06]" : "border-line-strong hover:bg-cream/[0.03]"}`}
              data-testid="dropzone"
            >
              <Upload className="h-5 w-5 text-muted" aria-hidden />
              <span className="font-semibold text-cream">Drop a {format === "SVGA" ? ".svga" : ".png"} file here, or choose one</span>
              <span className="text-xs text-muted">Up to 15 MB</span>
            </button>
          )}
          {fileError ? (
            <p className="mt-1.5 text-xs text-[#ff9095]" role="alert">
              {fileError}
            </p>
          ) : null}
        </div>

        {duplicate ? (
          <p className="rounded-xl bg-warn/10 px-3.5 py-2.5 text-sm text-warn ring-1 ring-warn/30" role="status">
            VIP {level} already has a {typeLabel(type).toLowerCase()} in {format}. The backend keeps one per level, type and format and has no replace endpoint yet, so this can't be uploaded again.
          </p>
        ) : null}

        {busy ? (
          <div aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-cream/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress ?? 0) * 100)} aria-label="Upload progress">
              <div className="h-full rounded-full bg-gold transition-[width]" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">{(progress ?? 0) >= 1 ? "Sent. Waiting for the server to store it…" : `Uploading… ${Math.round((progress ?? 0) * 100)}%`}</p>
          </div>
        ) : null}

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-[1.4]" busy={busy} disabled={!file || Boolean(fileError) || duplicate}>
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Previews and upload slots for server media: pictures (PNG/JPG/JPEG), SVGA and
 * MP4 animations, and MP3 sounds. Used by Gifts and Spend rewards.
 */
import { useRef, useState } from "react";
import { FileUp, Music, Trash2, Upload as UploadIcon, X } from "lucide-react";
import type { Upload } from "../lib/api";
import { API_BASE_URL } from "../config/api";
import { checkSvgaPlays, SvgaPlayer } from "./media";
import { Button } from "./ui";

export type Media = { url: string | null; format: string | null };

/**
 * A loadable link for a file on our server. The backend keeps uploads on its own
 * disk and sends paths like "/uploads/media/…": in development Vite forwards
 * /uploads to it; a production build loads them from the backend's address.
 */
export const mediaHref = (url: string | null | undefined): string | null => (!url ? null : url.startsWith("/") ? `${API_BASE_URL}${url}` : url);

const MAX_MB: Record<string, number> = { png: 10, jpg: 10, jpeg: 10, svga: 100, mp4: 100, mp3: 20 };

/** Format from a URL or file name (".../x.svga" → SVGA). */
export const formatOf = (name: string) => (name.split("?")[0].split(".").pop() ?? "").toUpperCase();

/** Shows any supported media the way the app would. */
export function MediaPreview({ media, size = 64, loop = true }: { media: Media; size?: number; loop?: boolean }) {
  const url = mediaHref(media.url);
  const format = (media.format ?? (url ? formatOf(url) : "")).toUpperCase();
  const box = { width: size, height: size };
  if (!url)
    return (
      <span style={box} className="grid shrink-0 place-items-center rounded-xl bg-ink text-muted ring-1 ring-line">
        <FileUp className="h-4 w-4" aria-hidden />
      </span>
    );
  if (format === "SVGA")
    return (
      <span style={box} className="block shrink-0">
        <SvgaPlayer src={url} loop={loop} className="h-full w-full" />
      </span>
    );
  if (format === "MP4")
    return <video src={url} style={box} className="shrink-0 rounded-xl bg-ink object-contain ring-1 ring-line" muted loop={loop} autoPlay playsInline />;
  if (format === "MP3")
    return (
      <span style={box} className="grid shrink-0 place-items-center rounded-xl bg-ink text-gold ring-1 ring-line" title="Sound">
        <Music className="h-5 w-5" aria-hidden />
      </span>
    );
  return <img src={url} alt="" style={box} className="shrink-0 rounded-xl bg-ink object-contain ring-1 ring-line" />;
}

/** Why a file can't be used here, or null. */
export function fileProblem(file: File, exts: string[]): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!exts.includes(ext)) return `“${file.name}” isn't ${exts.map((e) => e.toUpperCase()).join(", ")}.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  const max = MAX_MB[ext] ?? 5;
  if (file.size > max * 1024 * 1024) return `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB. ${ext.toUpperCase()} files can be up to ${max} MB.`;
  return null;
}

/** Checks a file before it's sent: type, size, and that an SVGA actually plays. */
export async function checkFile(file: File, exts: string[]) {
  const problem = fileProblem(file, exts);
  if (problem) throw new Error(problem);
  if (file.name.toLowerCase().endsWith(".svga")) await checkSvgaPlays(file);
}

/**
 * One file slot: shows what's there, uploads a new file (replacing the old one)
 * with progress, and can remove it when `onRemove` is given.
 */
export function UploadSlot<T>({
  label,
  hint,
  exts,
  current,
  upload,
  onDone,
  onRemove,
  onError,
}: {
  label: string;
  hint?: string;
  exts: string[];
  current: Media;
  upload: (file: File, onProgress: (f: number) => void) => Upload<T>;
  onDone: (result: T) => void;
  onRemove?: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [abort, setAbort] = useState<(() => void) | null>(null);
  const [removing, setRemoving] = useState(false);

  const pick = async (file?: File) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    try {
      await checkFile(file, exts);
    } catch (e) {
      onError(e instanceof Error ? e.message : "That file can't be used.");
      return;
    }
    setProgress(0);
    const u = upload(file, setProgress);
    setAbort(() => u.abort);
    try {
      onDone(await u.promise);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setProgress(null);
      setAbort(null);
    }
  };

  const remove = async () => {
    if (!onRemove) return;
    setRemoving(true);
    try {
      await onRemove();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't remove it.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-ink/40 p-3">
      <div className="flex items-center gap-3">
        <MediaPreview media={current} size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-[11.5px] leading-snug text-muted">
            {current.url ? `${(current.format ?? formatOf(current.url)) || "File"} uploaded` : (hint ?? exts.map((e) => e.toUpperCase()).join(", "))}
          </p>
          {progress !== null ? (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream/10" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${label}`}>
              <div className="h-full bg-gold transition-all" style={{ width: `${Math.max(4, progress * 100)}%` }} />
            </div>
          ) : null}
        </div>
        {progress !== null ? (
          <Button size="sm" variant="ghost" onClick={() => abort?.()} aria-label="Cancel upload">
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <span className="flex shrink-0 gap-1.5">
            <Button size="sm" onClick={() => input.current?.click()}>
              <UploadIcon className="h-3.5 w-3.5" /> {current.url ? "Replace" : "Upload"}
            </Button>
            {current.url && onRemove ? (
              <Button size="sm" variant="ghost" busy={removing} onClick={remove} aria-label={`Remove ${label}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </span>
        )}
      </div>
      <input ref={input} type="file" hidden accept={exts.map((e) => `.${e}`).join(",")} onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}

/**
 * Picks a file, checks it, uploads it to the backend's Shop assets endpoint
 * and hands back the reference to store in the product's assetUrl.
 */
import { useEffect, useRef, useState } from "react";
import { ImageOff, ImageUp, Loader2, RotateCcw, X } from "lucide-react";
import { ASSET_ACCEPT, ASSET_KINDS_TEXT, assetFileProblem, isSvgaRef, loadAsset, uploadShopAsset } from "../services/shopAssetService";
import { SvgaPlayer } from "./media";
import { Button } from "./ui";

/** Loads an uploaded file for display. url is a blob: or plain link; error says why it didn't load. */
export function useAsset(ref?: string | null) {
  const [state, setState] = useState<{ ref: string | null; url: string | null; error: string | null }>({ ref: null, url: null, error: null });
  useEffect(() => {
    let live = true;
    if (!ref) return;
    loadAsset(ref)
      .then((url) => live && setState({ ref, url, error: null }))
      .catch((e: unknown) => live && setState({ ref, url: null, error: e instanceof Error ? e.message : "Couldn't load the file." }));
    return () => {
      live = false;
    };
  }, [ref]);
  // Only answer for the ref asked about, never with the previous file's result
  const current = Boolean(ref) && state.ref === ref;
  return { url: current ? state.url : null, error: current ? state.error : null, loading: Boolean(ref) && !current };
}

const fileSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * Shows an uploaded asset: a picture with <img>, an SVGA animation with the SVGA player.
 * When the type isn't known (the product API doesn't send assetType and the link has no
 * .svga ending), it tries a picture first and then the SVGA player before giving up.
 */
export function AssetMedia({ src, svga, size, alt = "", onFail }: { src: string; svga: boolean; size: number; alt?: string; onFail?: (msg: string) => void }) {
  const [mode, setMode] = useState<"image" | "svga" | "failed">(svga ? "svga" : "image");
  const failRef = useRef(onFail);
  failRef.current = onFail;
  useEffect(() => setMode(svga ? "svga" : "image"), [src, svga]);
  useEffect(() => {
    if (mode === "failed") failRef.current?.(svga ? "This SVGA animation couldn't be played. Make sure it's an SVGA 2.x file." : "This file couldn't be shown as a picture or an SVGA animation.");
  }, [mode, svga]);
  const box = { width: size, height: size };
  if (mode === "svga")
    return (
      <span className="block shrink-0" style={box}>
        <SvgaPlayer key={src} src={src} className="h-full w-full" loop onError={() => setMode("failed")} />
      </span>
    );
  if (mode === "image") return <img src={src} alt={alt} style={box} className="shrink-0 rounded-xl object-contain" onError={() => setMode(svga ? "failed" : "svga")} />;
  return (
    <span className="grid shrink-0 place-items-center rounded-xl bg-cream/[0.06]" style={box}>
      <ImageOff className="h-4 w-4 text-muted" aria-label="File didn't load" />
    </span>
  );
}

export type AssetUploadState = "idle" | "uploading" | "failed";

type Props = {
  id: string;
  /** The saved reference (assetUrl or assetPath), or "" for none. */
  value: string;
  onChange: (ref: string) => void;
  /** Lets the form block saving while an upload runs or after one failed. */
  onStateChange: (s: AssetUploadState) => void;
};

export function AssetUpload({ id, value, onChange, onStateChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  /** assetType from the last upload, for the link it came with. */
  const [uploadedType, setUploadedType] = useState<{ ref: string; type?: string } | null>(null);
  const abort = useRef<(() => void) | null>(null);
  const seq = useRef(0);
  const stateRef = useRef(onStateChange);
  stateRef.current = onStateChange;
  const remote = useAsset(value || null);

  // Free the preview's object URL when it's replaced or the form closes
  useEffect(() => () => void (localUrl && URL.revokeObjectURL(localUrl)), [localUrl]);
  // Closing the form stops an upload that's still running
  useEffect(() => () => abort.current?.(), []);
  useEffect(() => setMediaError(null), [remote.url]);

  const start = (f: File) => {
    const run = ++seq.current;
    abort.current?.();
    setError(null);
    setFailed(false);
    setProgress(0);
    stateRef.current("uploading");
    const up = uploadShopAsset(f, (p) => run === seq.current && setProgress(p));
    abort.current = up.abort;
    up.promise
      .then((asset) => {
        if (run !== seq.current) return;
        setUploadedType({ ref: asset.ref, type: asset.assetType });
        onChange(asset.ref);
        stateRef.current("idle");
      })
      .catch((e: unknown) => {
        if (run !== seq.current) return;
        setError(e instanceof Error ? e.message : "The upload failed.");
        setFailed(true);
        stateRef.current("failed");
      })
      .finally(() => {
        if (run !== seq.current) return;
        setProgress(null);
        abort.current = null;
      });
  };

  const pick = (f: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!f) return;
    const problem = assetFileProblem(f);
    if (problem) {
      // Keep whatever was there before; a bad pick doesn't remove the current file
      setError(problem);
      return;
    }
    setFile(f);
    setLocalUrl(URL.createObjectURL(f));
    start(f);
  };

  const clear = () => {
    seq.current++;
    abort.current?.();
    abort.current = null;
    setFile(null);
    setLocalUrl(null);
    setProgress(null);
    setError(null);
    setFailed(false);
    onChange("");
    stateRef.current("idle");
  };

  const uploading = progress !== null;
  const pct = Math.round((progress ?? 0) * 100);
  // While uploading or after a failure show the picked file; once saved, the backend's copy
  const showLocal = uploading || failed;
  const typeOf = (ref: string) => (uploadedType?.ref === ref && uploadedType.type ? uploadedType.type === "SVGA" : isSvgaRef(ref));
  const svga = showLocal ? Boolean(file && isSvgaRef(file.name)) : value ? typeOf(value) : Boolean(file && isSvgaRef(file.name));
  const shown = showLocal ? localUrl : remote.url;
  const loadError = !showLocal && value ? (remote.error ?? mediaError) : null;
  const kindLabel = svga ? "SVGA animation" : "Image";

  return (
    <div>
      <input ref={input} id={id} type="file" accept={ASSET_ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files?.[0])} disabled={uploading} />
      <div className="flex flex-col gap-3 rounded-xl bg-ink px-3 py-3 ring-1 ring-line sm:flex-row sm:items-center">
        <div className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-cream/[0.06] ${svga && shown ? "h-28 w-28" : "h-20 w-20"}`}>
          {shown ? (
            <AssetMedia key={shown} src={shown} svga={svga} size={svga ? 112 : 80} alt={`${kindLabel} preview`} onFail={(m) => (showLocal ? setError(m) : setMediaError(m))} />
          ) : remote.loading && value ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label="Loading preview" />
          ) : loadError ? (
            <ImageOff className="h-5 w-5 text-muted" aria-hidden />
          ) : (
            <ImageUp className="h-6 w-6 text-muted" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 text-xs">
          {file && (uploading || failed || value) ? (
            <p className="truncate text-sm font-semibold text-cream">
              {file.name} <span className="font-normal text-muted">· {fileSize(file.size)}</span>
            </p>
          ) : value ? (
            <p className="truncate text-sm font-semibold text-cream">Current {kindLabel.toLowerCase()}</p>
          ) : null}
          {uploading ? (
            <div className="mt-1.5" role="status" aria-live="polite">
              <p className="flex items-center gap-1.5 text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Uploading… {pct}%
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Upload progress">
                <div className="h-full rounded-full bg-gold transition-[width]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ) : error ? (
            <p role="alert" className="mt-1 leading-snug text-[#ff9095]">
              {error}
            </p>
          ) : value && loadError ? (
            <p className="mt-1 leading-snug text-warn">Saved, but the preview didn't load. {loadError}</p>
          ) : value ? (
            <p className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-ok">{file ? "Uploaded" : "Saved with this product"}</span>
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ring-1 ${svga ? "bg-coral/15 text-[#ff9095] ring-coral/30" : "bg-cream/[0.06] text-muted ring-line-strong"}`}>{kindLabel}</span>
            </p>
          ) : (
            <p className="mt-1 leading-snug text-muted">{ASSET_KINDS_TEXT}, up to 5 MB.</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {failed && file ? (
            <Button size="sm" variant="ghost" onClick={() => start(file)}>
              <RotateCcw className="h-3.5 w-3.5" /> Try again
            </Button>
          ) : null}
          <Button size="sm" variant={value || file ? "ghost" : "gold"} onClick={() => input.current?.click()} disabled={uploading} aria-controls={id}>
            <ImageUp className="h-3.5 w-3.5" /> {value || file ? "Replace file" : "Upload file"}
          </Button>
          {value || file ? (
            <Button size="sm" variant="ghost" onClick={clear} aria-label="Remove file" title={uploading ? "Cancel upload" : "Remove file"}>
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

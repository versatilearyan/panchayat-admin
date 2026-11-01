/**
 * Uploads or replaces a product's image: pick a file, check it (JPEG, PNG or WebP, up to 5 MB),
 * preview it, then send it with progress. Used by Coin packs and Red packets; each passes the
 * upload call for its own endpoint. Nothing is shown as saved until the server answers.
 */
import { useEffect, useRef, useState } from "react";
import { ImageUp, Upload as UploadIcon } from "lucide-react";
import { useAdmin } from "../context";
import type { Upload } from "../lib/api";
import { packImageProblem, PACK_IMAGE_ACCEPT } from "../services/coinPackService";
import { Button, ErrorNote } from "./ui";
import { ProductImage } from "./WalletParts";

export function ImageUploadForm({
  item: pack,
  justCreated,
  onClose,
  upload: send,
  inputId,
}: {
  item: { id: number | string; name: string; imageUrl: string | null };
  justCreated?: boolean;
  onClose: () => void;
  /** Sends the file with the admin token (multipart, field "file") and resolves with the saved imageUrl. */
  upload: (file: File, onProgress: (fraction: number) => void) => Upload<{ imageUrl: string }>;
  inputId: string;
}) {
  const { changed, toast } = useAdmin();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(pack.imageUrl);
  const [done, setDone] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  // Closing the dialog mid-upload cancels it
  useEffect(() => () => abortRef.current?.(), []);

  const pick = (f: File | undefined) => {
    setError(null);
    setDone(false);
    if (!f) return;
    const p = packImageProblem(f);
    setProblem(p);
    setFile(p ? null : f);
  };

  const upload = async () => {
    if (!file || progress !== null) return;
    setError(null);
    setProgress(0);
    const up = send(file, setProgress);
    abortRef.current = up.abort;
    try {
      const res = await up.promise;
      setCurrent(res.imageUrl);
      setFile(null);
      setDone(true);
      toast(`Image ${pack.imageUrl ? "replaced" : "added"} for ${pack.name}`);
      changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed");
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };

  const uploading = progress !== null;
  return (
    <div className="space-y-4">
      {justCreated ? <p className="rounded-xl bg-ok/10 px-3.5 py-2.5 text-sm text-ok">{pack.name} was created. Add its image now, or skip and do it later from the list.</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <figure className="rounded-2xl border border-line p-3 text-center">
          <div className="grid h-28 place-items-center">
            <ProductImage key={current ?? "none"} url={current} name={pack.name} size={96} />
          </div>
          <figcaption className="mt-2 text-xs text-muted">{done ? "New image (saved)" : current ? "Current image" : "No image yet"}</figcaption>
        </figure>
        <figure className="rounded-2xl border border-dashed border-line-strong p-3 text-center">
          <div className="grid h-28 place-items-center">
            {preview ? <img src={preview} alt="Selected image preview" className="h-24 w-24 rounded-xl object-contain" /> : <UploadIcon className="h-6 w-6 text-muted" aria-hidden />}
          </div>
          <figcaption className="mt-2 truncate text-xs text-muted">{file ? file.name : "Selected image"}</figcaption>
        </figure>
      </div>
      <input ref={inputRef} type="file" accept={PACK_IMAGE_ACCEPT} className="sr-only" id={inputId} onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <ImageUp className="h-4 w-4" /> {file ? "Pick another" : "Choose image"}
        </Button>
        <span className="text-xs text-muted">JPEG, PNG or WebP, up to 5 MB.</span>
      </div>
      {problem ? <ErrorNote>{problem}</ErrorNote> : null}
      {uploading ? (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-cream/10" role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress! * 100)}>
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${Math.max(4, progress! * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">{progress! >= 1 ? "Processing on the server…" : `Uploading… ${Math.round(progress! * 100)}%`}</p>
        </div>
      ) : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" onClick={uploading ? () => abortRef.current?.() : onClose} className="flex-1">
          {uploading ? "Cancel upload" : done || justCreated ? "Done" : "Close"}
        </Button>
        <Button variant="primary" busy={uploading} disabled={!file} onClick={upload} className="flex-[1.4]">
          {current && !done ? "Replace image" : "Upload image"}
        </Button>
      </div>
    </div>
  );
}

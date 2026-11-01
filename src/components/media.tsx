/** SVGA previews, uploaded images and the file picker used by Gifts and Shop items. */
import { useEffect, useRef, useState } from "react";
import { FileUp, Loader2, Play, RotateCcw, Trash2 } from "lucide-react";
import { Parser, Player } from "svga";
import { adminApi, type FileRef } from "../api";
import { fileUrl } from "../api/files";
import { Button } from "./ui";

/** Resolves a file ref (demo IndexedDB or a URL) to something <img> or the SVGA parser can load. */
export function useFileUrl(ref?: FileRef) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (ref) fileUrl(ref).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [ref]);
  return url;
}

export function FileImage({ fileRef, alt = "", className = "" }: { fileRef?: FileRef; alt?: string; className?: string }) {
  const url = useFileUrl(fileRef);
  return url ? <img src={url} alt={alt} className={`object-contain ${className}`} /> : null;
}

type SvgaState = "loading" | "playing" | "ended" | "error";

/**
 * Plays an SVGA file on a canvas, the way the app shows a gift.
 * `src` is a ref or a blob URL. Calls onError when the file can't be read.
 */
export function SvgaPlayer({ src, className = "", loop = false, onError }: { src?: FileRef | string; className?: string; loop?: boolean; onError?: (msg: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const player = useRef<Player | null>(null);
  const [state, setState] = useState<SvgaState>("loading");
  const errRef = useRef(onError);
  errRef.current = onError;

  useEffect(() => {
    if (!src || !canvas.current) return;
    let live = true;
    const parser = new Parser({ isDisableWebWorker: true });
    setState("loading");
    (async () => {
      const url = src.startsWith("blob:") ? src : await fileUrl(src);
      if (!url) throw new Error("missing");
      const video = await parser.load(url);
      if (!live || !canvas.current) return;
      const p = new Player({ container: canvas.current, loop: loop ? 0 : 1, isUseIntersectionObserver: false });
      player.current = p;
      await p.mount(video);
      p.onEnd = () => live && setState("ended");
      p.start();
      setState("playing");
    })().catch(() => {
      if (!live) return;
      setState("error");
      errRef.current?.("This file couldn't be played. Make sure it's an SVGA 2.x file (exported with the SVGA converter).");
    });
    return () => {
      live = false;
      player.current?.destroy();
      player.current = null;
      parser.destroy();
    };
  }, [src, loop]);

  const replay = () => {
    player.current?.stop();
    player.current?.start();
    setState("playing");
  };

  return (
    <div className={`relative grid place-items-center overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_40%,#2a2030,#111114_70%)] ring-1 ring-line ${className}`}>
      <canvas ref={canvas} className="h-full w-full object-contain" />
      {state === "loading" ? <Loader2 className="absolute h-6 w-6 animate-spin text-muted" aria-label="Loading animation" /> : null}
      {state === "error" ? <p className="absolute px-4 text-center text-xs text-[#ff9095]">Can't play this SVGA</p> : null}
      {state === "ended" ? (
        <button type="button" onClick={replay} className="absolute inset-0 grid place-items-center bg-black/30 text-cream" aria-label="Play again">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-cream/15 backdrop-blur">
            <RotateCcw className="h-5 w-5" />
          </span>
        </button>
      ) : null}
    </div>
  );
}

/**
 * Picks a file, uploads it and hands back its ref.
 * SVGA files are test-played before they're accepted, so a broken file can't reach the app.
 */
export function FileField({
  kind,
  value,
  onChange,
  label,
  hint,
}: {
  kind: "svga" | "image";
  value?: FileRef;
  onChange: (ref: FileRef | undefined) => void;
  label: string;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);

  const pick = async (file?: File) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      if (kind === "svga") await checkSvgaPlays(file);
      onChange(await adminApi.uploadFile(file, kind));
      setName(file.name);
      setShowPlayer(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-start gap-3">
        {kind === "image" ? (
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-ink ring-1 ring-line">
            {value ? <FileImage fileRef={value} className="h-16 w-16" /> : <FileUp className="h-5 w-5 text-muted" aria-hidden />}
          </div>
        ) : value && showPlayer ? (
          <SvgaPlayer src={value} className="h-36 w-36 shrink-0" />
        ) : (
          <button
            type="button"
            onClick={() => (value ? setShowPlayer(true) : input.current?.click())}
            className="grid h-36 w-36 shrink-0 place-items-center rounded-2xl bg-ink text-muted ring-1 ring-line hover:text-cream"
            aria-label={value ? "Play animation" : "Upload SVGA"}
          >
            {value ? <Play className="h-6 w-6" /> : <FileUp className="h-6 w-6" />}
          </button>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <input ref={input} type="file" className="hidden" accept={kind === "svga" ? ".svga" : "image/png,image/jpeg,image/webp,image/gif"} onChange={(e) => pick(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="soft" busy={busy} onClick={() => input.current?.click()}>
              <FileUp className="h-3.5 w-3.5" /> {value ? "Replace" : kind === "svga" ? "Upload .svga" : "Upload image"}
            </Button>
            {value ? (
              <Button size="sm" variant="ghost" onClick={() => (onChange(undefined), setName(null), setShowPlayer(false))}>
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            ) : null}
          </div>
          {name ? <p className="truncate text-xs text-cream/80">{name}</p> : value ? <p className="text-xs text-ok">Uploaded</p> : null}
          {hint ? <p className="text-xs leading-snug text-muted">{hint}</p> : null}
          {error ? <p className="text-xs leading-snug text-[#ff9095]">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

/** Parses an SVGA file in memory. Rejects files that aren't valid SVGA 2.x. */
async function checkSvgaPlays(file: File) {
  if (!file.name.toLowerCase().endsWith(".svga")) throw new Error("Pick an .svga file");
  const url = URL.createObjectURL(file);
  const parser = new Parser({ isDisableWebWorker: true });
  try {
    const video = await parser.load(url);
    if (!video.frames) throw new Error("empty");
  } catch {
    throw new Error("This file couldn't be read as an SVGA animation. Export it as SVGA 2.x and try again.");
  } finally {
    parser.destroy();
    URL.revokeObjectURL(url);
  }
}

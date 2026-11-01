/** Pieces shared by the Coin Packs and Red Packet Products pages. */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Lock, PlugZap, RotateCcw, Search, ServerCrash } from "lucide-react";
import { ApiError } from "../lib/api";
import { AssetMedia, useAsset } from "./AssetUpload";
import { Button, Card, Modal, timeAgo } from "./ui";

/* ---------- loading a list, keeping the error kind ---------- */

export type ListError = { message: string; kind: ApiError["kind"] | "unknown" };

export function useList<T>(fn: () => Promise<T[]>, version: number) {
  const [data, setData] = useState<T[] | null>(null);
  const [error, setError] = useState<ListError | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, [version, retry]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    run()
      .then((d) => {
        if (!live) return;
        if (!Array.isArray(d)) throw new ApiError("The server sent a reply the panel couldn't read as a list.", 200, "bad_response");
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => live && setError({ message: e instanceof Error ? e.message : "Something went wrong.", kind: e instanceof ApiError ? e.kind : "unknown" }))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [run]);
  return { data, error, loading, retry: () => setRetry((n) => n + 1) };
}

/** A failed load: access denied gets its own message; everything else offers Retry. */
export function ListProblem({ error, onRetry }: { error: ListError; onRetry: () => void }) {
  if (error.kind === "forbidden")
    return (
      <Card>
        <div className="px-4 py-10 text-center text-sm text-muted">
          <Lock className="mx-auto mb-2 h-6 w-6" aria-hidden />
          <p className="font-semibold text-cream">Access denied</p>
          <p className="mt-1">Only a Super Admin can manage this. The server turned down your account for it.</p>
        </div>
      </Card>
    );
  return (
    <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-[#3a1418] px-3.5 py-2.5 text-sm text-[#ffb0b4]">
      <ServerCrash className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{error.message}</span>
      <Button size="sm" variant="danger" onClick={onRetry}>
        <RotateCcw className="h-3.5 w-3.5" /> Retry
      </Button>
    </div>
  );
}

/** Shown instead of the page when VITE_API_BASE_URL isn't set. These pages have no demo data. */
export function NeedsBackend({ what }: { what: string }) {
  return (
    <Card>
      <div className="px-4 py-12 text-center text-sm text-muted">
        <PlugZap className="mx-auto mb-2 h-6 w-6" aria-hidden />
        <p className="font-semibold text-cream">Connect the backend to manage {what}</p>
        <p className="mt-1">
          Add <code className="rounded bg-cream/10 px-1">VITE_API_BASE_URL</code> to <code className="rounded bg-cream/10 px-1">.env.local</code> and restart the panel. This page only shows live data from the server.
        </p>
      </div>
    </Card>
  );
}

/* ---------- table helpers ---------- */

export const fmtInr = (n: number) => {
  const v = Number(n);
  return `₹${v.toLocaleString("en-IN", Number.isInteger(v) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function updatedAgo(at?: string | null) {
  const t = at ? Date.parse(at) : NaN;
  return Number.isFinite(t) ? timeAgo(t) : "—";
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/10 px-2 py-0.5 text-[11px] font-bold text-ok ring-1 ring-ok/25">
      <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/[0.06] px-2 py-0.5 text-[11px] font-bold text-muted ring-1 ring-line-strong">
      <span className="h-1.5 w-1.5 rounded-full bg-muted" aria-hidden /> Inactive
    </span>
  );
}

/** The product's current image, or its first letter when it has none. */
export function ProductImage({ url, name, size = 44 }: { url?: string | null; name: string; size?: number }) {
  const asset = useAsset(url);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (asset.url && !failed) return <AssetMedia key={asset.url} src={asset.url} svga={false} size={size} alt={name} onFail={() => setFailed(true)} />;
  const broken = Boolean(url && (asset.error || failed));
  return (
    <span className="grid shrink-0 place-items-center rounded-xl bg-cream/[0.06] font-display font-bold text-cream/70" style={{ width: size, height: size }} title={broken ? (asset.error ?? "The image didn't load") : url ? undefined : "No image yet"}>
      {broken ? <ImageOff className="h-4 w-4 text-muted" aria-label="Image didn't load" /> : asset.loading ? null : name.slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

/* ---------- search and frontend paging ---------- */

const PAGE_SIZE = 20;

/** Filters by text and shows PAGE_SIZE rows at a time. The backend returns whole lists, so this is all in the browser. */
export function useSearchPages<T>(rows: T[], text: (row: T) => string) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? rows.filter((r) => text(r).toLowerCase().includes(needle)) : rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  return {
    q,
    setQ: (v: string) => {
      setQ(v);
      setPage(0);
    },
    shown: filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE),
    total: filtered.length,
    page: current,
    pages,
    setPage,
  };
}

export function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="relative block w-full sm:w-64">
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input type="search" className="field pl-9" placeholder={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-muted">
      <span>
        Page {page + 1} of {pages} · {total} total
      </span>
      <span className="flex gap-1.5">
        <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </span>
    </nav>
  );
}

/* ---------- confirm ---------- */

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onClose,
  confirmVariant = "danger",
}: {
  confirmVariant?: "danger" | "primary" | "gold" | "ok";
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title}>
      <div className="space-y-4 text-sm text-cream/85">
        {children}
        {error ? <p className="rounded-xl bg-[#3a1418] px-3.5 py-2.5 text-[#ffb0b4]">{error}</p> : null}
        <div className="flex gap-2 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={confirmVariant} className="flex-[1.4]" busy={busy} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- form fields ---------- */

export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-xs text-[#ff9095]">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Reads a whole number field. Returns the number, or a message. */
export function wholeNumber(raw: string, { min, required = true, name }: { min: number; required?: boolean; name: string }): number | string | null {
  const v = raw.replace(/,/g, "").trim();
  if (!v) return required ? `Enter ${name}.` : null;
  if (!/^-?\d+$/.test(v)) return `${cap(name)} must be a whole number.`;
  const n = Number(v);
  if (!Number.isSafeInteger(n)) return `${cap(name)} is too large.`;
  if (n < min) return min === 0 ? `${cap(name)} can't be negative.` : `${cap(name)} must be at least ${min.toLocaleString("en-IN")}.`;
  return n;
}

/** Reads a rupee amount with at most 2 decimals. */
export function rupees(raw: string, { min = 0, name = "the price" }: { min?: number; name?: string } = {}): number | string {
  const v = raw.replace(/,/g, "").replace(/^₹/, "").trim();
  if (!v) return `Enter ${name}.`;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return `${cap(name)} must be a number with at most 2 decimals.`;
  const n = Number(v);
  if (n <= min) return `${cap(name)} must be more than ₹${min}.`;
  return n;
}

/** Reads a percentage with at most 2 decimals, 0 to 100. */
export function percent(raw: string, name: string): number | string {
  const v = raw.trim().replace(/%$/, "");
  if (!v) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return `${cap(name)} must be a number with at most 2 decimals.`;
  const n = Number(v);
  if (n > 100) return `${cap(name)} can't be more than 100.`;
  return n;
}

const cap = (s: string) => {
  const t = s.replace(/^(the|a|an) /, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
};


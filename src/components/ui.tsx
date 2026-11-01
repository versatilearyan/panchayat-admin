/** Small building blocks shared by every admin screen. */
import { useCallback, useEffect, useId, useState, type ButtonHTMLAttributes, type DependencyList, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import type { Sanction, UserStatus } from "../api";

/* ---------------- formatting ---------------- */

export const fmtCoins = (n: number) => n.toLocaleString("en-IN");

export function timeAgo(at: number) {
  const s = Math.round((Date.now() - at) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export const fmtDate = (at: number) => new Date(at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function untilText(s: Pick<Sanction, "expiresAt">) {
  return s.expiresAt === null ? "Permanent" : `Until ${fmtDate(s.expiresAt)}`;
}

/* ---------------- data loading ---------------- */

/** Loads data with an async call and reloads when deps change. */
export function useLoad<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  useEffect(() => {
    let live = true;
    setLoading(true);
    run()
      .then((d) => live && (setData(d), setError(null)))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : "Something went wrong"))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [run]);
  return { data, error, loading };
}

/* ---------------- buttons ---------------- */

type Variant = "primary" | "gold" | "ghost" | "soft" | "danger" | "ok";
const VARIANT: Record<Variant, string> = {
  primary: "bg-coral text-white hover:bg-[#f7646d]",
  gold: "bg-gradient-to-b from-[#f6d899] to-[#c9954a] text-[#2a1a0c] hover:brightness-105",
  ghost: "border border-line-strong text-cream hover:bg-cream/5",
  soft: "bg-cream/[0.07] text-cream hover:bg-cream/[0.12]",
  danger: "bg-[#3a1418] text-[#ff9095] hover:bg-[#4a1a20]",
  ok: "bg-[#14301f] text-ok hover:bg-[#183a26]",
};

export function Button({
  variant = "soft",
  size = "md",
  busy = false,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; busy?: boolean }) {
  const sz = size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm";
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${sz} ${VARIANT[variant]} ${className}`}
      disabled={busy || rest.disabled}
      {...rest}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

/* ---------------- avatar and badges ---------------- */

export function Avatar({ name, color, photoUrl, size = 36 }: { name: string; color: string; photoUrl?: string; size?: number }) {
  return photoUrl ? (
    <img src={photoUrl} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-display font-bold text-cream ring-1 ring-cream/10"
      style={{ width: size, height: size, background: `linear-gradient(145deg, ${color}, #16151a)`, fontSize: size * 0.4 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

type Tone = "coral" | "gold" | "ok" | "warn" | "info" | "muted";
const TONE: Record<Tone, string> = {
  coral: "bg-coral/15 text-[#ff9095] ring-coral/30",
  gold: "bg-gold/12 text-gold ring-gold/30",
  ok: "bg-ok/10 text-ok ring-ok/25",
  warn: "bg-warn/12 text-warn ring-warn/30",
  info: "bg-info/12 text-info ring-info/30",
  muted: "bg-cream/[0.06] text-muted ring-line-strong",
};

export function Badge({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${TONE[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: UserStatus }) {
  return status === "banned" ? <Badge tone="coral">Banned</Badge> : status === "muted" ? <Badge tone="warn">Muted</Badge> : <Badge tone="ok">Active</Badge>;
}

/* ---------------- layout ---------------- */

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-ink-2 ${className}`}>
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="font-display text-[15px] font-bold">{title}</h2>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-[28px]">{title}</h1>
        {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-muted">{children}</p>;
}

export function Loading() {
  return (
    <div className="grid place-items-center py-14 text-muted">
      <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading" />
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-[#3a1418] px-3.5 py-2.5 text-sm text-[#ffb0b4]">{children}</p>;
}

/** Pill buttons for picking one option. */
export function Chips<T extends string | number | null>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-8 rounded-full px-3 text-xs font-semibold ring-1 transition ${value === o.value ? "bg-cream text-ink ring-cream" : "bg-transparent text-cream ring-line-strong hover:bg-cream/5"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- modal ---------------- */

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={id}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line-strong bg-ink-2 shadow-2xl scroll-thin sm:rounded-3xl ${wide ? "sm:max-w-xl" : "sm:max-w-md"}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-ink-2 px-5 py-4">
          <h2 id={id} className="font-display text-lg font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-cream/[0.07] hover:bg-cream/[0.12]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/** On/off switch with a label and an optional line of help. */
export function Toggle({ checked, onChange, label, hint, disabled = false, hideLabel = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean; hideLabel?: boolean }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition ${checked ? "bg-ok/80" : "bg-cream/15"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
      <span className={hideLabel ? "sr-only" : "min-w-0"}>
        <span className="block text-sm font-semibold">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs leading-snug text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Whole-number input that shows Indian digit grouping and hands back a number (NaN when empty). */
export function NumberField({ value, onChange, id, disabled, className = "", suffix }: { value: number; onChange: (n: number) => void; id?: string; disabled?: boolean; className?: string; suffix?: string }) {
  return (
    <div className="relative">
      <input
        id={id}
        inputMode="numeric"
        disabled={disabled}
        className={`field disabled:opacity-60 ${suffix ? "pr-14" : ""} ${className}`}
        value={Number.isFinite(value) ? value.toLocaleString("en-IN") : ""}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, "");
          onChange(raw ? Number(raw) : NaN);
        }}
      />
      {suffix ? <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-muted">{suffix}</span> : null}
    </div>
  );
}

/** Runs an API call with a busy flag, a toast and a refresh. Returns true on success. */
export function useRun() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(async (key: string, fn: () => Promise<unknown>, done: string | null, after: { toast: (t: string, tone?: "ok" | "error") => void; changed: () => void }) => {
    setBusy(key);
    try {
      await fn();
      if (done) after.toast(done);
      after.changed();
      return true;
    } catch (e) {
      after.toast(e instanceof Error ? e.message : "Something went wrong", "error");
      return false;
    } finally {
      setBusy(null);
    }
  }, []);
  return { busy, run };
}

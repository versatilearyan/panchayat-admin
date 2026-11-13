/**
 * Festival Manager (live backend): make a festival, design it with a live phone preview, keep it as a draft, then publish or schedule it.
 * The phone is the user app itself (its /festival-preview page in an iframe), so what you see is what users get. The draft lives only in this
 * page and in the draft row on the server; nothing reaches users until you publish, and every publish is a new version you can roll back to.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Eye, Maximize2, Monitor, Moon, Plus, RotateCcw, Smartphone, Sun, Tablet, Trash2, Upload } from "lucide-react";
import { BACKEND_ENABLED, USER_APP_URL } from "../config/api";
import { useAdmin } from "../context";
import { apiRequest, apiUpload } from "../lib/api";
import { Badge, Button, Card, Chips, Empty, ErrorNote, Loading, Modal, PageHeader, Toggle } from "../components/ui";
import { NeedsBackend } from "../components/WalletParts";

const base = "/api/v1/admin/festivals";

type Cfg = {
  theme: { primary: string; accent: string; background: string; surface: string; text: string; buttonStyle: "pill" | "rounded" | "square"; mode: "dark" | "light" };
  assets: { bannerUrl: string | null; logoUrl: string | null; backgroundUrl: string | null; popupImageUrl: string | null };
  decorations: { enabled: boolean; fireworks: boolean; diyas: boolean; lights: boolean; confetti: boolean; intensity: number };
  banner: { title: string; subtitle: string; buttonText: string };
  popup: { title: string; body: string; buttonText: string; showOnce: boolean };
  sections: { banner: boolean; popup: boolean; decorations: boolean; logo: boolean; background: boolean; giftsHighlight: boolean };
};
type Version = { id: number; version: number; note: string | null; by: string | null; publishedAt: string | null; live: boolean };
type Festival = { id: number; name: string; state: string; enabled: boolean; startsAt: string | null; endsAt: string | null; publishedVersionId: number | null; draft: Cfg; draftSavedAt: string | null; versions: Version[]; published: Cfg | null };
type Row = { id: number; name: string; state: string; startsAt: string | null; endsAt: string | null; publishedVersion: number | null; updatedAt: string };
type Screen = "home" | "login" | "profile" | "gifts" | "voice" | "popup";

const msg = (e: unknown, f: string) => (e instanceof Error && e.message ? e.message : f);
const STATE_TONE: Record<string, "ok" | "gold" | "info" | "muted"> = { LIVE: "ok", SCHEDULED: "info", DRAFT: "muted", ENDED: "muted", OFF: "muted" };
const SCREENS: { value: Screen; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "login", label: "Login" },
  { value: "profile", label: "Profile" },
  { value: "gifts", label: "Gifts" },
  { value: "voice", label: "Voice Room" },
  { value: "popup", label: "Popup" },
];
type Device = "mobile" | "small" | "large" | "tablet";
const DEVICES: Record<Device, { label: string; w: number; h: number; icon: typeof Smartphone }> = {
  mobile: { label: "Mobile", w: 390, h: 800, icon: Smartphone },
  small: { label: "Small phone", w: 360, h: 640, icon: Smartphone },
  large: { label: "Large phone", w: 430, h: 880, icon: Smartphone },
  tablet: { label: "Tablet", w: 768, h: 1000, icon: Tablet },
};

export function FestivalsPage() {
  if (!BACKEND_ENABLED) return <NeedsBackend what="The Festival Manager" />;
  return <Live />;
}

function Live() {
  const [open, setOpen] = useState<number | null>(null);
  return open === null ? <List onOpen={setOpen} /> : <Studio id={open} onBack={() => setOpen(null)} />;
}

/* ------------------------------ the list ------------------------------ */

function List({ onOpen }: { onOpen: (id: number) => void }) {
  const { toast, can } = useAdmin();
  const canSave = can("users.view");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const load = useCallback(async () => {
    try {
      setRows(await apiRequest<Row[]>(base));
      setError(null);
    } catch (e) {
      setError(msg(e, "Could not load the festivals."));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div>
      <PageHeader title="Festival Manager" sub="Dress the whole app for a festival: colours, banner, logo, background, fireworks, a pop-up. Design with a live phone preview, then publish or schedule. No app release needed." />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Card title="New festival">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <input className="field h-10 w-72" maxLength={60} placeholder="Diwali 2026" value={name} onChange={(e) => setName(e.target.value)} disabled={!canSave} />
          <Button
            variant="gold"
            disabled={!canSave || !name.trim()}
            onClick={() =>
              void apiRequest<{ id: number }>(base, { method: "POST", body: { name: name.trim() } })
                .then((r) => onOpen(r.id))
                .catch((e) => toast(msg(e, "Could not create it"), "error"))
            }
          >
            <Plus className="h-4 w-4" /> Create and design
          </Button>
        </div>
      </Card>
      <Card className="mt-4" title="Festivals">
        {!rows ? (
          <Loading />
        ) : !rows.length ? (
          <Empty>No festival yet. Create the first one above.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="font-display text-[15px] font-bold">{r.name}</span>
                <Badge tone={STATE_TONE[r.state] ?? "muted"}>{r.state}</Badge>
                {r.publishedVersion ? <Badge>v{r.publishedVersion}</Badge> : null}
                <span className="text-xs text-muted">
                  {r.startsAt ? `${new Date(r.startsAt).toLocaleString("en-IN")} → ${r.endsAt ? new Date(r.endsAt).toLocaleString("en-IN") : "no end"}` : "not published"}
                </span>
                <span className="ml-auto flex gap-2">
                  <Button size="sm" variant="gold" onClick={() => onOpen(r.id)}>
                    Open studio
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={!canSave}
                    onClick={() => window.confirm(`Delete "${r.name}" and all its versions?`) && void apiRequest(`${base}/${r.id}`, { method: "DELETE" }).then(load).catch((e) => toast(msg(e, "Could not delete"), "error"))}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------ small form parts ------------------------------ */

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-xs font-semibold text-muted">
      {label}
      <span className="mt-1 flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-11 cursor-pointer rounded border border-line bg-transparent" />
        <input className="field h-9 w-24 py-1 font-mono text-xs" value={value} maxLength={7} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && onChange(e.target.value)} />
      </span>
    </label>
  );
}

function Text({ label, value, onChange, max, area = false }: { label: string; value: string; onChange: (v: string) => void; max: number; area?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-muted">
      {label}
      {area ? (
        <textarea className="field mt-1 h-16 w-full py-1" maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="field mt-1 h-9 w-full py-1" maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

const ASSET_LABEL: Record<keyof Cfg["assets"], string> = { bannerUrl: "Banner", logoUrl: "Logo", backgroundUrl: "Background", popupImageUrl: "Pop-up picture" };

function AssetSlot({ k, cfg, set, canSave }: { k: keyof Cfg["assets"]; cfg: Cfg; set: (c: Cfg) => void; canSave: boolean }) {
  const { toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  const url = cfg.assets[k];
  const up = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await apiUpload<{ url: string }>(`${base}/assets`, form).promise;
      set({ ...cfg, assets: { ...cfg.assets, [k]: r.url } });
    } catch (e) {
      toast(msg(e, "Could not upload"), "error");
    } finally {
      setBusy(false);
    }
  };
  const isVideo = url ? /\.mp4(\?|$)/i.test(url) : false;
  const isSvga = url ? /\.svga(\?|$)/i.test(url) : false;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line p-2">
      <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-ink text-[10px] text-muted">
        {url ? isVideo ? <video src={url} muted loop autoPlay playsInline className="h-full w-full object-cover" /> : isSvga ? "SVGA" : <img src={url} alt="" className="h-full w-full object-cover" /> : "none"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold">{ASSET_LABEL[k]}</span>
        <span className="flex gap-2 text-[11px]">
          <label className={`cursor-pointer font-semibold text-gold ${!canSave || busy ? "pointer-events-none opacity-50" : ""}`}>
            {busy ? "Uploading…" : url ? "Change" : "Upload"}
            <input type="file" className="sr-only" accept=".png,.jpg,.jpeg,.gif,.webp,.svga,.mp4" onChange={(e) => (void up(e.target.files?.[0]), (e.target.value = ""))} />
          </label>
          {url ? (
            <button type="button" className="text-muted underline" disabled={!canSave} onClick={() => set({ ...cfg, assets: { ...cfg.assets, [k]: null } })}>
              Remove
            </button>
          ) : null}
        </span>
      </span>
    </div>
  );
}

/* ------------------------------ the phone ------------------------------ */

function Phone({ cfg, screen, setScreen, device, light, full }: { cfg: Cfg; screen: Screen; setScreen: (s: Screen) => void; device: Device; light: boolean; full?: boolean }) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const holder = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [scale, setScale] = useState(1);
  const [key, setKey] = useState(0);
  const d = DEVICES[device];
  const origin = useMemo(() => {
    try {
      return new URL(USER_APP_URL).origin;
    } catch {
      return "*";
    }
  }, []);
  const send = useCallback((m: unknown) => frame.current?.contentWindow?.postMessage(m, origin), [origin]);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const m = e.data as { type?: string; screen?: Screen } | null;
      if (m?.type === "festival-preview-ready") setReady(true);
      if (m?.type === "festival-preview-screen" && m.screen) setScreen(m.screen);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [setScreen]);
  // The same draft goes to the phone on every change (nothing is saved)
  useEffect(() => {
    if (ready) send({ type: "festival-draft", config: cfg });
  }, [cfg, ready, send]);
  useEffect(() => {
    if (ready) send({ type: "festival-screen", screen });
  }, [screen, ready, send]);
  useEffect(() => {
    if (ready) send({ type: "festival-light", light });
  }, [light, ready, send]);
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const s = Math.min(1, (r.width - 4) / (d.w + 28), full ? (window.innerHeight - 140) / (d.h + 28) : 1);
      setScale(Math.max(0.35, s));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [d.w, d.h, full]);

  return (
    <div ref={holder} className="flex w-full justify-center">
      <div style={{ width: (d.w + 28) * scale, height: (d.h + 28) * scale }}>
        <div style={{ width: d.w + 28, height: d.h + 28, transform: `scale(${scale})`, transformOrigin: "top left" }} className={`relative bg-black p-[14px] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] ring-2 ring-white/10 ${device === "tablet" ? "rounded-[34px]" : "rounded-[46px]"}`}>
          {device !== "tablet" ? <span className="absolute left-1/2 top-[7px] z-10 h-[14px] w-[84px] -translate-x-1/2 rounded-full bg-black ring-1 ring-white/10" /> : null}
          <iframe
            key={key}
            ref={frame}
            title="Live phone preview"
            src={`${USER_APP_URL}/festival-preview`}
            onLoad={() => setReady(false)}
            className={`h-full w-full border-0 bg-black ${device === "tablet" ? "rounded-[22px]" : "rounded-[34px]"}`}
            style={{ width: d.w, height: d.h }}
          />
        </div>
      </div>
      <button type="button" className="sr-only" onClick={() => setKey((k) => k + 1)}>
        reload
      </button>
    </div>
  );
}

/* ------------------------------ the studio ------------------------------ */

function Studio({ id, onBack }: { id: number; onBack: () => void }) {
  const { toast, can } = useAdmin();
  const canSave = can("users.view");
  const [f, setF] = useState<Festival | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Cfg | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<string>("");
  const [screen, setScreen] = useState<Screen>("home");
  const [device, setDevice] = useState<Device>("mobile");
  const [light, setLight] = useState(false);
  const [full, setFull] = useState(false);
  const [pane, setPane] = useState<"settings" | "theme" | "preview">("preview");
  const [confirm, setConfirm] = useState(false);
  const [mode, setMode] = useState<"NOW" | "SCHEDULE">("NOW");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const load = useCallback(
    async (keepDraft = false) => {
      try {
        const r = await apiRequest<Festival>(`${base}/${id}`);
        setF(r);
        if (!keepDraft) {
          setDraft(r.draft);
          setName(r.name);
          setSaved(JSON.stringify(r.draft) + "|" + r.name);
        }
        setError(null);
      } catch (e) {
        setError(msg(e, "Could not load the festival."));
      }
    },
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const dirty = draft !== null && JSON.stringify(draft) + "|" + name !== saved;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!f || !draft) return <Loading />;

  const set = (c: Cfg) => setDraft(c);
  const th = (k: keyof Cfg["theme"], v: string) => set({ ...draft, theme: { ...draft.theme, [k]: v } });
  const sec = (k: keyof Cfg["sections"], v: boolean) => set({ ...draft, sections: { ...draft.sections, [k]: v } });
  const deco = <K extends keyof Cfg["decorations"]>(k: K, v: Cfg["decorations"][K]) => set({ ...draft, decorations: { ...draft.decorations, [k]: v } });

  const saveDraft = async (quiet = false) => {
    setBusy(true);
    try {
      const r = await apiRequest<Festival>(`${base}/${id}/draft`, { method: "PUT", body: { name, config: draft } });
      setF(r);
      setSaved(JSON.stringify(draft) + "|" + name);
      if (!quiet) toast("Draft saved. Users do not see it yet.");
      return true;
    } catch (e) {
      toast(msg(e, "Could not save the draft"), "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    try {
      if (!(await saveDraft(true))) return;
      const body = mode === "NOW" ? { mode, endsAt: endsAt ? new Date(endsAt).toISOString() : undefined, note } : { mode, startsAt: startsAt ? new Date(startsAt).toISOString() : undefined, endsAt: endsAt ? new Date(endsAt).toISOString() : undefined, note };
      const r = await apiRequest<Festival>(`${base}/${id}/publish`, { method: "POST", body });
      setF(r);
      setConfirm(false);
      toast(mode === "NOW" ? "Published. The app shows it within a minute." : "Scheduled.");
    } catch (e) {
      toast(msg(e, "Could not publish"), "error");
    } finally {
      setBusy(false);
    }
  };

  const assetsUsed = (Object.keys(draft.assets) as (keyof Cfg["assets"])[]).filter((k) => draft.assets[k]);
  const sectionsOn = (Object.keys(draft.sections) as (keyof Cfg["sections"])[]).filter((k) => draft.sections[k]);
  const phone = <Phone key={resetKey} cfg={draft} screen={screen} setScreen={setScreen} device={device} light={light} />;

  const settings = (
    <div className="space-y-4">
      <Card title="Festival">
        <div className="space-y-3 px-4 py-3">
          <Text label="Name" value={name} onChange={setName} max={60} />
          <p className="text-xs text-muted">
            Status: <Badge tone={STATE_TONE[f.state] ?? "muted"}>{f.state}</Badge>
            {f.startsAt ? <span className="ml-2">{new Date(f.startsAt).toLocaleString("en-IN")} → {f.endsAt ? new Date(f.endsAt).toLocaleString("en-IN") : "no end"}</span> : null}
          </p>
        </div>
      </Card>
      <Card title="Pictures and animations">
        <div className="space-y-2 px-4 py-3">
          {(Object.keys(draft.assets) as (keyof Cfg["assets"])[]).map((k) => (
            <AssetSlot key={k} k={k} cfg={draft} set={set} canSave={canSave} />
          ))}
          <p className="text-[11px] text-muted">PNG, JPG, GIF, WEBP, SVGA or MP4. They are used in the preview at once and go live only when you publish.</p>
        </div>
      </Card>
      <Card title="Decorations">
        <div className="space-y-3 px-4 py-3">
          <Toggle checked={draft.decorations.enabled} onChange={(v) => deco("enabled", v)} label="Decorations on" disabled={!canSave} />
          {draft.decorations.enabled ? (
            <>
              <Toggle checked={draft.decorations.fireworks} onChange={(v) => deco("fireworks", v)} label="Fireworks" disabled={!canSave} />
              <Toggle checked={draft.decorations.diyas} onChange={(v) => deco("diyas", v)} label="Diyas" disabled={!canSave} />
              <Toggle checked={draft.decorations.lights} onChange={(v) => deco("lights", v)} label="String lights" disabled={!canSave} />
              <Toggle checked={draft.decorations.confetti} onChange={(v) => deco("confetti", v)} label="Confetti" disabled={!canSave} />
              <label className="block text-xs font-semibold text-muted">
                Intensity {draft.decorations.intensity}
                <input type="range" min={10} max={100} step={5} className="mt-1 w-full" value={draft.decorations.intensity} onChange={(e) => deco("intensity", Number(e.target.value))} disabled={!canSave} />
              </label>
            </>
          ) : null}
        </div>
      </Card>
      <Card title="Show these parts">
        <div className="grid gap-2 px-4 py-3 sm:grid-cols-2">
          {(["banner", "popup", "decorations", "logo", "background", "giftsHighlight"] as (keyof Cfg["sections"])[]).map((k) => (
            <Toggle key={k} checked={draft.sections[k]} onChange={(v) => sec(k, v)} label={{ banner: "Home banner", popup: "Pop-up", decorations: "Decorations", logo: "Festival logo", background: "Background picture", giftsHighlight: "Gifts highlight" }[k]} disabled={!canSave} />
          ))}
        </div>
      </Card>
      <Versions f={f} id={id} onChanged={(r) => setF(r)} canSave={canSave} />
    </div>
  );

  const themePane = (
    <div className="space-y-4">
      <Card title="Colours">
        <div className="flex flex-wrap gap-4 px-4 py-3">
          <Color label="Main colour" value={draft.theme.primary} onChange={(v) => th("primary", v)} />
          <Color label="Accent" value={draft.theme.accent} onChange={(v) => th("accent", v)} />
          <Color label="Background" value={draft.theme.background} onChange={(v) => th("background", v)} />
          <Color label="Cards" value={draft.theme.surface} onChange={(v) => th("surface", v)} />
          <Color label="Text" value={draft.theme.text} onChange={(v) => th("text", v)} />
        </div>
      </Card>
      <Card title="Buttons">
        <div className="px-4 py-3">
          <Chips label="Button style" value={draft.theme.buttonStyle} onChange={(v) => th("buttonStyle", v)} options={[{ value: "pill", label: "Pill" }, { value: "rounded", label: "Rounded" }, { value: "square", label: "Square" }]} />
          <p className="mt-2 text-[11px] text-muted">Applies to the festival banner, pop-up and the preview buttons.</p>
        </div>
      </Card>
      <Card title="Home banner text">
        <div className="space-y-3 px-4 py-3">
          <Text label="Title" value={draft.banner.title} onChange={(v) => set({ ...draft, banner: { ...draft.banner, title: v } })} max={60} />
          <Text label="Line under it" value={draft.banner.subtitle} onChange={(v) => set({ ...draft, banner: { ...draft.banner, subtitle: v } })} max={120} />
          <Text label="Button text" value={draft.banner.buttonText} onChange={(v) => set({ ...draft, banner: { ...draft.banner, buttonText: v } })} max={24} />
        </div>
      </Card>
      <Card title="Pop-up">
        <div className="space-y-3 px-4 py-3">
          <Text label="Title" value={draft.popup.title} onChange={(v) => set({ ...draft, popup: { ...draft.popup, title: v } })} max={60} />
          <Text label="Message" value={draft.popup.body} onChange={(v) => set({ ...draft, popup: { ...draft.popup, body: v } })} max={240} area />
          <Text label="Button text" value={draft.popup.buttonText} onChange={(v) => set({ ...draft, popup: { ...draft.popup, buttonText: v } })} max={24} />
          <Toggle checked={draft.popup.showOnce} onChange={(v) => set({ ...draft, popup: { ...draft.popup, showOnce: v } })} label="Show once per person" disabled={!canSave} />
          {!draft.sections.popup ? <p className="text-[11px] text-gold">The pop-up is switched off in &quot;Show these parts&quot;.</p> : null}
        </div>
      </Card>
    </div>
  );

  const previewPane = (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chips label="Screen" value={screen} onChange={setScreen} options={SCREENS} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(Object.keys(DEVICES) as Device[]).map((k) => {
          const I = DEVICES[k].icon;
          return (
            <Button key={k} size="sm" variant={device === k ? "gold" : "soft"} onClick={() => setDevice(k)}>
              <I className="h-3.5 w-3.5" /> {DEVICES[k].label}
            </Button>
          );
        })}
        <Button size="sm" variant={light ? "gold" : "soft"} onClick={() => setLight((v) => !v)} title="Light or dark look (preview only, not saved)">
          {light ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />} {light ? "Light" : "Dark"}
        </Button>
        <Button size="sm" onClick={() => setFull(true)}>
          <Maximize2 className="h-3.5 w-3.5" /> Full screen
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setScreen("home");
            setLight(false);
            setDevice("mobile");
            setResetKey((k) => k + 1);
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset preview
        </Button>
      </div>
      {phone}
      <p className="mt-3 text-center text-[11px] text-muted">Tap inside the phone to move between screens. Nothing here touches real users.</p>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => (!dirty || window.confirm("You have changes that are not saved as a draft. Leave anyway?")) && onBack()}>
          <ArrowLeft className="h-4 w-4" /> All festivals
        </Button>
        <h1 className="font-display text-[22px] font-extrabold">{name}</h1>
        <Badge tone={STATE_TONE[f.state] ?? "muted"}>{f.state}</Badge>
        {dirty ? <Badge tone="gold">Unsaved changes</Badge> : <Badge>Draft saved</Badge>}
        <span className="ml-auto flex flex-wrap gap-2">
          <Button disabled={!canSave || busy || !dirty} onClick={() => void saveDraft()}>
            Save draft
          </Button>
          <Button
            variant="danger"
            disabled={!canSave || busy}
            onClick={() =>
              window.confirm("Discard the draft and go back to what is published (or the defaults)?") &&
              void apiRequest<Festival>(`${base}/${id}/discard`, { method: "POST" })
                .then((r) => (setF(r), setDraft(r.draft), setSaved(JSON.stringify(r.draft) + "|" + name), toast("Draft discarded")))
                .catch((e) => toast(msg(e, "Could not discard"), "error"))
            }
          >
            Discard changes
          </Button>
          <Button variant="gold" disabled={!canSave || busy} onClick={() => setConfirm(true)}>
            <Eye className="h-4 w-4" /> Publish…
          </Button>
        </span>
      </div>

      {/* Small screens: one pane at a time */}
      <div className="mb-3 xl:hidden">
        <Chips label="Pane" value={pane} onChange={setPane} options={[{ value: "settings", label: "Settings" }, { value: "theme", label: "Theme" }, { value: "preview", label: "Preview" }]} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className={pane === "settings" ? "" : "hidden xl:block"}>{settings}</div>
        <div className={pane === "theme" ? "" : "hidden xl:block"}>{themePane}</div>
        <div className={`xl:sticky xl:top-4 xl:self-start ${pane === "preview" ? "" : "hidden xl:block"}`}>{previewPane}</div>
      </div>

      <Modal open={full} onClose={() => setFull(false)} title="Full-screen preview" wide>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Chips label="Screen" value={screen} onChange={setScreen} options={SCREENS} />
        </div>
        {full ? <Phone cfg={draft} screen={screen} setScreen={setScreen} device={device} light={light} full /> : null}
      </Modal>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Publish this festival?" wide>
        <div className="grid gap-5 md:grid-cols-[1fr_auto]">
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-bold text-muted uppercase">Festival</p>
              <p className="font-display text-lg font-bold">{name}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant={mode === "NOW" ? "gold" : "soft"} onClick={() => setMode("NOW")}>
                Publish now
              </Button>
              <Button size="sm" variant={mode === "SCHEDULE" ? "gold" : "soft"} onClick={() => setMode("SCHEDULE")}>
                Schedule
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              {mode === "SCHEDULE" ? (
                <label className="text-xs font-semibold text-muted">
                  Starts
                  <input type="datetime-local" className="field mt-1 h-9 py-1" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </label>
              ) : (
                <p className="self-end text-xs text-muted">Starts as soon as you publish.</p>
              )}
              <label className="text-xs font-semibold text-muted">
                Ends (optional)
                <input type="datetime-local" className="field mt-1 h-9 py-1" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </label>
            </div>
            <Text label="Note for this version (optional)" value={note} onChange={setNote} max={200} />
            <div>
              <p className="text-xs font-bold text-muted uppercase">Pictures</p>
              <p>{assetsUsed.length ? assetsUsed.map((k) => ASSET_LABEL[k]).join(", ") : "None (the app's own look is used)"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-muted uppercase">Colours</p>
              <div className="mt-1 flex gap-2">
                {(["primary", "accent", "background", "surface", "text"] as const).map((k) => (
                  <span key={k} title={`${k} ${draft.theme[k]}`} className="h-7 w-7 rounded-full ring-1 ring-white/30" style={{ background: draft.theme[k] }} />
                ))}
                <span className="self-center text-xs text-muted">{draft.theme.buttonStyle} buttons</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-muted uppercase">Turned on</p>
              <p className="flex flex-wrap gap-1.5">
                {sectionsOn.map((k) => (
                  <Badge key={k}>{k}</Badge>
                ))}
                {draft.decorations.enabled ? <Badge tone="gold">decorations: {[draft.decorations.fireworks && "fireworks", draft.decorations.diyas && "diyas", draft.decorations.lights && "lights", draft.decorations.confetti && "confetti"].filter(Boolean).join(", ") || "none"}</Badge> : null}
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="gold" busy={busy} disabled={mode === "SCHEDULE" && !startsAt} onClick={() => void publish()}>
                {mode === "NOW" ? "Publish now" : "Schedule"}
              </Button>
              <Button onClick={() => setConfirm(false)}>Cancel</Button>
            </div>
            <p className="text-[11px] text-muted">A published version never changes. You can roll back to any earlier version, or switch the festival off, at any time.</p>
          </div>
          <div className="mx-auto w-[240px]">
            <p className="mb-1 text-center text-xs font-bold text-muted uppercase">Final look</p>
            {confirm ? <Phone cfg={draft} screen="home" setScreen={() => undefined} device="small" light={false} /> : null}
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Versions({ f, id, onChanged, canSave }: { f: Festival; id: number; onChanged: (r: Festival) => void; canSave: boolean }) {
  const { toast } = useAdmin();
  return (
    <Card title="Versions and rollback">
      <div className="space-y-2 px-4 py-3">
        {f.publishedVersionId ? (
          <Toggle
            checked={f.enabled}
            label="Festival is on"
            hint="Turn off to bring the normal app back at once (the festival and its versions stay)."
            disabled={!canSave}
            onChange={(v) =>
              void apiRequest<Festival>(`${base}/${id}/enabled`, { method: "POST", body: { on: v } })
                .then(onChanged)
                .catch((e) => toast(msg(e, "Could not change it"), "error"))
            }
          />
        ) : null}
        {!f.versions.length ? (
          <p className="text-xs text-muted">Nothing published yet.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {f.versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2 py-1.5">
                <b>v{v.version}</b>
                {v.live ? <Badge tone="ok">live version</Badge> : null}
                <span className="text-xs text-muted">{v.publishedAt ? new Date(v.publishedAt).toLocaleString("en-IN") : ""} {v.by ? `· ${v.by}` : ""}</span>
                {v.note ? <span className="text-xs">{v.note}</span> : null}
                {!v.live ? (
                  <Button
                    size="sm"
                    className="ml-auto"
                    disabled={!canSave}
                    onClick={() =>
                      window.confirm(`Make v${v.version} the live version again?`) &&
                      void apiRequest<Festival>(`${base}/${id}/rollback/${v.id}`, { method: "POST" })
                        .then((r) => (onChanged(r), toast(`v${v.version} is live`)))
                        .catch((e) => toast(msg(e, "Could not roll back"), "error"))
                    }
                  >
                    <Upload className="h-3.5 w-3.5 rotate-180" /> Roll back to this
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <span className="hidden">
          <Monitor />
        </span>
      </div>
    </Card>
  );
}

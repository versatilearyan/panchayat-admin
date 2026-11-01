import { useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { adminApi } from "../api";
import type { AdminSession } from "../api/session";
import { BACKEND_ENABLED } from "../config/api";
import { login as backendLogin } from "../services/adminAuthService";
import { Button, ErrorNote } from "../components/ui";

type FieldErrors = { username?: string; password?: string };

export function Login({ onSignIn, notice }: { onSignIn: (s: AdminSession) => void; notice?: string | null }) {
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  // A ref, not state, so a fast double click can't send two requests
  const sending = useRef(false);
  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending.current) return;
    const username = name.trim();
    const errs: FieldErrors = {};
    if (!username) errs.username = "Enter your username.";
    if (!passcode) errs.password = "Enter your password.";
    setFields(errs);
    setError(null);
    if (errs.username) return userRef.current?.focus();
    if (errs.password) return passRef.current?.focus();

    sending.current = true;
    setBusy(true);
    try {
      const s = BACKEND_ENABLED ? await backendLogin(username, passcode) : await adminApi.login(username, passcode);
      onSignIn(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in");
      setPasscode("");
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-[radial-gradient(ellipse_at_50%_-10%,#3a1622,transparent_60%)] px-4 py-10">
      <form onSubmit={submit} noValidate aria-busy={busy} className="w-full max-w-sm rounded-3xl border border-line-strong bg-ink-2 p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/logo.png" alt="Panchayat" className="h-12 w-auto" />
          <h1 className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.14em] text-gold uppercase">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Admin panel
          </h1>
          <p className="mt-2 text-sm text-muted">Sign in with your staff account.</p>
        </div>
        {notice && !error ? (
          <p role="status" className="mb-4 rounded-xl bg-gold/10 px-3 py-2 text-sm text-gold">
            {notice}
          </p>
        ) : null}
        <label className="label" htmlFor="name">
          Username
        </label>
        <input
          ref={userRef}
          id="name"
          name="username"
          className="field"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          disabled={busy}
          aria-invalid={Boolean(fields.username)}
          aria-describedby={fields.username ? "name-error" : undefined}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (fields.username) setFields((f) => ({ ...f, username: undefined }));
          }}
          placeholder="Your username"
        />
        {fields.username ? (
          <p id="name-error" className="mt-1.5 text-xs text-[#ff9095]">
            {fields.username}
          </p>
        ) : null}
        <label className="label mt-4" htmlFor="pass">
          Password
        </label>
        <div className="relative">
          <input
            ref={passRef}
            id="pass"
            name="password"
            type={show ? "text" : "password"}
            className="field pr-11"
            autoComplete="current-password"
            required
            disabled={busy}
            aria-invalid={Boolean(fields.password)}
            aria-describedby={fields.password ? "pass-error" : undefined}
            value={passcode}
            onChange={(e) => {
              setPasscode(e.target.value);
              if (fields.password) setFields((f) => ({ ...f, password: undefined }));
            }}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            aria-controls="pass"
            className="absolute top-1/2 right-1.5 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-cream/5 hover:text-cream"
          >
            {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        {fields.password ? (
          <p id="pass-error" className="mt-1.5 text-xs text-[#ff9095]">
            {fields.password}
          </p>
        ) : null}
        {error ? (
          <div className="mt-4" role="alert">
            <ErrorNote>{error}</ErrorNote>
          </div>
        ) : null}
        <Button type="submit" variant="primary" busy={busy} className="mt-6 w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        {!BACKEND_ENABLED && adminApi.mode === "local" ? (
          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">Demo mode: data stays in this browser.</p>
        ) : null}
      </form>
    </div>
  );
}

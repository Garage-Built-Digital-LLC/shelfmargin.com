import { useEffect, useState } from "react";
import { ArrowLeft, FileSpreadsheet, Scan, ShieldCheck } from "lucide-react";
import { supabase, supabaseReady } from "../lib/supabase.js";
import { publicPath } from "../lib/siteRoutes.js";

const BG = "#F6F5F0";
const INK = "#151512";
const YELLOW = "#FFC400";
const GREEN = "#1E8E4A";
const BLUE = "#1F5FAD";
const RED = "#C6301E";
const MUTED = "#6B6A63";
const LINE = "#151512";
const BLUE_BG = "#E3ECF7";

function StripeBar() {
  return (
    <div
      className="h-1 w-full"
      style={{ backgroundColor: YELLOW, borderBottom: `1px solid ${LINE}` }}
    />
  );
}

function authErrorMessage(error) {
  const message = String(error?.message || "");
  if (/invalid login credentials/i.test(message)) {
    return "That email and password did not match. Try again or reset your password.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Check your email to confirm your account before signing in.";
  }
  if (/rate limit/i.test(message)) {
    return "Supabase is blocking new signup emails for a short time. Wait a few minutes, then try once. For setup today, create the user in Supabase Auth and I will verify admin.";
  }
  return message || "Something went wrong. Please try again.";
}

export default function Auth({ initialMode = "signin" }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [msg, setMsg] = useState(null); // { tone: 'err'|'ok', text }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setMsg(null);
  }, [initialMode]);

  function resetRedirectUrl() {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}${publicPath("resetPassword")}`;
  }

  async function submit(e) {
    e.preventDefault();
    if (!supabaseReady) {
      setMsg({ tone: "err", text: "Supabase not configured — set .env.local." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: resetRedirectUrl(),
        });
        if (error) throw error;
        setMsg({ tone: "ok", text: "If that email has an account, a password reset link has been sent." });
      } else if (mode === "update") {
        if (pw !== pwConfirm) throw new Error("Passwords do not match.");
        const { error } = await supabase.auth.updateUser({ password: pw });
        if (error) throw error;
        setMsg({ tone: "ok", text: "Password updated. Opening Scan..." });
        setTimeout(() => {
          window.location.hash = "#/scout";
        }, 900);
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pw });
        if (error) throw error;
        if (!data.session) {
          setMsg({ tone: "ok", text: "Account created. Check your email to confirm, then sign in." });
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
        // success -> App's auth listener swaps to the Ledger.
      }
    } catch (err) {
      setMsg({ tone: "err", text: authErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: BG, color: INK }}>
      <StripeBar />
      <div className="mx-auto grid min-h-[calc(100vh-4px)] max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_420px] lg:items-center">
        <section>
          <a href={publicPath("home")} className="mb-8 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest" style={{ color: MUTED }}>
            <ArrowLeft size={14} />
            Back to site
          </a>
          <div className="flex items-center gap-2 mb-1">
            <Scan size={30} />
            <div className="text-3xl font-black tracking-tight">ShelfMargin</div>
          </div>
          <div className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: MUTED }}>
            scan - check - save
          </div>
          <h1 className="max-w-2xl text-4xl font-black leading-none sm:text-5xl">
            Scan books. Save the ones worth checking.
          </h1>
          <p className="mt-4 max-w-2xl text-base font-bold leading-relaxed sm:text-lg" style={{ color: MUTED }}>
            Sign in to keep your scan list. Use the demo first if you just want to look around.
          </p>
          <div className="mt-6 grid gap-0 sm:grid-cols-3" style={{ borderTop: `2px solid ${LINE}` }}>
            {[
              [Scan, "Scanner ready"],
              [ShieldCheck, "Private scans"],
              [FileSpreadsheet, "CSV exports"],
            ].map(([Icon, label]) => (
              <div key={label} className="flex items-center gap-2 py-3 text-xs font-black uppercase tracking-widest sm:pr-4" style={{ borderBottom: `2px solid ${LINE}`, backgroundColor: BLUE_BG }}>
                <Icon size={16} />
                {label}
              </div>
            ))}
          </div>
        </section>

        <section>
          <form onSubmit={submit} style={{ border: `2px solid ${INK}`, backgroundColor: "#FFFDF6" }}>
            <div className="flex" style={{ borderBottom: `2px solid ${INK}` }}>
              {["signin", "signup"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setMsg(null); }}
                  className="flex-1 py-2 text-xs font-black uppercase tracking-widest"
                  style={{
                    backgroundColor: mode === m ? INK : "transparent",
                    color: mode === m ? BG : INK,
                    borderRight: m === "signin" ? `2px solid ${INK}` : "none",
                  }}
                >
                  {m === "signin" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>

            <div className="p-4 flex flex-col gap-3">
              <div>
                <div className="text-sm font-black uppercase tracking-widest">
                  {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "reset" ? "Reset password" : "New password"}
                </div>
                <div className="mt-1 text-xs font-bold leading-relaxed" style={{ color: MUTED }}>
                  {mode === "signin"
                    ? "Open your scan list."
                    : mode === "signup"
                      ? "Start saving real scans."
                      : mode === "reset"
                        ? "We will email you a reset link."
                        : "Choose a new password."}
                </div>
              </div>
              {mode !== "update" && (
                <label className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>
                  email
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-transparent outline-none font-mono text-base normal-case"
                    style={{ border: `2px solid ${INK}`, color: INK }}
                  />
                </label>
              )}
              {mode !== "reset" && (
                <label className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>
                  password
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-transparent outline-none font-mono text-base normal-case"
                    style={{ border: `2px solid ${INK}`, color: INK }}
                  />
                </label>
              )}
              {mode === "update" && (
                <label className="text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>
                  confirm password
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-transparent outline-none font-mono text-base normal-case"
                    style={{ border: `2px solid ${INK}`, color: INK }}
                  />
                </label>
              )}

              {msg && (
                <div
                  className="px-3 py-2 text-xs font-bold"
                  style={{
                    border: `2px solid ${msg.tone === "err" ? RED : GREEN}`,
                    color: msg.tone === "err" ? RED : GREEN,
                  }}
                >
                  {msg.text}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="py-2.5 text-sm font-black uppercase tracking-widest"
                style={{ backgroundColor: busy ? "#CFCFC5" : YELLOW, color: INK, border: `2px solid ${LINE}` }}
              >
                {busy ? "..." : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Update password"}
              </button>

              {mode === "signin" && (
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => { setMode("reset"); setMsg(null); }}
                    className="text-xs font-black uppercase tracking-widest"
                    style={{ color: BLUE }}
                  >
                    Forgot password?
                  </button>
                  <a
                    href={publicPath("demo")}
                    className="text-xs font-black uppercase tracking-widest"
                    style={{ color: INK }}
                  >
                    Try demo
                  </a>
                </div>
              )}
              {mode === "reset" && (
                <button
                  type="button"
                  onClick={() => { setMode("signin"); setMsg(null); }}
                  className="text-xs font-black uppercase tracking-widest"
                  style={{ color: BLUE }}
                >
                  Back to sign in
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

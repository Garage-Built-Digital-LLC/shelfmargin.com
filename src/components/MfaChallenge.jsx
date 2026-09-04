import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase.js";

const BG = "#FFFBEB";
const INK = "#1F2937";
const YELLOW = "#FACC15";
const GREEN = "#16A34A";
const RED = "#DC2626";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";

// Shown after a signed-in user still needs to clear their second factor
// (Supabase AAL is aal1 but a verified TOTP factor exists -> aal2 required).
export default function MfaChallenge({ onVerified, onSignOut }) {
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        const verified = (data?.totp || []).find((f) => f.status === "verified");
        if (alive) {
          if (verified) setFactorId(verified.id);
          else setMsg({ tone: "err", text: "No authenticator is set up. Sign out and contact support." });
        }
      } catch {
        if (alive) setMsg({ tone: "err", text: "Could not load your authenticator. Try again." });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
      if (error) throw error;
      onVerified?.();
    } catch (err) {
      setMsg({ tone: "err", text: err.message || "That code did not verify. Try again." });
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4" style={{ backgroundColor: BG, color: INK }}>
      <div className="w-full max-w-sm rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}`, backgroundColor: "#FFFFFF", boxShadow: "0 18px 50px rgba(31, 41, 55, 0.08)" }}>
        <div className="h-1 w-full" style={{ backgroundColor: YELLOW }} />
        <form onSubmit={submit} className="p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} />
            <div className="text-sm font-black uppercase tracking-widest">Two-factor check</div>
          </div>
          <div className="text-xs font-bold leading-relaxed" style={{ color: MUTED }}>
            Enter the 6-digit code from your authenticator app to finish signing in.
          </div>

          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="000000"
            disabled={loading || busy}
            className="w-full px-3 py-2 bg-transparent outline-none font-mono text-lg tracking-[0.4em] text-center"
            style={{ border: `1px solid ${LINE}`, color: INK }}
          />

          {msg && (
            <div className="px-3 py-2 text-xs font-bold" style={{ border: `1px solid ${msg.tone === "err" ? RED : GREEN}`, color: msg.tone === "err" ? RED : GREEN }}>
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || loading || code.length !== 6 || !factorId}
            className="py-2.5 text-sm font-black uppercase tracking-widest"
            style={{ backgroundColor: busy || code.length !== 6 ? "#E5E7EB" : YELLOW, color: INK, border: `1px solid ${LINE}` }}
          >
            {busy ? "verifying..." : "verify"}
          </button>

          <button
            type="button"
            onClick={() => onSignOut?.()}
            className="text-xs font-black uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

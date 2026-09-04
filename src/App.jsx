import { useEffect, useState } from "react";
import { supabase, supabaseReady } from "./lib/supabase.js";
import Auth from "./components/Auth.jsx";
import MfaChallenge from "./components/MfaChallenge.jsx";
import Ledger from "./components/Ledger.jsx";
import PublicSite from "./components/PublicSite.jsx";
import { APP_SECTIONS, hashForSection } from "./lib/appRoutes.js";
import { publicPath, publicRouteFromLocation } from "./lib/siteRoutes.js";

async function computeMfaNeeded(session) {
  if (!session) return false;
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.currentLevel === "aal1" && data?.nextLevel === "aal2";
  } catch {
    return false;
  }
}

const BG = "#EEF2F5";
const INK = "#1E293B";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [mfaNeeded, setMfaNeeded] = useState("unknown"); // "unknown" | true | false
  const [routeKey, setRouteKey] = useState(() => (
    typeof window === "undefined" ? "" : `${window.location.pathname}${window.location.hash}`
  ));

  useEffect(() => {
    if (!supabaseReady) {
      setSession(null);
      setMfaNeeded(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setMfaNeeded(await computeMfaNeeded(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") window.location.href = publicPath("resetPassword");
      setMfaNeeded(await computeMfaNeeded(s));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const updateRoute = () => setRouteKey(`${window.location.pathname}${window.location.hash}`);
    window.addEventListener("hashchange", updateRoute);
    window.addEventListener("popstate", updateRoute);
    return () => {
      window.removeEventListener("hashchange", updateRoute);
      window.removeEventListener("popstate", updateRoute);
    };
  }, []);

  if (session === undefined) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center text-xs font-black uppercase tracking-widest"
        style={{ backgroundColor: BG, color: INK }}
      >
        loading…
      </div>
    );
  }

  // Signed in but second factor not yet cleared this session -> challenge first.
  const publicRouteForGate = publicRouteFromLocation(
    typeof window === "undefined" ? { pathname: "/", hash: routeKey } : window.location
  );
  if (session && mfaNeeded === "unknown" && publicRouteForGate !== "demo") {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center text-xs font-black uppercase tracking-widest"
        style={{ backgroundColor: BG, color: INK }}
      >
        loading…
      </div>
    );
  }
  if (session && mfaNeeded === true && publicRouteForGate !== "demo") {
    return (
      <MfaChallenge
        onVerified={() => setMfaNeeded(false)}
        onSignOut={() => supabase.auth.signOut()}
      />
    );
  }

  const publicRoute = publicRouteFromLocation(
    typeof window === "undefined"
      ? { pathname: "/", hash: routeKey }
      : window.location
  );
  const appPaths = new Set(Object.values(APP_SECTIONS).map((section) => section.path));
  const hashPath = typeof window === "undefined"
    ? String(routeKey || "").replace(/^#/, "") || "/"
    : String(window.location.hash || "").replace(/^#/, "") || "/";
  const appRequested = appPaths.has(hashPath);

  if (publicRoute === "demo") {
    return <Ledger demoMode session={{ user: { email: "demo@shelfmargin.local", id: "demo-user" } }} />;
  }

  if (appRequested) {
    if (!session) {
      window.location.href = publicPath("login");
      return null;
    }
    return <Ledger session={session} onSignOut={() => supabase.auth.signOut()} />;
  }

  if (publicRoute === "login") {
    if (session) {
      window.location.hash = hashForSection("scan");
      return null;
    }
    return <Auth />;
  }

  if (publicRoute === "resetPassword") {
    return <Auth initialMode="update" />;
  }

  if (!appRequested) return <PublicSite route={publicRoute || "home"} session={session} onSignOut={() => supabase.auth.signOut()} />;
}

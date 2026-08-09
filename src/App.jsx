import { useEffect, useState } from "react";
import { supabase, supabaseReady } from "./lib/supabase.js";
import Auth from "./components/Auth.jsx";
import Ledger from "./components/Ledger.jsx";
import PublicSite from "./components/PublicSite.jsx";
import { APP_SECTIONS, hashForSection } from "./lib/appRoutes.js";
import { publicPath, publicRouteFromLocation } from "./lib/siteRoutes.js";

const BG = "#F6F5F0";
const INK = "#151512";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [routeKey, setRouteKey] = useState(() => (
    typeof window === "undefined" ? "" : `${window.location.pathname}${window.location.hash}`
  ));

  useEffect(() => {
    if (!supabaseReady) {
      setSession(null);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") window.location.href = publicPath("resetPassword");
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

  if (publicRoute === "demo") {
    return <Ledger demoMode session={{ user: { email: "demo@shelfmargin.local", id: "demo-user" } }} />;
  }

  if (!appRequested) return <PublicSite route={publicRoute || "home"} session={session} onSignOut={() => supabase.auth.signOut()} />;
}

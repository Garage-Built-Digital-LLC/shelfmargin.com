export const PUBLIC_ROUTES = {
  home: { id: "home", path: "/" },
  product: { id: "product", path: "/product" },
  pricing: { id: "pricing", path: "/pricing" },
  faq: { id: "faq", path: "/faq" },
  security: { id: "security", path: "/security" },
  privacy: { id: "privacy", path: "/privacy" },
  terms: { id: "terms", path: "/terms" },
  demo: { id: "demo", path: "/demo" },
  resetPassword: { id: "resetPassword", path: "/reset-password" },
  login: { id: "login", path: "/login" },
};

export const PUBLIC_ROUTE_META = {
  home: {
    title: "ShelfMargin - Used Book Reseller Scanner",
    description: "Scan ISBNs, estimate profit, save possible buys, check books before purchasing, and export a simple used-book sourcing list.",
  },
  product: {
    title: "ShelfMargin Product - Scan Books and Save Possible Buys",
    description: "See the simple scanner workflow for used-book resellers: scan books, estimate profit, save a buy list, check books, and export notes.",
  },
  pricing: {
    title: "ShelfMargin Pricing - Used Book Scanner Plans",
    description: "ShelfMargin is free during beta, with a planned $15/month Starter plan and $29/month Pro plan for used-book resellers after live data is ready.",
  },
  faq: {
    title: "ShelfMargin FAQ - Used Book Scanner Questions",
    description: "Answers about barcode scanners, book profit estimates, saved scans, exports, accounts, and ShelfMargin's early live-data status.",
  },
  security: {
    title: "ShelfMargin Security - Private Book Scan History",
    description: "Learn how signed-in book scan history is kept tied to the user account while security is checked before paid launch.",
  },
  privacy: {
    title: "ShelfMargin Privacy Policy",
    description: "Privacy details for ShelfMargin accounts, scan records, book-check notes, data storage, and deletion or export requests during testing.",
  },
  terms: {
    title: "ShelfMargin Terms",
    description: "Terms for using ShelfMargin as an early used-book sourcing tool with estimated data that must be checked before buying.",
  },
  login: {
    title: "ShelfMargin Login",
    description: "Sign in to ShelfMargin to save book scans, buy lists, and book-check notes for used-book sourcing.",
  },
  demo: {
    title: "ShelfMargin Demo - Try the Book Scanner Workflow",
    description: "Try a sample ShelfMargin scan list before creating an account or scanning real used books.",
  },
};

const PATH_TO_ROUTE = Object.values(PUBLIC_ROUTES).reduce((acc, route) => {
  acc[route.path] = route.id;
  return acc;
}, {});

function routeFromPath(pathname) {
  const path = pathname || "/";
  return PATH_TO_ROUTE[path] || null;
}

export function publicRouteFromHash(hash) {
  const raw = String(hash || "").replace(/^#/, "");
  const path = raw ? (raw.startsWith("/") ? raw : `/${raw}`) : "/";
  return PATH_TO_ROUTE[path] || null;
}

export function publicRouteFromLocation(locationLike) {
  const pathname = locationLike?.pathname || "/";
  const hash = locationLike?.hash || "";
  return routeFromPath(pathname) || publicRouteFromHash(hash);
}

export function publicPath(routeId) {
  return PUBLIC_ROUTES[routeId]?.path || PUBLIC_ROUTES.home.path;
}

export function publicHash(routeId) {
  const path = publicPath(routeId);
  return path === "/" ? "#" : `#${path}`;
}

export function publicRouteMeta(routeId) {
  return PUBLIC_ROUTE_META[routeId] || PUBLIC_ROUTE_META.home;
}

export const APP_SECTIONS = {
  dashboard: { id: "dashboard", path: "/dashboard" },
  scan: { id: "scan", path: "/scout" },
  scannerTest: { id: "scannerTest", path: "/scanner-test" },
  queue: { id: "queue", path: "/queue" },
  field: { id: "field", path: "/check-books" },
  inventory: { id: "inventory", path: "/inventory" },
  settings: { id: "settings", path: "/settings" },
  admin: { id: "admin", path: "/admin" },
};

export const DEFAULT_SECTION = "scan";

const APP_SECTION_ALIASES = {
  "/field-test": "field",
};

const PATH_TO_SECTION = Object.values(APP_SECTIONS).reduce((acc, section) => {
  acc[section.path] = section.id;
  return acc;
}, { ...APP_SECTION_ALIASES });

export function sectionFromHash(hash) {
  const raw = String(hash || "").replace(/^#/, "") || APP_SECTIONS[DEFAULT_SECTION].path;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return PATH_TO_SECTION[path] || DEFAULT_SECTION;
}

export function hashForSection(sectionId) {
  return `#${APP_SECTIONS[sectionId]?.path || APP_SECTIONS[DEFAULT_SECTION].path}`;
}

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const filesToCheck = [
  "src/index.css",
  "src/components/PublicSite.jsx",
  "src/components/Ledger.jsx",
];

function readSource(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("no-motion UI guard", () => {
  it("keeps the public scanner preview and app scanner free of active animation", () => {
    const source = filesToCheck.map((path) => readSource(path)).join("\n");

    expect(source).not.toMatch(/@keyframes/i);
    expect(source).not.toMatch(/\banimation(?:-[a-z-]+)?\s*:/i);
    expect(source).not.toMatch(/\bscan-beam\b/i);
    expect(source).not.toMatch(/\banimate-[a-z0-9-]+\b/i);
  });
});

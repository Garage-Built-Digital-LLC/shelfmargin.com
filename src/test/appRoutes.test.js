import { describe, expect, it } from "vitest";
import { hashForSection, sectionFromHash } from "../lib/appRoutes.js";

describe("app routes", () => {
  it("maps app sections to stable hash URLs", () => {
    expect(hashForSection("dashboard")).toBe("#/dashboard");
    expect(hashForSection("scan")).toBe("#/scout");
    expect(hashForSection("scannerTest")).toBe("#/scanner-test");
    expect(hashForSection("field")).toBe("#/check-books");
    expect(hashForSection("inventory")).toBe("#/inventory");
    expect(hashForSection("admin")).toBe("#/admin");
  });

  it("resolves known hashes to sections", () => {
    expect(sectionFromHash("#/dashboard")).toBe("dashboard");
    expect(sectionFromHash("#/scout")).toBe("scan");
    expect(sectionFromHash("#/scanner-test")).toBe("scannerTest");
    expect(sectionFromHash("#/queue")).toBe("queue");
    expect(sectionFromHash("#/check-books")).toBe("field");
    expect(sectionFromHash("#/field-test")).toBe("field");
    expect(sectionFromHash("#/settings")).toBe("settings");
    expect(sectionFromHash("#/admin")).toBe("admin");
  });

  it("falls back to scan for empty or unknown hashes", () => {
    expect(sectionFromHash("")).toBe("scan");
    expect(sectionFromHash("#/missing")).toBe("scan");
  });
});

import { describe, expect, it } from "vitest";
import {
  publicHash,
  publicPath,
  publicRouteFromHash,
  publicRouteFromLocation,
  publicRouteMeta,
} from "../lib/siteRoutes.js";

describe("public site routes", () => {
  it("maps empty and home hashes to the homepage", () => {
    expect(publicRouteFromHash("")).toBe("home");
    expect(publicRouteFromHash("#")).toBe("home");
    expect(publicRouteFromHash("#/")).toBe("home");
  });

  it("maps public hashes to public pages", () => {
    expect(publicRouteFromHash("#/product")).toBe("product");
    expect(publicRouteFromHash("#/pricing")).toBe("pricing");
    expect(publicRouteFromHash("#/faq")).toBe("faq");
    expect(publicRouteFromHash("#/security")).toBe("security");
    expect(publicRouteFromHash("#/privacy")).toBe("privacy");
    expect(publicRouteFromHash("#/terms")).toBe("terms");
    expect(publicRouteFromHash("#/demo")).toBe("demo");
    expect(publicRouteFromHash("#/reset-password")).toBe("resetPassword");
    expect(publicRouteFromHash("#/login")).toBe("login");
  });

  it("maps real public paths to public pages", () => {
    expect(publicRouteFromLocation({ pathname: "/", hash: "" })).toBe("home");
    expect(publicRouteFromLocation({ pathname: "/product", hash: "" })).toBe("product");
    expect(publicRouteFromLocation({ pathname: "/pricing", hash: "" })).toBe("pricing");
    expect(publicRouteFromLocation({ pathname: "/faq", hash: "" })).toBe("faq");
    expect(publicRouteFromLocation({ pathname: "/privacy", hash: "" })).toBe("privacy");
    expect(publicRouteFromLocation({ pathname: "/terms", hash: "" })).toBe("terms");
    expect(publicRouteFromLocation({ pathname: "/unknown", hash: "#/pricing" })).toBe("pricing");
  });

  it("still exposes the public path even when an app hash is present", () => {
    expect(publicRouteFromLocation({ pathname: "/login", hash: "#/scout" })).toBe("login");
  });

  it("returns null for app-only routes", () => {
    expect(publicRouteFromHash("#/dashboard")).toBeNull();
    expect(publicRouteFromHash("#/field-test")).toBeNull();
  });

  it("builds stable public hashes", () => {
    expect(publicHash("home")).toBe("#");
    expect(publicHash("product")).toBe("#/product");
    expect(publicHash("privacy")).toBe("#/privacy");
  });

  it("builds SEO-friendly public paths", () => {
    expect(publicPath("home")).toBe("/");
    expect(publicPath("product")).toBe("/product");
    expect(publicPath("pricing")).toBe("/pricing");
    expect(publicPath("faq")).toBe("/faq");
  });

  it("provides per-page SEO metadata", () => {
    expect(publicRouteMeta("pricing").title).toContain("Pricing");
    expect(publicRouteMeta("faq").description).toContain("barcode scanners");
    expect(publicRouteMeta("missing").title).toBe(publicRouteMeta("home").title);
  });
});

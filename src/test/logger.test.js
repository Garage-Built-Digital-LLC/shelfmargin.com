import { describe, expect, it, vi } from "vitest";
import { serializeError, log, forwardError, reportServerError } from "../lib/logger.js";

function sink() {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe("serializeError", () => {
  it("captures message, status, code and a trimmed stack", () => {
    const err = Object.assign(new Error("boom"), { status: 502, code: "x" });
    const out = serializeError(err);
    expect(out).toMatchObject({ message: "boom", status: 502, code: "x" });
    expect(out.stack.split("\n").length).toBeLessThanOrEqual(4);
  });

  it("handles non-object throwables", () => {
    expect(serializeError("nope")).toEqual({ message: "nope" });
  });
});

describe("log", () => {
  it("emits a JSON line to the level-appropriate stream", () => {
    const s = sink();
    const line = log("error", "server_error", { path: "/x" }, s);
    expect(s.error).toHaveBeenCalledOnce();
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({ level: "error", event: "server_error", path: "/x" });
    expect(typeof parsed.ts).toBe("string");
  });
});

describe("forwardError", () => {
  it("is a no-op when ERROR_WEBHOOK_URL is unset", async () => {
    const fetchImpl = vi.fn();
    expect(await forwardError({ a: 1 }, {}, fetchImpl)).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("POSTs JSON to the configured webhook", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const ok = await forwardError({ event: "server_error" }, { ERROR_WEBHOOK_URL: "https://hook.example/x" }, fetchImpl);
    expect(ok).toBe(true);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://hook.example/x");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body).event).toBe("server_error");
  });

  it("swallows forwarder failures so monitoring never breaks a request", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("down"); });
    expect(await forwardError({ a: 1 }, { ERROR_WEBHOOK_URL: "https://hook.example/x" }, fetchImpl)).toBe(false);
  });
});

describe("reportServerError", () => {
  it("logs and forwards without throwing", async () => {
    const s = sink();
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    await reportServerError(new Error("kaboom"), { path: "/api/x", method: "POST" }, { env: { ERROR_WEBHOOK_URL: "https://hook.example/x" }, fetchImpl, sink: s });
    expect(s.error).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

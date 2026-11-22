import { afterEach, describe, expect, it, vi } from "vitest";
import {
  alert,
  ALERT_WINDOW_MS,
  log,
  mask,
  reportError,
  requestId,
  usage,
} from "../src/lib/observability";

const jwt = ["eyJhbGciOiJIUzI1NiJ9", "eyJyb2xlIjoiYW5vbiJ9", "sig"].join(".");
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("D086 observability", () => {
  it("masks personal data and credentials in strings and nested fields", () => {
    const out = JSON.stringify(
      mask({
        msg: `user kim@example.com 010-1234-5678 card 4111 1111 1111 1111 biz 123-45-67890 auth ${jwt} key test_sk_abc123 /cb?code=xyz&x=1`,
        nested: {
          password: "p@ss",
          email: "a@b.co",
          body: "메시지 원문",
          ok: "keep",
        },
      }),
    );
    for (const leaked of [
      "kim@example.com",
      "010-1234-5678",
      "4111 1111",
      "123-45-67890",
      jwt,
      "test_sk_abc123",
      "code=xyz",
      "p@ss",
      "메시지 원문",
    ])
      expect(out).not.toContain(leaked);
    expect(out).toContain("keep");
    expect(out).toContain("[email]");
  });
  it("log lines are masked JSON", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const line = log("error", "x", { detail: "contact me at kim@example.com" });
    expect(JSON.parse(line)).toMatchObject({
      level: "error",
      event: "x",
      detail: "contact me at [email]",
    });
  });
  it("request id: platform header if safe, otherwise random", () => {
    expect(requestId(new Headers({ "x-vercel-id": "icn1::abc-123" }))).toBe(
      "icn1::abc-123",
    );
    expect(requestId(new Headers({ "x-vercel-id": "<script>" }))).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    expect(requestId({})).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("alerts: not configured, sent once per window with masked text, failure reported", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await alert("k0", "x")).toBe("not_configured");
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.example.test/x");
    const f = vi.fn(async () => new Response("ok"));
    const t = 1_000_000;
    expect(await alert("k1", "실패 kim@example.com", t, f)).toBe("sent");
    expect(await alert("k1", "again", t + 1000, f)).toBe("deduped");
    expect(await alert("k1", "later", t + ALERT_WINDOW_MS + 1, f)).toBe("sent");
    expect(f).toHaveBeenCalledTimes(2);
    const body = (f.mock.calls[0] as unknown as [string, RequestInit])[1]
      .body as string;
    expect(body).toContain("[email]");
    expect(body).not.toContain("kim@example.com");
    expect(
      await alert(
        "k2",
        "x",
        t,
        async () => new Response("no", { status: 500 }),
      ),
    ).toBe("failed");
    expect(
      await alert("k3", "x", t, async () => {
        throw new Error("net");
      }),
    ).toBe("failed");
    vi.stubEnv("ALERT_WEBHOOK_URL", "http://evil.example.test/x");
    expect(await alert("k4", "x", t, f)).toBe("not_configured");
  });
  it("reportError logs without PII", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await reportError(new Error("boom for kim@example.com"), {
      route: "/api/x",
    });
    expect(String(err.mock.calls[0][0])).not.toContain("kim@example.com");
  });
  it("reportError treats a client abort as a warning, not a server error", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      await reportError(
        new Error("The destination stream errored while writing data."),
        { route: "/settings" },
      ),
    ).toBe("ignored");
    expect(err).not.toHaveBeenCalled();
  });
  it("usage warns at 80% of the free-plan reference limit", () => {
    const u = usage({
      db_bytes: 450 * 1024 ** 2,
      storage_bytes: 0,
      active_users_30d: 10,
    });
    expect(u.find((x) => x.key === "db_bytes")).toMatchObject({ warn: true });
    expect(u.find((x) => x.key === "storage_bytes")).toMatchObject({
      warn: false,
    });
  });
});

describe("D086 instrumentation", () => {
  it("onRequestError reports masked errors to the webhook", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.example.test/y");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok"));
    const { onRequestError } = await import("../src/instrumentation");
    await onRequestError(
      new Error("db failed for kim@example.com"),
      {
        path: "/api/x?token=abc",
        method: "POST",
        headers: { "x-vercel-id": "icn1::r1" },
      },
      {
        routerKind: "App Router",
        routePath: "/api/x",
        routeType: "route",
        renderSource: "server-rendering",
        revalidateReason: undefined,
        renderType: "dynamic",
      } as never,
    );
    expect(f).toHaveBeenCalledTimes(1);
    const body = String((f.mock.calls[0][1] as RequestInit).body);
    expect(body).toContain("/api/x");
    expect(body).not.toContain("kim@example.com");
  });
});

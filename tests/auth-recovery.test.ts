// Password recovery itself is the live flow from origin/main (tests/e2e/auth-recovery.spec.ts).
import { describe, it, expect, vi, beforeEach } from "vitest";

const jar = new Map<string, string>();
const auth = {
  resetPasswordForEmail: vi.fn(),
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  getClaims: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => jar.set(k, v),
    delete: (k: string) => jar.delete(k),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error("REDIRECT:" + to);
  },
}));
vi.mock("@/lib/supabase", () => ({
  configured: () => true,
  supabase: async () => ({ auth }),
}));

const { safeNext, appUrl, recentSignIn } =
  await import("../src/lib/auth-links");
const { changeEmail } = await import("../src/app/actions");
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  Object.entries(o).forEach(([k, v]) => f.set(k, v));
  return f;
};

beforeEach(() => {
  jar.clear();
  Object.values(auth).forEach((f) => f.mockReset());
  process.env.NEXT_PUBLIC_APP_URL = "https://ad-me.test";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://database.example";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_fixture";
  process.env.ADME_FEATURE_MAIL = "on";
  auth.getClaims.mockResolvedValue({
    data: {
      claims: {
        sub: "u1",
        session_id: "current-session",
        amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }],
      },
    },
    error: null,
  });
});

describe("D010 redirect boundaries", () => {
  it("allows only fixed internal next paths", () => {
    for (const bad of [
      "//evil.com",
      "https://evil.com",
      "/\\evil.com",
      "/admin/x",
      null,
    ])
      expect(safeNext(bad)).toBe("/dashboard");
    expect(safeNext("/settings")).toBe("/settings");
  });
  it("builds mail links from config, never from request host", () => {
    expect(appUrl({ NEXT_PUBLIC_APP_URL: "https://a.example/x" })).toBe(
      "https://a.example",
    );
    expect(() => appUrl({})).toThrow();
  });
});

describe("D010 email change", () => {
  it("denies unverifiable claims and unavailable mail without requesting a change", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "o@x.test" } },
    });
    auth.getClaims.mockResolvedValue({
      data: null,
      error: { message: "verification failed" },
    });
    expect(await changeEmail(null, fd({ email: "n@x.test" }))).toHaveProperty(
      "error",
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
    process.env.ADME_FEATURE_MAIL = "off";
    auth.getUser.mockClear();
    expect(await changeEmail(null, fd({ email: "n@x.test" }))).toHaveProperty(
      "error",
    );
    expect(auth.getUser).not.toHaveBeenCalled();
  });
  it("does not let another device's fresh account timestamp reauthenticate an old current session", async () => {
    auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          email: "o@x.test",
          last_sign_in_at: new Date().toISOString(),
        },
      },
    });
    auth.getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "u1",
          session_id: "old-session",
          iat: Math.floor(Date.now() / 1000),
          amr: [
            {
              method: "password",
              timestamp: Math.floor(Date.now() / 1000) - 1200,
            },
          ],
        },
      },
      error: null,
    });
    auth.updateUser.mockResolvedValue({ error: null });
    expect(await changeEmail(null, fd({ email: "n@x.test" }))).toHaveProperty(
      "error",
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("requires login and sends confirmation via configured origin", async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    expect(await changeEmail(null, fd({ email: "n@x.test" }))).toHaveProperty(
      "error",
    );
    auth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "u1",
          email: "o@x.test",
          last_sign_in_at: new Date().toISOString(),
        },
      },
    });
    auth.updateUser.mockResolvedValueOnce({ error: null });
    expect(await changeEmail(null, fd({ email: "n@x.test" }))).toHaveProperty(
      "message",
    );
    expect(auth.updateUser.mock.calls[0][1].emailRedirectTo).toBe(
      "https://ad-me.test/auth/confirm",
    );
  });
});

describe("D013 re-authentication and returnTo", () => {
  it("treats only a sign-in within 10 minutes as fresh", () => {
    const now = Date.parse("2026-11-19T10:00:00Z");
    expect(recentSignIn({ last_sign_in_at: "2026-11-19T09:55:00Z" }, now)).toBe(
      true,
    );
    expect(recentSignIn({ last_sign_in_at: "2026-11-19T09:49:59Z" }, now)).toBe(
      false,
    );
    expect(recentSignIn({ last_sign_in_at: null }, now)).toBe(false);
    expect(recentSignIn(null, now)).toBe(false);
  });
  it("refuses email change on a stale session", async () => {
    auth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "u1",
          email: "o@x.test",
          last_sign_in_at: "2020-01-01T00:00:00Z",
        },
      },
    });
    auth.getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "u1",
          session_id: "old-session",
          amr: [{ method: "password", timestamp: 1 }],
        },
      },
      error: null,
    });
    expect(await changeEmail(null, fd({ email: "n@x.test" }))).toHaveProperty(
      "error",
    );
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("returns to an allowed page after login and ignores external targets", () => {
    expect(safeNext("/admin")).toBe("/admin");
    expect(safeNext("/campaigns/new")).toBe("/campaigns/new");
    expect(safeNext("https://evil.com/dashboard")).toBe("/dashboard");
  });
});

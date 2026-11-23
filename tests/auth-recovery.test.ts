// Password recovery itself is the live flow from origin/main (tests/e2e/auth-recovery.spec.ts).
import { describe, it, expect, vi, beforeEach } from "vitest";

const jar = new Map<string, string>();
const auth = {
  resetPasswordForEmail: vi.fn(),
  verifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
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
const { changeEmail } =
  await import("../src/app/actions");
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  Object.entries(o).forEach(([k, v]) => f.set(k, v));
  return f;
};

beforeEach(() => {
  jar.clear();
  Object.values(auth).forEach((f) => f.mockReset());
  process.env.NEXT_PUBLIC_APP_URL = "https://ad-me.test";
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

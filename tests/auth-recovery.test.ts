import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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

const { safeNext, appUrl, RECOVERY_COOKIE, recentSignIn } =
  await import("../src/lib/auth-links");
const { requestPasswordReset, updatePassword, changeEmail } =
  await import("../src/app/actions");
const { GET } = await import("../src/app/auth/confirm/route");
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

describe("D010 password reset", () => {
  it("returns the same answer for existing and unknown accounts", async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null });
    const a = await requestPasswordReset(null, fd({ email: "known@x.test" }));
    auth.resetPasswordForEmail.mockResolvedValueOnce({
      error: { code: "user_not_found" },
    });
    const b = await requestPasswordReset(null, fd({ email: "unknown@x.test" }));
    expect(a).toEqual(b);
    expect(auth.resetPasswordForEmail.mock.calls[0][1].redirectTo).toBe(
      "https://ad-me.test/auth/confirm?next=/auth/reset",
    );
  });
  it("rejects a reused/expired link and never redirects off-site", async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { user: null },
      error: new Error("expired"),
    });
    const res = await GET(
      new NextRequest(
        "https://evil.example/auth/confirm?token_hash=t&type=recovery&next=https://evil.com",
      ),
    );
    expect(res.headers.get("location")).toBe(
      "https://ad-me.test/login?error=link",
    );
    expect(jar.has(RECOVERY_COOKIE)).toBe(false);
  });
  it("marks only the verified recovery user and sends them to reset", async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    const res = await GET(
      new NextRequest(
        "https://ad-me.test/auth/confirm?token_hash=t&type=recovery&next=//evil.com",
      ),
    );
    expect(res.headers.get("location")).toBe("https://ad-me.test/auth/reset");
    expect(jar.get(RECOVERY_COOKIE)).toBe("u1");
  });
  it("refuses a new password outside a recovery session or for another account", async () => {
    const pw = { password: "new-password-123", confirm: "new-password-123" };
    auth.getUser.mockResolvedValue({ data: { user: { id: "u2" } } });
    expect(await updatePassword(null, fd(pw))).toHaveProperty("error");
    jar.set(RECOVERY_COOKIE, "u1");
    expect(await updatePassword(null, fd(pw))).toHaveProperty("error");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("applies once in the recovery session, clears marker, signs out other sessions", async () => {
    jar.set(RECOVERY_COOKIE, "u1");
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    auth.updateUser.mockResolvedValue({ error: null });
    await expect(
      updatePassword(
        null,
        fd({ password: "new-password-123", confirm: "new-password-123" }),
      ),
    ).rejects.toThrow("REDIRECT:/dashboard");
    expect(jar.has(RECOVERY_COOKIE)).toBe(false);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
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
      "https://ad-me.test/auth/confirm?next=/settings",
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

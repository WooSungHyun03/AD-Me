import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as review } from "@/app/api/admin/route";
import { POST as moderate } from "@/app/api/admin/moderate/route";
import { POST as mfa } from "@/app/api/admin/mfa/route";

const db = vi.hoisted(() => ({
  role: "admin",
  rpc: vi.fn(),
  getClaims: vi.fn(),
  listFactors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challengeAndVerify: vi.fn(),
}));
const userId = "00000000-0000-4000-8000-000000000016";
vi.mock("@/lib/supabase", () => ({
  configured: () => true,
  supabase: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: userId } }, error: null }),
      getClaims: db.getClaims,
      mfa: {
        listFactors: db.listFactors,
        enroll: db.enroll,
        unenroll: db.unenroll,
        challengeAndVerify: db.challengeAndVerify,
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { role: db.role, name: "QA fixture" },
            error: null,
          }),
        }),
      }),
    }),
    rpc: db.rpc,
  }),
}));
const request = (body: unknown) =>
  new Request("https://example.test/api/admin", {
    method: "POST",
    body: JSON.stringify(body),
  });
const claims = (age = 0) => ({
  sub: userId,
  aal: "aal2",
  amr: [{ method: "mfa/totp", timestamp: Math.floor(Date.now() / 1000) - age }],
});
beforeEach(() => {
  vi.resetAllMocks();
  db.role = "admin";
  db.rpc.mockResolvedValue({ data: true, error: null });
  db.getClaims.mockResolvedValue({ data: { claims: claims() }, error: null });
  db.listFactors.mockResolvedValue({
    data: { all: [], totp: [] },
    error: null,
  });
});

describe("admin API gates before privileged work", () => {
  it("distinguishes an unavailable claims provider from insufficient MFA", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.getClaims.mockResolvedValue({
      data: null,
      error: { status: 502, message: "PRIVATE_PROVIDER_FIXTURE" },
    });
    const response = await review(request({ id: userId, status: "reviewed" }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE_PROVIDER_FIXTURE");
    expect(db.rpc).not.toHaveBeenCalledWith("review_report", expect.anything());
  });
  it.each([review, moderate])(
    "denies ordinary accounts before any RPC",
    async (handler) => {
      db.role = "brand";
      expect((await handler(request({}))).status).toBe(403);
      expect(db.rpc).not.toHaveBeenCalled();
    },
  );
  it("checks delegated enrollment without granting classic administrator access", async () => {
    db.role = "brand";
    db.rpc.mockResolvedValue({ data: null, error: null });
    expect((await mfa(request({}))).status).toBe(403);
    expect(db.rpc).toHaveBeenCalledWith("ops_enrollment_role");
    db.rpc.mockResolvedValue({ data: "finance", error: null });
    expect(
      (
        await mfa(
          request({ action: "verify", factorId: userId, code: "123456" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await review(request({ id: userId, status: "reviewed" }))).status,
    ).toBe(403);
    expect(db.getClaims).not.toHaveBeenCalled();
  });
  it.each([review, moderate, mfa])(
    "denies missing or revoked provision",
    async (handler) => {
      db.rpc.mockResolvedValue({ data: false, error: null });
      expect((await handler(request({}))).status).toBe(403);
      expect(db.rpc.mock.calls.map(([name]) => name)).toEqual([
        "is_admin_provisioned",
      ]);
    },
  );
  it.each([
    { ...claims(), aal: "aal1" },
    claims(901),
    { ...claims(), sub: "someone-else" },
  ])("denies invalid MFA and account mismatch", async (value) => {
    db.getClaims.mockResolvedValue({ data: { claims: value }, error: null });
    expect(
      (await review(request({ id: userId, status: "reviewed" }))).status,
    ).toBe(403);
    expect(db.rpc).not.toHaveBeenCalledWith("review_report", expect.anything());
  });
  it("checks the actual database JWT after application verification", async () => {
    db.rpc.mockImplementation(async (name) => ({
      data: name !== "is_admin",
      error: null,
    }));
    expect(
      (await review(request({ id: userId, status: "reviewed" }))).status,
    ).toBe(403);
  });
  it("preserves audit reason in lock/unlock RPC and rejects absent reason", async () => {
    expect(
      (
        await moderate(
          request({ kind: "creator", id: "fixture", published: false }),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await moderate(
          request({
            kind: "creator",
            id: "fixture",
            published: false,
            reason: "QA fixture only",
          }),
        )
      ).status,
    ).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith("moderate_entity", {
      p_kind: "creator",
      p_id: "fixture",
      p_published: false,
      p_reason: "QA fixture only",
    });
  });
  it("rejects an unknown factor before calling the provider", async () => {
    expect(
      (
        await mfa(
          request({ action: "verify", factorId: userId, code: "123456" }),
        )
      ).status,
    ).toBe(403);
    expect(db.challengeAndVerify).not.toHaveBeenCalled();
  });
  it("does not disclose raw provider MFA errors", async () => {
    db.listFactors.mockResolvedValue({
      data: { all: [{ id: userId, factor_type: "totp" }], totp: [] },
      error: null,
    });
    db.challengeAndVerify.mockResolvedValue({
      error: { status: 422, message: "PRIVATE_TOKEN_FIXTURE" },
    });
    const response = await mfa(
      request({ action: "verify", factorId: userId, code: "123456" }),
    );
    expect(response.status).toBe(422);
    expect(await response.text()).not.toContain("PRIVATE_TOKEN_FIXTURE");
  });
});

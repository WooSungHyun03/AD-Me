import { beforeEach, expect, it, vi } from "vitest";
import { fail } from "@/lib/api";
import { POST as SUBMIT } from "@/app/api/reports/route";
import { GET, POST } from "@/app/api/reviews/route";
import { POST as DECIDE } from "@/app/api/admin/reviews/route";
import { GET as PUBLIC } from "@/app/api/reviews/public/route";
import { decodeReviewCursor, requireReviewResult } from "@/lib/review-server";
const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  admin: true,
  configured: true,
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  requireContext: async () => ({
    user: { id: "server-actor" },
    db: { rpc: state.rpc },
  }),
}));
vi.mock("@/lib/admin", () => ({
  requireAdminContext: async () => {
    if (!state.admin) fail("MFA required", 403);
    return { db: { rpc: state.rpc } };
  },
}));
vi.mock("@/lib/supabase", () => ({
  configured: () => state.configured,
  supabase: async () => ({ rpc: state.rpc }),
}));
const id = "ad000000-0000-4000-8000-000000000901",
  key = "ad000000-0000-4000-8000-000000000902";
const payload = {
  reason: "가상 자료에 대한 검토 요청입니다.",
  sourceUrl: "https://example.org/fixture",
  evidenceKind: "source",
};
const request = (path: string, body: unknown) =>
  new Request("https://app.example" + path, {
    method: "POST",
    headers: {
      host: "app.example",
      origin: "https://app.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  state.rpc.mockReset();
  state.rpc.mockResolvedValue({ data: id, error: null });
  state.admin = true;
  state.configured = true;
});
it("preserves legacy reports fields, defaults to an unverified claim and keeps ownership in DB", async () => {
  const res = await SUBMIT(
    request("/api/reports", {
      creatorId: "legacy-creator",
      reason: payload.reason,
      sourceUrl: payload.sourceUrl,
      clientKey: key,
    }),
  );
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, id });
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith("review_submit", {
    p_kind: "issue",
    p_creator: "legacy-creator",
    p_key: key,
    p_payload: { ...payload, evidenceKind: "claim" },
  });
});
it("rejects score/publication injection and credential sources before persistence", async () => {
  for (const extra of [
    { riskScore: 100 },
    { publicVisible: true },
    { sourceUrl: "https://user:secret@example.org/fixture" },
  ])
    expect(
      (
        await SUBMIT(
          request("/api/reports", {
            ...payload,
            creatorId: "legacy-creator",
            ...extra,
          }),
        )
      ).status,
    ).toBe(422);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("sends version preconditions and explicit response consent, never a forged actor", async () => {
  state.rpc.mockResolvedValue({ data: 2, error: null });
  expect(
    (
      await POST(
        request("/api/reviews", {
          action: "revise",
          id,
          expectedVersion: 1,
          payload,
        }),
      )
    ).status,
  ).toBe(200);
  expect(state.rpc).toHaveBeenLastCalledWith("review_revise", {
    p_id: id,
    p_expected: 1,
    p_payload: payload,
  });
  state.rpc.mockResolvedValue({ data: key, error: null });
  expect(
    (
      await POST(
        request("/api/reviews", {
          action: "respond",
          id,
          expectedVersion: 2,
          body: payload.reason,
          sourceUrl: null,
          publishConsent: false,
        }),
      )
    ).status,
  ).toBe(200);
  expect(state.rpc).toHaveBeenLastCalledWith("review_respond", {
    p_id: id,
    p_expected: 2,
    p_body: payload.reason,
    p_source: null,
    p_public: false,
  });
});
it("maps revision conflicts, private denials and exact Retry-After without exposing SQL", async () => {
  for (const [code, status] of [
    ["40001", 409],
    ["42501", 403],
    ["PT429", 429],
  ] as const) {
    state.rpc.mockResolvedValue({
      data: null,
      error: { code, message: "PRIVATE_SQL", details: '{"retryAfter":31}' },
    });
    const res = await POST(
      request("/api/reviews", { action: "withdraw", id, expectedVersion: 1 }),
    );
    expect(res.status).toBe(status);
    expect(await res.text()).not.toContain("PRIVATE_SQL");
    if (status === 429) expect(res.headers.get("Retry-After")).toBe("31");
  }
});
it("requires admin MFA and refuses publication of unverified claims before SQL", async () => {
  const input = {
    id,
    expectedVersion: 1,
    verdict: "approved",
    classification: "unverified_claim",
    note: payload.reason,
    summary: payload.reason,
    publish: true,
  };
  expect((await DECIDE(request("/api/admin/reviews", input))).status).toBe(422);
  expect(state.rpc).not.toHaveBeenCalled();
  state.admin = false;
  expect(
    (await DECIDE(request("/api/admin/reviews", { ...input, publish: false })))
      .status,
  ).toBe(403);
});
it("public response is an allowlist and rejects any original allegations/private metadata", async () => {
  const record = {
    id,
    version: 1,
    kind: "issue",
    isDemo: true,
    payload: { sourceUrl: payload.sourceUrl, evidenceKind: "source" },
    classification: "confirmed_fact",
    summary: payload.reason,
    reviewedAt: "2026-11-20T00:00:00Z",
    policyVersion: "fixture-v1",
    response: null,
  };
  state.rpc.mockResolvedValue({ data: [record], error: null });
  const res = await PUBLIC(
    new Request(
      "https://app.example/api/reviews/public?creatorId=legacy-creator",
    ),
  );
  expect(res.status).toBe(200);
  expect(res.headers.get("Cache-Control")).toBe("no-store");
  state.rpc.mockResolvedValue({
    data: [
      { ...record, payload: { ...record.payload, reason: "PRIVATE_ORIGINAL" } },
    ],
    error: null,
  });
  expect(
    (
      await PUBLIC(
        new Request(
          "https://app.example/api/reviews/public?creatorId=legacy-creator",
        ),
      )
    ).status,
  ).toBe(503);
});
it("validates typed RPC results and bounded private cursor instead of reporting a false success", async () => {
  expect(() => requireReviewResult(true)).toThrow();
  expect(() => requireReviewResult(id, "version")).toThrow();
  expect(() => decodeReviewCursor("!")).toThrow();
  expect(() => decodeReviewCursor("a".repeat(401))).toThrow();
  expect(
    (await GET(new Request("https://app.example/api/reviews?cursor=!"))).status,
  ).toBe(422);
  state.rpc.mockResolvedValue({
    data: { items: [], nextCursor: null },
    error: null,
  });
  expect(
    (await GET(new Request("https://app.example/api/reviews"))).status,
  ).toBe(200);
});

import { beforeEach, expect, it, vi } from "vitest";
import { POST, GET } from "@/app/api/ad-history/route";
import {
  adPayloadSchema,
  publicAdReviewSchema,
  reviewCaseSchema,
} from "@/lib/reviews";
const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  role: "creator",
  configured: true,
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  requireContext: async () => ({
    role: state.role,
    user: { id: "derived-user" },
    db: { rpc: state.rpc },
  }),
}));
vi.mock("@/lib/supabase", () => ({
  configured: () => state.configured,
  supabase: async () => ({ rpc: state.rpc }),
}));
const id = "ad000000-0000-4000-8000-000000000911",
  key = "ad000000-0000-4000-8000-000000000912";
const payload = {
  brandLabel: "가상 광고 브랜드",
  category: "교육",
  format: "숏폼",
  startedOn: "2025-01-01",
  endedOn: "2025-01-31",
  interest: "paid",
  disclosure: "visible",
  evidenceKind: "official_confirmation",
  sourceUrl: "https://example.test/fictional-ad",
  ownershipConfirmed: true,
};
const req = (data: unknown) =>
  new Request("https://app.example/api/ad-history", {
    method: "POST",
    headers: {
      host: "app.example",
      origin: "https://app.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
beforeEach(() => {
  state.role = "creator";
  state.configured = true;
  state.rpc.mockReset();
  state.rpc.mockResolvedValue({ data: id, error: null });
});
it("persists typed owner evidence under the DB actor without client-selected demo/reviewer status", async () => {
  const res = await POST(
    req({ creatorId: "legacy-owner", clientKey: key, payload }),
  );
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, id });
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith("review_submit", {
    p_kind: "ad",
    p_creator: "legacy-owner",
    p_key: key,
    p_payload: payload,
  });
});
it("requires creator role, explicit attestation, valid dates and allowlisted fields", async () => {
  state.role = "brand";
  expect((await POST(req({ creatorId: "legacy-owner", payload }))).status).toBe(
    403,
  );
  state.role = "creator";
  for (const p of [
    { ...payload, ownershipConfirmed: false },
    { ...payload, startedOn: "2025-02-30" },
    { ...payload, startedOn: "2025-02-01" },
    { ...payload, sourceUrl: "https://user:secret@example.org/file" },
    { ...payload, verified: true },
  ])
    expect(adPayloadSchema.safeParse(p).success).toBe(false);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("maps duplicate evidence409 without exposing database diagnostics", async () => {
  state.rpc.mockResolvedValue({
    data: null,
    error: { code: "23505", message: "PRIVATE_SOURCE_UNIQUE" },
  });
  const res = await POST(req({ creatorId: "legacy-owner", payload }));
  expect(res.status).toBe(409);
  expect(await res.text()).not.toContain("PRIVATE_SOURCE_UNIQUE");
});
it("public schema omits private attestation and requires an explicit ad evidence classification", () => {
  const { ownershipConfirmed, ...visible } = payload;
  expect(ownershipConfirmed).toBe(true);
  const row = {
    id,
    version: 1,
    kind: "ad",
    isDemo: true,
    payload: visible,
    classification: "ad_evidence",
    summary: "가상 출처에 대한 검토 요약입니다.",
    reviewedAt: "2026-11-20T00:00:00Z",
    policyVersion: "fixture-v1",
    response: null,
  };
  expect(publicAdReviewSchema.safeParse(row).success).toBe(true);
  expect(publicAdReviewSchema.safeParse({ ...row, payload }).success).toBe(
    false,
  );
  expect(
    publicAdReviewSchema.safeParse({ ...row, classification: "confirmed_fact" })
      .success,
  ).toBe(false);
  expect(
    publicAdReviewSchema.safeParse({
      ...row,
      payload: { ...visible, evidenceKind: "brand_mention" },
    }).success,
  ).toBe(false);
  expect(
    publicAdReviewSchema.safeParse({
      ...row,
      payload: { ...visible, interest: "unknown" },
    }).success,
  ).toBe(false);
});
it("public endpoint is no-store and rejects private fields rather than passing raw review rows", async () => {
  state.rpc.mockResolvedValue({ data: [], error: null });
  const res = await GET(
    new Request("https://app.example/api/ad-history?creatorId=legacy-owner"),
  );
  expect(res.status).toBe(200);
  expect(res.headers.get("Cache-Control")).toBe("no-store");
  expect(state.rpc).toHaveBeenLastCalledWith("public_review_records", {
    p_creator: "legacy-owner",
    p_kind: "ad",
  });
  state.rpc.mockResolvedValue({ data: [{ owner_id: "PRIVATE" }], error: null });
  expect(
    (
      await GET(
        new Request(
          "https://app.example/api/ad-history?creatorId=legacy-owner",
        ),
      )
    ).status,
  ).toBe(503);
});
it("private mixed-kind inbox fails closed when history payload belongs to the wrong record kind", () => {
  const row = {
    id,
    kind: "ad",
    creatorId: "legacy-owner",
    version: 1,
    status: "pending",
    publicVisible: false,
    isDemo: true,
    createdAt: "2026-11-20T00:00:00Z",
    canRevise: true,
    canRespond: true,
    canReview: false,
    payload,
    history: [{ version: 1, payload, createdAt: "2026-11-20T00:00:00Z" }],
    responses: [],
    decisions: [],
  };
  expect(reviewCaseSchema.safeParse(row).success).toBe(true);
  expect(reviewCaseSchema.safeParse({ ...row, kind: "issue" }).success).toBe(
    false,
  );
});

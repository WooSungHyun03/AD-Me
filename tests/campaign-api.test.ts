import { beforeEach, expect, it, vi } from "vitest";
import { POST, PATCH } from "@/app/api/campaigns/route";
import { campaignBriefTermsSchema } from "@/lib/campaign-brief";
const db = vi.hoisted(() => ({
  role: "brand",
  insert: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/api", async (original) => {
  const api = await original<typeof import("@/lib/api")>();
  return {
    ...api,
    requireContext: async () => ({
      role: db.role,
      user: { id: "owner" },
      db: { from: () => ({ insert: db.insert, update: db.update }) },
    }),
  };
});
const id = "ad000000-0000-4000-8000-000000000301";
const brief = {
  title: "가상 캠페인",
  product: "가상 제품",
  category: "교육",
  vibes: ["자연스러움"],
  format: "숏폼",
  platforms: ["instagram"],
  budget_krw: 100000,
  target_audience: "로컬 QA",
  goal: "검증 목적",
  status: "draft",
};
const terms = campaignBriefTermsSchema.parse({
  version: 2,
  recruitment: { start: "2027-01-01T00:15", end: "2027-01-10T18:00" },
  production: { start: "2027-01-11T09:00", end: "2027-01-20T18:00" },
  posting: { start: "2027-01-21T09:00", end: "2027-02-01T18:00" },
  compensation: { mode: "unknown" },
  deliverables: [
    {
      format: "숏폼",
      quantity: 1,
      usageRights: "가상 권리",
      exclusivity: null,
    },
  ],
});
const request = (data: unknown) =>
  new Request("https://example.test/api/campaigns", {
    method: "POST",
    body: JSON.stringify(data),
  });
beforeEach(() => {
  vi.resetAllMocks();
  db.role = "brand";
  db.insert.mockReturnValue({
    select: () => ({ single: async () => ({ data: { id }, error: null }) }),
  });
  db.update.mockReturnValue({
    eq: () => ({
      eq: () => ({
        select: () => ({
          maybeSingle: async () => ({ data: { id }, error: null }),
        }),
      }),
    }),
  });
});
it("persists complete UTC terms exactly once with the authenticated owner and separate publication state", async () => {
  expect(
    (await POST(request({ ...brief, terms, owner_id: "forged" }))).status,
  ).toBe(201);
  expect(db.insert).toHaveBeenCalledExactlyOnceWith({
    owner_id: "owner",
    brief: { ...brief, terms },
    status: "draft",
  });
  expect(
    (await PATCH(request({ id, brief: { ...brief, terms, status: "closed" } })))
      .status,
  ).toBe(200);
  expect(db.update).toHaveBeenCalledWith({
    brief: { ...brief, terms, status: "closed" },
    status: "closed",
  });
});
it("preserves v1 input compatibility and rejects invalid nested terms before DB work", async () => {
  expect((await POST(request(brief))).status).toBe(201);
  db.insert.mockClear();
  for (const bad of [
    { ...terms, recruitment: { start: "bad", end: "bad" } },
    {
      ...terms,
      compensation: { mode: "unknown", cash: { minimumKrw: 0, maximumKrw: 0 } },
    },
    { ...terms, deliverables: [] },
  ])
    expect((await POST(request({ ...brief, terms: bad }))).status).toBe(422);
  expect(db.insert).not.toHaveBeenCalled();
});
it("denies creator writes regardless of terms validity", async () => {
  db.role = "creator";
  expect((await POST(request({ ...brief, terms }))).status).toBe(403);
  expect(db.insert).not.toHaveBeenCalled();
});

import { beforeEach, expect, it, vi } from "vitest";
import { recommendCreators } from "@/app/recommend-creators";
import { creators } from "@/lib/catalog";
const source = vi.hoisted(() => ({
  profiles: vi.fn(),
  directory: vi.fn(),
  configured: true,
  condition: vi.fn(),
  role: "brand",
}));
vi.mock("@/lib/product-condition-workflow", () => ({
  confirmedProductConditionContext: source.condition,
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  context: async () => ({ role: source.role, db: {} }),
}));
vi.mock("@/lib/data", () => ({ publicCreators: source.profiles }));
vi.mock("@/lib/youtube-directory", () => ({
  readYoutubeDirectory: source.directory,
}));
vi.mock("@/lib/supabase", () => ({
  configured: () => source.configured,
  supabase: async () => ({}),
}));
const base = {
  ...creators[0],
  seed_id: "real-profile-fixture",
  name: "가상 계약 샘플",
  is_demo: false,
  published: true,
  is_available: true,
  platforms: ["youtube"],
  categories: ["음식"],
  price_min_krw: 10000,
  vibes: ["자연스러움"],
};
const form = (overrides: Record<string, string> = {}) => {
  const value = new FormData();
  for (const [key, item] of Object.entries({
    product: "가상 상품",
    audience: "성인 고객",
    category: "음식",
    budget: "10000",
    preference: "자연스러움, 자연스러움",
    ...overrides,
  }))
    value.set(key, item);
  return value;
};
beforeEach(() => {
  vi.resetAllMocks();
  source.configured = true;
  source.role = "brand";
  source.profiles.mockResolvedValue([base]);
  source.directory.mockResolvedValue({
    items: [],
    total: 0,
    nextCursor: null,
    version: 1,
  });
});
it("consumes a confirmed format in scoring and rechecks a bound reference before catalogue reads", async () => {
  const reference = {
    id: "ad000000-0000-4000-8000-000000000001",
    sourceVersion: "a".repeat(64),
    promptVersion: "product-conditions-v2",
  };
  source.condition.mockResolvedValue(reference);
  source.profiles.mockResolvedValue([{ ...base, formats: ["제품 리뷰"] }]);
  const input = form({
    format: "제품 리뷰",
    conditionRequestId: reference.id,
    conditionRevision: "1",
    conditionSourceVersion: reference.sourceVersion,
  });
  const result = await recommendCreators({}, input);
  expect(result.registered?.[0]).toMatchObject({ score: 100, coverage: 80 });
  expect(result.brief?.confirmedSource).toEqual(reference);
  expect(source.condition).toHaveBeenCalledOnce();
  source.profiles.mockClear();
  source.directory.mockClear();
  source.condition.mockRejectedValue(Error("stale"));
  expect((await recommendCreators({}, input)).error).toBeTruthy();
  expect(source.profiles).not.toHaveBeenCalled();
  expect(source.directory).not.toHaveBeenCalled();
  source.role = "creator";
  source.condition.mockClear();
  expect((await recommendCreators({}, input)).error).toBeTruthy();
  expect(source.condition).not.toHaveBeenCalled();
});
it("refuses partial/forged confirmation and unsupported formats while leaving manual input usable", async () => {
  const invalid: Record<string, string>[] = [
    { conditionRequestId: "forged" },
    { conditionRevision: "1" },
    { format: "inferred" },
  ];
  for (const extra of invalid) {
    expect((await recommendCreators({}, form(extra))).error).toBeTruthy();
  }
  expect(source.profiles).not.toHaveBeenCalled();
  expect((await recommendCreators({}, form())).registered).toHaveLength(1);
});
it("defaults to explicit hard budget/category, excludes demo/unpublished/unavailable/wrong-platform candidates", async () => {
  source.profiles.mockResolvedValue([
    base,
    { ...base, seed_id: "budget", price_min_krw: 10001 },
    { ...base, seed_id: "category", categories: ["테크"] },
    { ...base, seed_id: "demo", is_demo: true },
    { ...base, seed_id: "private", published: false },
    { ...base, seed_id: "off", is_available: false },
    { ...base, seed_id: "platform", platforms: ["instagram"] },
  ]);
  const result = await recommendCreators({}, form());
  expect(result.registered?.map((x) => x.id)).toEqual([base.seed_id]);
  expect(result.brief?.policy).toEqual({
    category: "hard",
    budget: "hard",
    unknown: "exclude",
  });
  expect(result.registered?.[0]).toMatchObject({
    status: "eligible",
    coverage: 68,
    score: 100,
  });
  expect(source.directory.mock.calls[0][1].get("yt-topic")).toBe("음식");
});
it("preserves soft preferences and holds unknown hard criteria behind confirmed candidates", async () => {
  source.profiles.mockResolvedValue([
    { ...base, seed_id: "missing", categories: [], price_min_krw: null },
    { ...base, seed_id: "expensive", price_min_krw: 20000 },
    base,
  ]);
  const held = await recommendCreators({}, form({ unknownPolicy: "hold" }));
  expect(held.registered?.map((x) => [x.id, x.status])).toEqual([
    [base.seed_id, "eligible"],
    ["missing", "hold"],
  ]);
  expect(held.registered?.[1].reasons).toContain("견적 미확인");
  const soft = await recommendCreators(
    {},
    form({ budgetPolicy: "soft", categoryPolicy: "soft" }),
  );
  expect(soft.registered?.map((x) => x.id)).toContain("expensive");
});
it("supports alternative selected categories and never invents audience data or performance metrics", async () => {
  source.profiles.mockResolvedValue([{ ...base, categories: ["게임"] }]);
  const result = await recommendCreators({}, form({ category: "테크·게임" }));
  expect(result.registered).toHaveLength(1);
  expect(result.registered?.[0].missing).toEqual(
    expect.arrayContaining(["타깃 고객", "기간별 평균 조회수"]),
  );
});
it("keeps manual recommendations usable when public source fails and rejects malformed policy before reads", async () => {
  source.directory.mockRejectedValue(Error("unavailable"));
  expect((await recommendCreators({}, form())).registered).toHaveLength(1);
  expect((await recommendCreators({}, form())).incomplete).toBe(true);
  source.profiles.mockClear();
  source.directory.mockClear();
  expect(
    (await recommendCreators({}, form({ categoryPolicy: "bypass" }))).error,
  ).toBeTruthy();
  expect(source.profiles).not.toHaveBeenCalled();
  expect(source.directory).not.toHaveBeenCalled();
});

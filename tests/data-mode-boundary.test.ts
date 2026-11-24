import { afterEach, describe, expect, it, vi } from "vitest";
import { creators } from "@/lib/catalog";
import { projectPublicCreator } from "@/lib/creator-public-profile";
import { publicCreator, publicCreators } from "@/lib/data";
const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  rpc: vi.fn(),
  catalog: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  configured: mocks.configured,
  supabase: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/creator-catalog-read", () => ({
  readPublicCreatorCatalog: mocks.catalog,
}));
const demo = projectPublicCreator({
  id: "creator-001",
  published: true,
  profile: creators[0],
})!;
const real = projectPublicCreator({
  id: "c-real",
  published: true,
  profile: { ...creators[0], is_demo: false },
})!;
function setup(mode = "free_beta") {
  vi.stubEnv("ADME_SERVICE_MODE", mode);
  vi.stubEnv("SERVICE_MODE", mode);
  mocks.configured.mockReturnValue(true);
  mocks.catalog.mockResolvedValue([demo, real]);
  mocks.rpc.mockResolvedValue({ data: demo, error: null });
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("D005 server public data boundary", () => {
  it("free mode excludes DEMO from the compatibility list even against an opted-in TEST database", async () => {
    setup();
    expect(await publicCreators()).toEqual([real]);
  });
  it("free mode hides DEMO at direct legacy/opaque detail URLs", async () => {
    setup();
    expect(await publicCreator("creator-001")).toBeNull();
  });
  it("retains real DTOs and distinguishes not-found from backend failure", async () => {
    setup();
    mocks.rpc.mockResolvedValueOnce({ data: real, error: null });
    expect(await publicCreator(real.seed_id)).toEqual(real);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await publicCreator("missing")).toBeNull();
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "private backend detail" },
    });
    await expect(publicCreator("error")).rejects.toThrow(
      "프로필을 불러오지 못했습니다.",
    );
  });
  it("explicit test_demo retains labeled fixtures and configured TEST data", async () => {
    setup("test_demo");
    expect(await publicCreators()).toEqual([demo, real]);
    expect(await publicCreator(demo.seed_id)).toEqual(demo);
    mocks.configured.mockReturnValue(false);
    expect((await publicCreators()).every((c) => c.is_demo)).toBe(true);
  });
  it("free mode without DB fails closed rather than returning fixtures", async () => {
    setup();
    mocks.configured.mockReturnValue(false);
    await expect(publicCreators()).rejects.toThrow(
      "실제 크리에이터 데이터 연결이 필요합니다.",
    );
    await expect(publicCreator("creator-001")).rejects.toThrow();
  });
});

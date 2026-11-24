import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Campaigns from "@/app/campaigns/page";
import Campaign from "@/app/campaigns/[id]/page";
import { GET as exportCsv } from "@/app/api/export/route";
import { campaigns } from "@/lib/catalog";
vi.mock("@/lib/supabase", () => ({
  configured: () => false,
  currentUser: async () => null,
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  requireContext: async () => ({ db: {} }),
}));
vi.mock("@/lib/creator-catalog-read", () => ({
  readMySavedCreatorCatalog: async () => [
    {
      creator: {
        name: "D005_DEMO",
        categories: [],
        vibes: [],
        price_min_krw: 0,
        is_demo: true,
      },
    },
    {
      creator: {
        name: "D005_REGISTERED",
        categories: [],
        vibes: [],
        price_min_krw: 0,
        is_demo: false,
      },
    },
  ],
}));
function mode(value: string) {
  vi.stubEnv("ADME_SERVICE_MODE", value);
  vi.stubEnv("SERVICE_MODE", value);
}
afterEach(() => vi.unstubAllEnvs());
it("free campaign list without a database is empty rather than fictional", async () => {
  mode("free_beta");
  const html = renderToStaticMarkup(await Campaigns());
  expect(html).not.toContain("가상 캠페인");
  expect(html).not.toContain(campaigns[0].title);
  expect(html).toContain("현재 공개 모집 중인 캠페인이 없습니다.");
});
it("free legacy campaign URLs cannot fall back to bundled campaigns", async () => {
  mode("free_beta");
  await expect(
    Campaign({
      params: Promise.resolve({ id: campaigns[0].seed_id }),
      searchParams: Promise.resolve({}),
    }),
  ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
});
it("explicit TEST mode retains labeled campaign fixtures", async () => {
  mode("test_demo");
  expect(renderToStaticMarkup(await Campaigns())).toContain(
    "가상 캠페인 · DEMO",
  );
});
it.each(["free_beta", "test_demo"])(
  "CSV respects the server mode %s even if the DB is opted in",
  async (value) => {
    mode(value);
    const response = await exportCsv(
      new Request("http://localhost/api/export"),
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("D005_REGISTERED");
    if (value === "free_beta") expect(body).not.toContain("D005_DEMO");
    else expect(body).toContain("D005_DEMO");
  },
);

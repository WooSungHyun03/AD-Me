import { expect, it } from "vitest";
import { creators, rank } from "@/lib/catalog";
import { projectPublicCreator } from "@/lib/creator-public-profile";

const row = (patch = {}, extra = {}) => ({
  id: "public-profile-fixture",
  published: true,
  profile: { ...creators[0], ...patch },
  ...extra,
});
it("uses an explicit public app allowlist and never spreads owner/contact/OAuth/internal fields", () => {
  const value = projectPublicCreator(
    row(
      {
        owner_id: "PRIVATE_OWNER",
        email: "PRIVATE_EMAIL",
        oauth_token: "PRIVATE_TOKEN",
        review_notes: "PRIVATE_NOTES",
        private_extra: { nested: "PRIVATE_NESTED" },
        seed_id: "FORGED_ID",
        published: false,
        portrait_asset: "PRIVATE_OBJECT_PATH",
      },
      { owner_id: "PRIVATE_OWNER" },
    ),
  );
  expect(value?.seed_id).toBe("public-profile-fixture");
  expect(value?.published).toBe(true);
  expect(value?.portrait_asset).toBeNull();
  for (const key of [
    "owner_id",
    "owner_consent",
    "email",
    "oauth_token",
    "review_notes",
    "private_extra",
  ])
    expect(value).not.toHaveProperty(key);
  expect(JSON.stringify(value)).not.toContain("PRIVATE_");
});
it("omits unconsented source/SNS/portfolio links and normalizes only explicitly consented HTTPS links", () => {
  const patch = {
    owner_consent: false,
    social_url: "https://www.youtube.com/watch?v=abcdefghijk",
    portfolio_url: "https://example.org/portfolio",
    source_url: "https://example.org/private-source",
  };
  const hidden = projectPublicCreator(row(patch));
  expect(hidden).not.toHaveProperty("social_url");
  expect(hidden).not.toHaveProperty("portfolio_url");
  expect(hidden?.source_url).toBeNull();
  expect(hidden).not.toHaveProperty("owner_consent");
  const visible = projectPublicCreator(row({ ...patch, owner_consent: true }));
  expect(visible?.social_url).toBe(
    "https://www.youtube.com/watch?v=abcdefghijk",
  );
  expect(visible?.source_url).toBe(visible?.social_url);
  expect(visible?.portfolio_url).toBe("https://example.org/portfolio");
  expect(
    projectPublicCreator(
      row({
        ...patch,
        owner_consent: true,
        social_url: "https://youtube.com.evil.invalid/watch?v=abcdefghijk",
        portfolio_url: "https://user:password@example.org/",
      }),
    ),
  ).not.toHaveProperty("social_url");
});
it("keeps unavailable observations null rather than publishing legacy placeholders or arbitrary real counts", () => {
  for (const followers of [0, 10000]) {
    const value = projectPublicCreator(
      row({
        is_demo: false,
        followers,
        metrics_source: "synthetic_demo_not_verified",
      }),
    );
    expect(value?.followers).toBeNull();
    expect(value?.metrics_source).toBe("unavailable");
  }
  expect(projectPublicCreator(row({ followers: 0 }))?.followers).toBe(0);
  expect(projectPublicCreator(row({ followers: null }))?.followers).toBeNull();
  expect(
    projectPublicCreator(row({ metrics_source: "unavailable" }))?.followers,
  ).toBeNull();
});
it("fails closed on hidden/malformed profiles without echoing rejected data", () => {
  expect(projectPublicCreator(row({}, { published: false }))).toBeNull();
  expect(
    projectPublicCreator({ profile: { private: "UNEXPECTED" } }),
  ).toBeNull();
  for (const patch of [
    { categories: ["x", 1] },
    { price_min_krw: -1 },
    { price_min_krw: 400000, price_max_krw: 100 },
    { followers: Infinity },
    { owner_consent: "true" },
  ])
    expect(projectPublicCreator(row(patch))).toBeNull();
});
it("preserves all 48 labeled fixtures and recommendation scores while removing private app fields", () => {
  const projected = creators.map((profile) =>
    projectPublicCreator({ id: profile.seed_id, published: true, profile }),
  );
  expect(projected.filter((p) => p !== null)).toHaveLength(48);
  for (const [index, value] of projected.entries()) {
    expect(value?.followers).toBe(creators[index].followers);
    expect(value?.is_demo).toBe(true);
    expect(value).not.toHaveProperty("owner_id");
  }
  const brief = {
    category: "뷰티",
    vibes: ["자연스러움"],
    format: "숏폼",
    budget_krw: 1000000,
  };
  const eligibleFixtures = creators.map((c) => ({ ...c, is_available: true }));
  const eligiblePublic = projected
    .filter((p) => p !== null)
    .map((p) => ({ ...p, is_available: true }));
  expect(
    rank(brief, eligiblePublic).map(({ creatorId, score, coverage }) => ({
      creatorId,
      score,
      coverage,
    })),
  ).toEqual(
    rank(brief, eligibleFixtures).map(({ creatorId, score, coverage }) => ({
      creatorId,
      score,
      coverage,
    })),
  );
});

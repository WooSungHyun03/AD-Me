import { verifyAdminOtp } from "./support/admin";
// D025 UI flow on an ISOLATED local Supabase only (needs local service key to create a collected-profile fixture).
import { qaSignupConsent } from "../support/consent-fixture.mjs";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const local =
  /^http:\/\/(127\.0\.0\.1|localhost):/.test(
    env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  ) && Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
test.skip(!local, "local Supabase with service key only");
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const opts = { auth: { persistSession: false } };

async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test("collected profile: unverified label, claim code once, admin approves only with matching code", async ({
  page,
}) => {
  const svc = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    opts,
  );
  const id = `yt-e2e-${randomUUID().slice(0, 8)}`;
  await svc.from("creators").insert({
    id,
    published: true,
    profile: {
      name: "수집 채널 검증",
      handle: "qa",
      bio: "공개 API로 수집된 검증용 프로필",
      categories: ["뷰티"],
      vibes: [],
      formats: [],
      platforms: ["youtube"],
      price_min_krw: 0,
      price_max_krw: 0,
      followers: 0,
      is_available: false,
      is_demo: false,
      data_source: "youtube_data_api",
      metrics_source: "youtube_data_api",
    },
  });
  const email = `adme-qa-claimui-${randomUUID().slice(0, 8)}@example.com`;
  const password = randomUUID() + "Aa!";
  await createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    opts,
  ).auth.signUp({
    email,
    password,
    options: { data: { ...qaSignupConsent, role: "creator", name: "청구 UI" } },
  });
  try {
    await page.goto(`/creators/${id}`);
    await expect(page.getByText("미인증 · 협업 의사 미확인")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /협업 캠페인 만들기/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /소유 확인 요청/ }),
    ).toHaveCount(0); // anonymous

    await login(page, email, password);
    await page.goto(`/creators/${id}`);
    await page.getByRole("button", { name: /소유 확인 요청/ }).click();
    const status = page.locator("p[role=status]");
    await expect(status).toContainText("ADME-");
    const code = (await status.innerText()).match(/ADME-[0-9A-F]{10}/)![0];
    await page.getByRole("button", { name: /소유 확인 요청/ }).click();
    await expect(page.locator("p[role=alert]")).toContainText("이미 진행 중");

    await login(page, accounts.admin.email, accounts.admin.password);
    await verifyAdminOtp(page, accounts.admin.totpSecret);
    await page.goto("/admin");
    const card = page.locator("article", { hasText: id });
    await card.getByLabel("채널에서 확인한 코드").fill("ADME-0000000000");
    await card.getByRole("button", { name: "소유 확인 승인" }).click();
    await expect(card.getByRole("status")).toContainText(
      "코드가 청구 코드와 다릅니다",
    );
    await card.getByLabel("채널에서 확인한 코드").fill(code);
    await card.getByRole("button", { name: "소유 확인 승인" }).click();
    await expect(page.locator("article", { hasText: id })).toHaveCount(0);

    await page.goto(`/creators/${id}`);
    await expect(
      page.getByText("본인 연결 프로필 · 외부 지표 검증 전"),
    ).toBeVisible();
  } finally {
    await svc.from("audit_log").delete().eq("entity_id", id);
    await svc.from("creators").delete().eq("id", id);
  }
});

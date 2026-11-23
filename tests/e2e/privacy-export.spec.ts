// D074 UI: a creator in a collaboration downloads their own data from settings; the brand's message, the brand's
// account id and secret fields are absent; the access log shows the export; anonymous calls are refused.
import { qaSignupConsent } from "../support/consent-fixture.mjs";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
test.skip(
  !/^http:\/\/(127\.0\.0\.1|localhost):/.test(
    env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  ),
  "local Supabase only",
);
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const client = () =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );

test("own-data export excludes the counterparty and is logged", async ({
  page,
  request,
}) => {
  expect((await request.post("/api/privacy/exports")).status()).toBe(401);
  const tag = randomUUID().slice(0, 8);
  const email = `adme-qa-d074ui-${tag}@example.com`,
    password = randomUUID() + "Aa!";
  const cdb = client();
  const cuid = (
    await cdb.auth.signUp({
      email,
      password,
      options: { data: { ...qaSignupConsent, role: "creator", name: "D074 크리에이터" } },
    })
  ).data.user!.id;
  const cid = `user-${cuid}`;
  expect(
    (
      await cdb.from("creators").insert({
        id: cid,
        owner_id: cuid,
        published: true,
        profile: {
          name: "D074 크리에이터",
          bio: "",
          handle: "self_reported",
          categories: ["뷰티"],
          vibes: ["자연스러움"],
          formats: ["숏폼"],
          platforms: ["youtube"],
          price_min_krw: null,
          price_max_krw: null,
          followers: 0,
          is_available: true,
          is_demo: false,
        },
      })
    ).error,
  ).toBeNull();
  const brand = client();
  await brand.auth.signInWithPassword({
    email: accounts.brand.email,
    password: accounts.brand.password,
  });
  const campaign = (
    await brand
      .from("campaigns")
      .insert({
        owner_id: accounts.brand.id,
        status: "published",
        brief: {
          title: "D074 반출",
          product: "QA",
          category: "뷰티",
          vibes: ["자연스러움"],
          format: "숏폼",
          platforms: ["youtube"],
          budget_krw: 100000,
          target_audience: "QA",
          goal: "반출 검증",
          status: "published",
        },
      })
      .select("id")
      .single()
  ).data!.id;
  const pid = (
    await brand
      .from("proposals")
      .insert({
        campaign_id: campaign,
        creator_id: cid,
        brand_id: accounts.brand.id,
        creator_user_id: cuid,
        kind: "proposal",
        brief: `브랜드 비공개 브리프 ${tag}`,
      })
      .select("id")
      .single()
  ).data!.id;
  expect(
    (
      await brand
        .from("messages")
        .insert({
          proposal_id: pid,
          sender_id: accounts.brand.id,
          kind: "message",
          body: `브랜드 비밀 ${tag}`,
        })
    ).error,
  ).toBeNull();
  expect(
    (
      await cdb
        .from("messages")
        .insert({
          proposal_id: pid,
          sender_id: cuid,
          kind: "message",
          body: `내 답장 ${tag}`,
        })
    ).error,
  ).toBeNull();

  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/settings");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "내 데이터 내보내기 (JSON)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^adme-my-data-\d{4}-\d{2}-\d{2}\.json$/,
  );
  const text = readFileSync((await download.path())!, "utf8");
  const data = JSON.parse(text);
  expect(data.account.email).toBe(email);
  expect(text).toContain(`내 답장 ${tag}`);
  expect(text).not.toContain(`브랜드 비밀 ${tag}`);
  expect(text).not.toContain(`브랜드 비공개 브리프 ${tag}`);
  expect(text).not.toContain(accounts.brand.id);
  expect(text).not.toMatch(/payment_key|token_hash|decided_by/);
  expect(data.proposals.find((p: { id: string }) => p.id === pid).my_role).toBe(
    "creator",
  );
  await expect(page.getByText("내 데이터 파일을 내려받았습니다", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("privacy-log")).toContainText("내려받기 완료");
  await expect(page.getByTestId("privacy-log")).toContainText("내보내기 요청");
  // A guessed ticket is refused through the API.
  const res = await page.request.post("/api/privacy/download", {
    data: { id: randomUUID(), token: "0".repeat(64) },
  });
  expect(res.status()).toBe(403);
});

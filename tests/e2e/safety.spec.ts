import { verifyAdminOtp } from "./support/admin";
// D062 UI: creator blocks a brand from the collaboration card (two-step, no dialog); the brand can no longer
// message; unblock from settings. Admin applies a temporary restriction from the report queue; the restricted
// creator sees the notice and appeals; admin sees the appeal and lifts it.
import { qaSignupConsent } from "../support/consent-fixture.mjs";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { publishCreatorFixture } from "../support/local-db-fixture";
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
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
async function fresh(role: "brand" | "creator") {
  const email = `adme-qa-d062ui-${randomUUID().slice(0, 8)}@example.com`,
    password = randomUUID() + "Aa!";
  const db = client();
  const id = (
    await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          ...qaSignupConsent,
          role,
          name: role === "brand" ? "D062 브랜드" : "D062 크리에이터",
        },
      },
    })
  ).data.user!.id;
  if (role === "creator")
    publishCreatorFixture(`user-${id}`, id, {
      name: "D062 크리에이터",
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
    });
  return { db, id, email, password, cid: `user-${id}` };
}
async function proposal(
  b: Awaited<ReturnType<typeof fresh>>,
  c: Awaited<ReturnType<typeof fresh>>,
) {
  const camp = (
    await b.db
      .from("campaigns")
      .insert({
        owner_id: b.id,
        status: "published",
        brief: {
          title: "D062 UI",
          product: "QA",
          category: "뷰티",
          vibes: ["자연스러움"],
          format: "숏폼",
          platforms: ["youtube"],
          budget_krw: 100000,
          target_audience: "QA",
          goal: "안전 UI",
          status: "published",
        },
      })
      .select("id")
      .single()
  ).data!.id;
  // Same server path as POST /api/proposals.
  const made = await b.db.rpc("create_creator_proposal", {
    p_campaign: camp,
    p_creator: c.cid,
    p_kind: "proposal",
    p_brief: "D062 UI 검증용 제안입니다.",
  });
  expect(made.error).toBeNull();
  return made.data as string;
}

test("block from collaboration, brand cannot message, unblock in settings", async ({
  page,
  browser,
}) => {
  const b = await fresh("brand"),
    c = await fresh("creator");
  const pid = await proposal(b, c);
  await login(page, c.email, c.password);
  const card = page.locator(`article[data-proposal-id="${pid}"]`);
  await card.getByRole("button", { name: "상대 차단" }).click();
  await expect(card).toContainText("서로 연락할 수 없게 됩니다");
  await card.getByRole("button", { name: "차단 확정" }).click();
  await expect(card).toContainText("차단한 상대입니다");
  await expect(card).toContainText("거절");
  const bc = await browser.newContext();
  const bp = await bc.newPage();
  await login(bp, b.email, b.password);
  const res = await bp.evaluate(async (proposalId) => {
    const r = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proposalId,
        kind: "message",
        body: "차단 후 메시지",
      }),
    });
    return [r.status, (await r.json()).error?.message];
  }, pid);
  expect(res).toEqual([403, "이 상대와는 더 이상 연락할 수 없습니다."]);
  await bc.close();
  await page.goto("/settings");
  const row = page
    .getByTestId("blocked-user")
    .filter({ hasText: "D062 브랜드" });
  await row.getByRole("button", { name: "차단 해제" }).click();
  await expect(page.getByTestId("blocked-user")).toHaveCount(0);
});

test("admin temporary restriction, creator appeal, admin lift", async ({
  page,
  browser,
}) => {
  const b = await fresh("brand"),
    c = await fresh("creator");
  await proposal(b, c);
  const ticket = (
    await b.db.rpc("submit_report", {
      p_kind: "impersonation",
      p_creator: c.cid,
      p_reason: "다른 크리에이터를 사칭하고 있습니다.",
      p_source_url: "https://example.com/real-channel",
    })
  ).data[0].ticket_no as string;
  const ac = await browser.newContext();
  const ap = await ac.newPage();
  await login(ap, accounts.admin.email, accounts.admin.password);
  await verifyAdminOtp(ap, accounts.admin.totpSecret);
  await ap.goto("/admin");
  const item = ap.getByTestId("admin-report").filter({ hasText: ticket });
  await expect(item).toContainText("사칭 신고");
  await expect(item.getByRole("button", { name: "7일 연락 제한" })).toHaveCount(
    0,
  ); // only after a human starts review
  await item.getByRole("button", { name: "검토 시작" }).click();
  await item.getByLabel(/연락 제한 사유/).fill("사칭 확인 후 7일 연락 제한");
  await item.getByRole("button", { name: "7일 연락 제한" }).click();
  await expect(item.getByText("7일 연락 제한을 적용했습니다.")).toBeVisible();

  await login(page, c.email, c.password);
  const notice = page.getByTestId("restriction");
  await expect(notice).toContainText("사칭 확인 후 7일 연락 제한");
  await notice
    .getByLabel("이의신청 사유")
    .fill("공식 채널 링크로 본인임을 증명할 수 있습니다.");
  await notice.getByRole("button", { name: "이의신청하기" }).click();
  await expect(notice).toContainText("이의신청 접수됨");

  await ap.reload();
  const r = ap
    .getByTestId("admin-restriction")
    .filter({ hasText: "사칭 확인 후 7일 연락 제한" });
  await expect(r).toContainText(
    "공식 채널 링크로 본인임을 증명할 수 있습니다.",
  );
  await r.getByRole("button", { name: "제한 해제" }).click();
  await expect(
    ap
      .getByTestId("admin-restriction")
      .filter({ hasText: "사칭 확인 후 7일 연락 제한" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("restriction")).toHaveCount(0);
  await ac.close();
});

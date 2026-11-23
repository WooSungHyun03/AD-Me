// D061: brand-private checklist + memo + manual approval gate before selecting an applicant.
// A fresh brand per run so its checklist never gates other specs.
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const sql = (q: string) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_AD-Me",
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-qtA",
    ],
    { input: q, encoding: "utf8" },
  ).trim();
async function login(page: Page, acc: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(acc.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(acc.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("selection review: checklist + approval required before accepting; memo stays private", async ({
  page,
  browser,
}) => {
  expect(env.NEXT_PUBLIC_SUPABASE_URL).toMatch(
    /^http:\/\/(127\.0\.0\.1|localhost):/,
  );
  const svc = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false },
    },
  );
  const acc = {
    email: `sel-review-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`,
    password: "Sel-Review-2026!",
  };
  const { data: u } = await svc.auth.admin.createUser({
    ...acc,
    email_confirm: true,
    user_metadata: { role: "brand", name: "선정 검토 브랜드" },
  });
  const uid = u.user!.id;
  sql(`update profiles set role = 'brand' where id = '${uid}'`);
  const cid = sql(
    `select id from creators where owner_id = '${accounts.creator.id}'`,
  );
  const wasPublished = sql(
    `select published from creators where id = '${cid}'`,
  );
  sql(`update creators set published = true where id = '${cid}'`);
  const MEMO = `내부메모-${Date.now()}`;
  try {
    await login(page, acc);
    const made = await page.request.post("/api/campaigns", {
      data: {
        title: `선정 검토 ${Date.now()}`,
        product: "QA",
        category: "뷰티",
        vibes: ["자연스러움"],
        format: "숏폼",
        platforms: ["instagram"],
        budget_krw: 1000000,
        target_audience: "20대",
        goal: "선정 검토 게이트",
        status: "published",
      },
    });
    expect(made.status()).toBe(201);
    const { id } = await made.json();
    const pid =
      sql(`insert into proposals(campaign_id, creator_id, brand_id, creator_user_id, kind, status, brief)
      values ('${id}', '${cid}', '${uid}', '${accounts.creator.id}', 'application', 'pending', '선정 검토 E2E 지원서입니다.') returning id`).split(
        "\n",
      )[0];

    await page.goto(`/campaigns/${id}`);
    const section = page.getByTestId("selection-review");
    await section.getByLabel("새 체크 항목").fill("광고 표기 이력 확인");
    await section.getByRole("button", { name: "항목 추가" }).click();
    await expect(
      section.getByRole("form", { name: /선정 검토$/ }),
    ).toContainText("광고 표기 이력 확인");

    // Not approved → selecting is refused with a clear reason.
    const accept = () =>
      page.request.patch("/api/proposals", {
        data: { id: pid, action: "accepted" },
      });
    const r1 = await accept();
    expect(r1.status()).toBe(409);
    expect((await r1.json()).error.message).toContain(
      "선정 전 검토 체크리스트",
    );

    const form = section.getByRole("form", { name: /선정 검토$/ });
    await expect(
      form.getByRole("button", { name: "선정 승인" }),
    ).toBeDisabled();
    await form.getByLabel("검토 메모 (비공개)").fill(MEMO);
    await form.getByRole("checkbox", { name: "광고 표기 이력 확인" }).check();
    await form.getByRole("button", { name: "선정 승인" }).click();
    await expect(form.getByRole("status")).toHaveText(
      "승인했습니다. 이제 선정할 수 있습니다.",
    );
    await page.reload();
    await expect(
      page
        .getByTestId("selection-review")
        .getByRole("form", { name: /선정 검토$/ }),
    ).toContainText("승인됨");
    expect((await accept()).status()).toBe(200);

    // The creator (and the public) never see the memo or the review section.
    const ctx = await browser.newContext();
    const cp = await ctx.newPage();
    await login(cp, accounts.creator);
    for (const path of [`/campaigns/${id}`, `/creators/${cid}`, "/dashboard"]) {
      await cp.goto(path);
      await expect(cp.locator("body")).not.toContainText(MEMO);
      await expect(cp.getByTestId("selection-review")).toHaveCount(0);
    }
    const r = await cp.request.post("/api/notes/review", {
      data: {
        campaignId: id,
        creatorId: cid,
        checked: [],
        memo: "x",
        approve: false,
      },
    });
    expect(r.status()).toBe(403);
    await ctx.close();
  } finally {
    sql(
      `update creators set published = ${wasPublished === "t"} where id = '${cid}'`,
    );
    await svc.auth.admin.deleteUser(uid);
  }
});

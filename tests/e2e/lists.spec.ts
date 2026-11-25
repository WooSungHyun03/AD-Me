// D036 UI: named groups, add from creator page, duplicate guard, persistence across re-login, campaign shortlist.
import { test, expect, type Page } from "@playwright/test";
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
const { brand } = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
async function login(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(brand.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(brand.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test("candidate groups and campaign shortlist", async ({ page }, info) => {
  const tag = randomUUID().slice(0, 6);
  await login(page);
  await page.goto("/lists");
  await expect(page.getByTestId("saved-list").first()).toContainText(
    "기본 목록",
  );
  await page.getByLabel("새 후보 그룹 이름").fill(`여름 ${tag}`);
  await page.getByRole("button", { name: "그룹 만들기" }).click();
  const group = page
    .getByTestId("saved-list")
    .filter({ hasText: `여름 ${tag}` });
  await expect(group).toBeVisible();
  await group.getByLabel(`여름 ${tag} 새 이름`).fill(`가을 ${tag}`);
  await group.getByRole("button", { name: "이름 저장" }).click();
  const renamed = page
    .getByTestId("saved-list")
    .filter({ hasText: `가을 ${tag}` });
  await expect(renamed).toBeVisible();

  await page.goto("/creators/creator-001");
  await page.getByLabel("후보 그룹").selectOption({ label: `가을 ${tag}` });
  await page.getByRole("button", { name: "그룹에 추가" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "추가했습니다" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "그룹에 추가" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "이미 이 그룹에" }),
  ).toBeVisible();

  await login(page); // persists across sessions
  await page.goto("/lists");
  await expect(renamed).toContainText("서하린");
  await renamed.getByRole("button", { name: "서하린 그룹에서 빼기" }).click();
  await expect(renamed).toContainText("아직 담긴 크리에이터가 없습니다");
  await renamed.getByRole("button", { name: "그룹 삭제" }).click();
  await expect(renamed).toHaveCount(0);

  const made = await page.request.post("/api/campaigns", {
    data: {
      title: `후보 캠페인 ${tag}`,
      product: "QA",
      category: "뷰티",
      vibes: ["자연스러움"],
      format: "숏폼",
      platforms: ["instagram"],
      budget_krw: 1000000,
      target_audience: "20대",
      goal: "후보 검증",
      status: "draft",
    },
  });
  const { id } = await made.json();
  await page.goto(`/campaigns/${id}`);
  await expect(page.getByText("캠페인 후보 목록 (0)")).toBeVisible();
  const first = page
    .getByRole("button", { name: /캠페인 후보에 담기/ })
    .first();
  const name = (await first.getAttribute("aria-label"))!.replace(
    " 캠페인 후보에 담기",
    "",
  );
  await first.click();
  await expect(page.getByText("캠페인 후보 목록 (1)")).toBeVisible();
  await page
    .getByRole("button", { name: /캠페인 후보에 담기/ })
    .first()
    .click();
  await expect(page.getByText("캠페인 후보 목록 (2)")).toBeVisible();
  if (process.env.ADME_EVIDENCE_DIR)
    await page.screenshot({
      path: `${process.env.ADME_EVIDENCE_DIR}/campaign-shortlist-${info.project.name}.png`,
      fullPage: true,
    });
  await page.getByRole("button", { name: `${name} 그룹에서 빼기` }).click();
  await expect(page.getByText("캠페인 후보 목록 (1)")).toBeVisible();
  await page.goto("/lists");
  await expect(
    page
      .getByTestId("saved-list")
      .filter({ hasText: `후보 캠페인 ${tag} 후보` }),
  ).toContainText("캠페인 후보");
  await page.request.delete(`/api/campaigns?id=${id}`);
});

// D036 (2026-11-25): real registered creators are addressed by their opaque public reference.
test("public reference add, retry, denial and shortlist display", async ({
  page,
}, info) => {
  const { execFileSync } = await import("node:child_process");
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
        "-Atq",
      ],
      { input: q, encoding: "utf8" },
    ).trim();
  const tag = randomUUID().slice(0, 6);
  const internal = `user-${randomUUID()}`;
  const name = `공개참조 후보 ${tag}`;
  // Local owner fixture (session_user postgres); no auth account is needed for a catalog row.
  sql(
    `insert into public.creators(id,owner_id,published,profile) values('${internal}',null,true,'{"name":"${name}","bio":"","handle":"qa","categories":["뷰티"],"vibes":["자연스러움"],"formats":["숏폼"],"platforms":["youtube"],"price_min_krw":null,"price_max_krw":null,"followers":0,"is_available":true,"is_demo":false}')`,
  );
  const ref = sql(`select adme_creator.public_reference('${internal}')`);
  expect(ref).not.toBe(internal);
  try {
    await login(page);
    const made = await page.request.post("/api/lists", {
      data: { name: `공개참조 ${tag}` },
    });
    expect(made.status()).toBe(201);
    const { id: listId } = await made.json();
    const add = () =>
      page.request.post("/api/lists/items", {
        data: { listId, creatorId: ref },
      });
    expect((await add()).status()).toBe(201);
    expect((await add()).status()).toBe(409); // retry: no duplicate row
    expect(
      (
        await page.request.post("/api/lists/items", {
          data: { listId, creatorId: `missing-${tag}` },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post("/api/lists/items", {
          data: { listId: randomUUID(), creatorId: ref },
        })
      ).status(),
    ).toBe(404);
    await page.goto("/lists");
    const group = page
      .getByTestId("saved-list")
      .filter({ hasText: `공개참조 ${tag}` });
    await expect(group.getByRole("link", { name })).toHaveAttribute(
      "href",
      `/creators/${encodeURIComponent(ref)}`,
    );
    expect(await page.content()).not.toContain(internal);
    const dir = process.env.ADME_EVIDENCE_DIR;
    if (dir)
      await page.screenshot({
        path: `${dir}/lists-${info.project.name}.png`,
        fullPage: true,
      });
    await group.getByRole("button", { name: `${name} 그룹에서 빼기` }).click();
    await expect(group).toContainText("아직 담긴 크리에이터가 없습니다");
    await page.request.delete(`/api/lists?id=${listId}`);
  } finally {
    sql(`delete from public.creators where id='${internal}'`);
  }
});

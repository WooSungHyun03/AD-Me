import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { localRuntime, sql } from "../support/local-qa.mjs";
import { completeProductConditionFixture } from "../support/product-condition-worker.mjs";
const accounts = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
test("owned product proposal requires explicit selection and confirmation before search; retries, stale source and manual fallback", async ({
  page,
  browser,
}, info) => {
  localRuntime();
  const product = randomUUID(),
    path = `/brand/products/${product}/recommendations`;
  const controls = JSON.parse(
      sql("select to_jsonb(c)from adme_product_conditions.controls c"),
    ),
    llm = sql("select llm_enabled from adme_ops.resource_controls"),
    counts = sql(
      "select jsonb_build_array((select count(*)from public.orders),(select count(*)from public.entitlements))",
    );
  const otherContext = await browser.newContext({ ignoreHTTPSErrors: true }),
    other = await otherContext.newPage();
  const login = async (p: typeof page, account: typeof accounts.brand) => {
    await p.goto("/login");
    await p.getByLabel("이메일", { exact: true }).fill(account.email);
    await p.getByLabel("비밀번호", { exact: true }).fill(account.password);
    await p.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(p).toHaveURL(/dashboard/);
  };
  try {
    sql(
      `insert into public.brand_products(id,owner_id,name,description)values('${product}','${accounts.brand.id}','가상 음식 상품','음식 분야의 제품 리뷰를 자연스러움 분위기로 소개합니다. 음식 <img src="x" onerror="alert(1)">');update adme_product_conditions.controls set enabled=true,policy_ref='FICTIONAL browser PR001 policy',retention_seconds=3600;update adme_ops.resource_controls set llm_enabled=true;`,
    );
    await login(page, accounts.brand);
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "상품에서 추천 조건 찾기" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "수동으로 유튜버 추천 조건 입력" }),
    ).toBeVisible();
    await page.getByLabel("직접 입력한 타깃 고객").fill("가상 성인 고객");
    let lostCreate = true,
      lostConfirm = true;
    await page.route("**/api/product-conditions", async (route) => {
      const method = route.request().method();
      if (
        (method === "POST" && lostCreate) ||
        (method === "PATCH" && lostConfirm)
      ) {
        if (method === "POST") lostCreate = false;
        else lostConfirm = false;
        const response = await route.fetch();
        expect(response.status()).toBe(method === "POST" ? 202 : 200);
        await route.abort("connectionreset");
      } else await route.continue();
    });
    await page
      .getByRole("button", { name: "상품 조건 추출 요청", exact: true })
      .click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "전송 결과를 확인하지 못했습니다",
    );
    await page
      .getByRole("button", { name: "상품 조건 추출 요청", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("조건 추출 대기 중");
    const id = sql(
      `select id from adme_product_conditions.requests where product_id='${product}'`,
    );
    expect(id.split("\n")).toHaveLength(1);
    await expect(
      page.getByRole("form", { name: "유튜버 추천 조건" }),
    ).toHaveCount(0);
    await completeProductConditionFixture(id);
    await page.getByRole("button", { name: "현재 상태 다시 불러오기" }).click();
    await expect(page.getByRole("status")).toContainText(
      "검토할 조건이 준비됐습니다",
    );
    await expect(
      page.getByRole("button", { name: "선택한 조건 확인·추천 폼에 반영" }),
    ).toBeDisabled();
    await page.getByRole("checkbox", { name: /분야 · 음식/ }).check();
    await page.getByRole("checkbox", { name: /형식 · 제품 리뷰/ }).check();
    expect(await page.locator('img[src="x"]').count()).toBe(0);
    await page
      .getByRole("button", { name: "선택한 조건 확인·추천 폼에 반영" })
      .click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "처리 결과를 확인하지 못했습니다",
    );
    await page
      .getByRole("button", { name: "선택한 조건 확인·추천 폼에 반영" })
      .click();
    await expect(
      page.getByRole("form", { name: "유튜버 추천 조건" }),
    ).toBeVisible();
    expect(
      sql(
        `select revision||':'||decision from adme_product_conditions.requests where id='${id}'`,
      ),
    ).toBe("1:confirmed");
    await expect(page.getByRole("combobox",{name:"콘텐츠 분야",exact:true})).toHaveValue(
      "음식",
    );
    await expect(page.getByRole("combobox",{name:"콘텐츠 형식 (선택)",exact:true})).toHaveValue(
      "제품 리뷰",
    );
    await expect(
      page.getByRole("heading", { name: "가상 음식 상품 협업 후보" }),
    ).toHaveCount(0);
    await page.getByLabel("광고 예산 (원)").fill("10000");
    await page
      .getByRole("button", { name: "조건에 맞는 유튜버 찾기", exact: true })
      .click();
    await expect(
      page.getByText("사용자가 확인한 상품 조건", { exact: false }),
    ).toBeVisible();
    expect(
      sql(
        "select jsonb_build_array((select count(*)from public.orders),(select count(*)from public.entitlements))",
      ),
    ).toBe(counts);
    await page.screenshot({
      path: `output/playwright/product-conditions-${info.project.name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await login(other, accounts.other);
    expect(
      (await other.request.get(`/api/product-conditions?id=${id}`)).status(),
    ).toBe(404);
    await other.goto(path);
    await expect(
      other.getByRole("heading", { name: "찾으시는 페이지가 없습니다." }),
    ).toBeVisible();
    sql(
      `update public.brand_products set description=description||' changed fictional source'where id='${product}'`,
    );
    await page
      .getByRole("button", { name: "조건에 맞는 유튜버 찾기", exact: true })
      .click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "상품이나 확인한 조건이 변경됐습니다",
    );
    await page.getByRole("button", { name: "현재 상태 다시 불러오기" }).click();
    await expect(page.getByRole("status")).toContainText(
      "이전 조건을 적용할 수 없습니다",
    );
    await expect(
      page.getByRole("form", { name: "유튜버 추천 조건" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "새 입력으로 다시 준비" }).click();
    await page
      .getByRole("button", { name: "상품 조건 추출 요청", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("조건 추출 대기 중");
    const next = sql(
      `select id from adme_product_conditions.requests where product_id='${product}'and id<>'${id}'`,
    );
    await completeProductConditionFixture(next);
    await page.getByRole("button", { name: "현재 상태 다시 불러오기" }).click();
    await expect(page.getByRole("status")).toContainText(
      "검토할 조건이 준비됐습니다",
    );
    await page.getByRole("button", { name: "이 제안 사용 안 함" }).click();
    await expect(
      page.getByText("이 제안은 사용하지 않기로 했습니다.", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("form", { name: "유튜버 추천 조건" }),
    ).toHaveCount(0);
    await page
      .getByRole("link", { name: "수동으로 유튜버 추천 조건 입력" })
      .click();
    await expect(
      page.getByRole("button", {
        name: "조건에 맞는 유튜버 찾기",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await otherContext.close();
    sql(
      `begin;delete from adme_ops.jobs where id in(select id from adme_product_conditions.requests where product_id='${product}');delete from public.brand_products where id='${product}';delete from adme_ops.rate_windows where subject='${accounts.brand.id}'and scope in('draft_day','product_conditions_read','product_conditions_latest','product_conditions_decide');update adme_product_conditions.controls set enabled=${controls.enabled},policy_ref=${controls.policy_ref === null ? "null" : `'${controls.policy_ref.replaceAll("'", "''")}'`},retention_seconds=${controls.retention_seconds ?? "null"};update adme_ops.resource_controls set llm_enabled=${llm === "t"};commit;`,
    );
  }
});

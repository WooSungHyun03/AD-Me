import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("brand product and private YouTube draft use the persisted TEST catalogue", async ({
  page,
}) => {
  const { email, password } = JSON.parse(
    readFileSync(
      process.env.ADME_ACCOUNTS_FILE || ".accounts.local.json",
      "utf8",
    ),
  ).brand;
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/brand/products");
  const name = "QA 광고 상품 " + randomUUID().slice(0, 8);
  await page.getByLabel("상품 이름").fill(name);
  await page.getByLabel("상품 설명").fill("테스트용 상품 설명입니다.");
  await page.getByRole("button", { name: "상품 등록", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "상품을 등록했습니다." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "공고 초안 만들기" }).click();
  await page.getByLabel("광고 상품").selectOption({ label: name });
  await page.getByLabel("공고 제목").fill(name + " 모집");
  await page.getByLabel("총 예산 (원)").fill("100000");
  await page
    .getByLabel("광고 목표와 요청 결과물")
    .fill("제품을 소개하는 리뷰 영상");
  await page.getByLabel("대상 시청자").fill("20대 성인");
  await page.getByLabel("콘텐츠 분위기 (쉼표로 구분)").fill("자연스러움");
  await page.getByRole("button", { name: "무료로 초안 저장" }).click();
  await expect(page).toHaveURL(/jobs\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: name + " 모집" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "게시권 1장으로 공개" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "사용 가능한 이용권이 없습니다." }),
  ).toBeVisible();
  const [first, second] = await Promise.all([
    page.request.post("/api/billing/orders", {
      data: { sku: "job_post", amount: 1 },
    }),
    page.request.post("/api/billing/orders", {
      data: { sku: "job_post", amount: 1 },
    }),
  ]);
  expect(first.status()).toBe(200);
  expect(second.status()).toBe(200);
  const order = await first.json();
  expect(order.amount).toBe(5000);
  expect((await second.json()).id).toBe(order.id);
  const other = await page.context().browser()!.newContext();
  try {
    const anonymous = await other.newPage();
    await anonymous.goto(page.url());
    await expect(
      anonymous.getByRole("heading", { name: "찾으시는 페이지가 없습니다." }),
    ).toBeVisible();
  } finally {
    await other.close();
  }
});

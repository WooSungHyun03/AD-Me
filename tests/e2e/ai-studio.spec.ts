import { test, expect } from "@playwright/test";

test("legacy studio routes lead to the active creator and campaign flows", async ({
  page,
}) => {
  await page.goto("/tools");
  await expect(page).toHaveURL(/\/creators$/);
  await expect(
    page.getByRole("navigation", { name: "메인 메뉴" }),
  ).not.toContainText("AI 스튜디오");
  await page.goto("/tools/local");
  await expect(page).toHaveURL(/\/login\?next=.*campaigns|\/campaigns\/new/);
});

test("the draft adapter still validates API input and returns its format", async ({
  page,
}) => {
  const post = (data: object) => page.request.post("/api/ai/draft", { data });
  expect((await post({ kind: "hack", input: {} })).status()).toBe(400);
  expect(
    (await post({ kind: "concept", input: { product: "" } })).status(),
  ).toBe(400);
  const r = await post({
    kind: "brief",
    input: { product: "토너", audience: "20대", tone: "차분한" },
  });
  expect(await r.json()).toMatchObject({
    method: "template",
    fallback_reason: "LLM 공급자 미연결",
    version: "template-v2",
  });
});

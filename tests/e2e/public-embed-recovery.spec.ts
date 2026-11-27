import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { localRuntime, sql } from "../support/local-qa.mjs";

test("opt-in embed keeps original fallback, retries, shares without clipboard permission and disappears after withdrawal", async ({
  page,
}) => {
  localRuntime();
  const owner = randomUUID(),
    id = `user-${owner}`;
  let requests = 0;
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: () => Promise.reject(new Error("QA clipboard denied")),
      },
    }),
  );
  await page.route("https://www.youtube-nocookie.com/**", async (route) => {
    requests++;
    await route.abort("internetdisconnected");
  });
  try {
    sql(`insert into auth.users(id,raw_user_meta_data) values('${owner}','{"role":"creator","name":"가상 임베드 QA"}');
      insert into public.creators(id,owner_id,published,profile) select '${id}','${owner}',true,
      profile||jsonb_build_object('name','가상 임베드 QA','is_demo',false,'owner_consent',true,'social_url','https://www.youtube.com/watch?v=p0Fixture01') from public.creators where id='creator-001';`);
    await page.goto(`/creators/${id}`);
    await expect(page).toHaveURL(/\/creators\/c-[a-f0-9-]{36}$/);
    expect(requests).toBe(0);
    await expect(page.locator("iframe")).toHaveCount(0);
    await page
      .getByRole("button", { name: "공유 링크 복사", exact: true })
      .click();
    await expect(page.getByLabel("공유 링크", { exact: true })).toHaveValue(
      page.url(),
    );
    await page
      .getByRole("button", { name: "YouTube 플레이어 연결", exact: true })
      .click();
    await expect.poll(() => requests).toBe(1);
    await expect(
      page.getByRole("link", { name: "YouTube 원본에서 보기 ↗" }),
    ).toHaveAttribute("href", "https://www.youtube.com/watch?v=p0Fixture01");
    await page
      .getByRole("button", { name: "플레이어 다시 연결", exact: true })
      .click();
    await expect.poll(() => requests).toBe(2);
    await page
      .getByRole("button", { name: "YouTube 영상 닫기", exact: true })
      .click();
    await expect(page.locator("iframe")).toHaveCount(0);
    sql(`update public.creators set published=false where id='${id}';`);
    const withdrawn = await page.goto(page.url());
    // Next streams not-found UI with HTTP200 once response headers are sent.
    expect([200, 404]).toContain(withdrawn?.status());
    await expect(
      page.getByRole("heading", {
        name: "찾으시는 페이지가 없습니다.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "가상 임베드 QA", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "SNS 원본 ↗" })).toHaveCount(0);
    await expect(page.locator("iframe")).toHaveCount(0);
  } finally {
    sql(
      `delete from public.creators where id='${id}';delete from auth.users where id='${owner}';`,
    );
  }
});

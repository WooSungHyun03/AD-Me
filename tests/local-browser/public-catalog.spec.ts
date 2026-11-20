import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { localRuntime, sql } from "../support/local-qa.mjs";

test("public RSC catalog excludes private JSON fields and treats owner placeholder followers as unavailable", async ({
  page,
}) => {
  localRuntime();
  const owner = randomUUID(),
    id = `user-${owner}`,
    marker = `QA_ONLY_PRIVATE_${randomUUID()}`;
  try {
    sql(`insert into auth.users(id,raw_user_meta_data) values('${owner}','{"role":"creator","name":"가상 공개 DTO QA"}');
      insert into public.creators(id,owner_id,published,profile)
      select '${id}','${owner}',true,profile||jsonb_build_object('name','가상 공개 DTO QA','is_demo',false,'followers',0,'metrics_source','unavailable',
        'owner_id','${owner}','owner_consent',false,'email','${marker}','oauth_token','${marker}','private_review',jsonb_build_object('note','${marker}'))
      from public.creators where id='creator-001';`);
    const response = await page.goto(
      "/creators?q=" + encodeURIComponent("가상 공개 DTO QA"),
    );
    expect(response?.status()).toBe(200);
    expect(await response!.text()).not.toContain(marker);
    await expect(page.getByTestId("creator-card")).toHaveCount(1);
    await expect(page.getByTestId("creator-card")).toContainText(
      "팔로워 미확보",
    );
    await page.getByLabel("최소 팔로워", { exact: true }).fill("0");
    await expect(page.getByTestId("creator-card")).toHaveCount(0);
    await page.getByLabel("최소 팔로워", { exact: true }).fill("");
    await expect(page.getByTestId("creator-card")).toHaveCount(1);
    await page
      .getByTestId("creator-card")
      .getByRole("heading", { name: "가상 공개 DTO QA" })
      .click();
    await expect(page).toHaveURL(new RegExp(`/creators/${id}$`));
    await expect(
      page.getByRole("heading", {
        name: "가상 공개 DTO QA",
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "SNS 원본" })).toHaveCount(0);
    // Legacy user-<Auth UUID> route still exists: opaque-ID and direct-REST
    // migrations remain explicit D018/D033/D075 release blockers.
    expect(page.url()).toContain(id);
  } finally {
    sql(
      `delete from public.creators where id='${id}'; delete from auth.users where id='${owner}';`,
    );
  }
});

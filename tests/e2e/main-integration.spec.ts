import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { localRuntime, sql } from "../support/local-qa.mjs";

test("main directory renders an explicitly fictional local channel, then hides expired source data", async ({
  page,
}, info) => {
  localRuntime();
  const id = "UC" + randomBytes(11).toString("hex");
  try {
    sql(`insert into adme_ops.featured_channel_ids(channel_id)values('${id}');
      insert into adme_ops.channels(channel_id,title,subscriber_count,metadata,videos)values('${id}','가상 채널 QA · fictional fixture',0,'{"description":"로컬 가상 데이터 검증","views":0,"videoCount":0}','[]');`);
    await page.goto(`/creators/youtube/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "가상 채널 QA · fictional fixture",
    );
    await expect(
      page.getByRole("link", { name: "YouTube 원본 채널 열기" }),
    ).toHaveAttribute("href", `https://www.youtube.com/channel/${id}`);
    await expect(
      page.getByText("AD Me 소유권 미확인", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `output/playwright/main-channel-${info.project.name}.png`,
      fullPage: false,
    });
    sql(
      `update adme_ops.channels set expires_at=now()-interval '1 second'where channel_id='${id}';`,
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "찾으시는 페이지가 없습니다." }),
    ).toBeVisible();
  } finally {
    sql(
      `delete from adme_ops.channels where channel_id='${id}';delete from adme_ops.featured_channel_ids where channel_id='${id}';`,
    );
  }
});

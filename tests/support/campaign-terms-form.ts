import type { Page } from "@playwright/test";
export async function fillCampaignTerms(page: Page) {
  for (const [label, value] of [
    ["모집 시작 (KST)", "2027-01-01T00:15"],
    ["모집 종료 (KST)", "2027-01-10T18:00"],
    ["제작 시작 (KST)", "2027-01-11T09:00"],
    ["제작 종료 (KST)", "2027-01-20T18:00"],
    ["게시 시작 (KST)", "2027-01-21T09:00"],
    ["게시 종료 (KST)", "2027-02-01T18:00"],
    ["산출물 1 사용권", "가상 QA 캠페인 채널에서 30일 게시"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
}

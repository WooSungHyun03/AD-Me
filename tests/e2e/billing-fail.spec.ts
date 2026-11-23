// D066: Toss failUrl — user cancel vs other failure shown from the code; the message is untrusted text.
import { test, expect } from "@playwright/test";
test("billing fail page distinguishes cancel and renders provider message as text", async ({
  page,
}) => {
  await page.goto(
    "/billing/fail?code=PAY_PROCESS_CANCELED&message=%EC%B7%A8%EC%86%8C&orderId=x",
  );
  await expect(page.getByTestId("fail-reason")).toContainText(
    "결제를 직접 취소했습니다.",
  );
  await expect(page.getByText("오류 코드 PAY_PROCESS_CANCELED")).toBeVisible();
  let dialog = false;
  page.on("dialog", (d) => {
    dialog = true;
    void d.dismiss();
  });
  await page.goto(
    `/billing/fail?code=REJECT_CARD_COMPANY&message=${encodeURIComponent("<img src=x onerror=alert(1)>")}`,
  );
  await expect(page.getByTestId("fail-reason")).toContainText(
    "카드사에서 결제를 거절했습니다.",
  );
  await expect(page.getByText("<img src=x onerror=alert(1)>")).toBeVisible();
  expect(await page.locator("img[src=x]").count()).toBe(0);
  await page.goto("/billing/fail?code=<script>");
  await expect(page.getByTestId("fail-reason")).toContainText(
    "결제 오류로 승인되지 않았습니다.",
  );
  await expect(page.getByText(/오류 코드/)).toHaveCount(0);
  expect(dialog).toBe(false);
});

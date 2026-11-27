import { expect, test } from "@playwright/test";
import { recruitmentFixture } from "../support/local-recruitment.mjs";
import { installSession, localSession } from "../support/local-session";
import { sql } from "../support/local-qa.mjs";
test("D049 sender cancellation and recipient acceptance recover a lost response without duplicate history", async ({
  page,
  browser,
  baseURL,
}, info) => {
  const f = await recruitmentFixture();
  const context = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: true,
    viewport: info.project.use.viewport,
  });
  const brand = await context.newPage();
  async function application() {
    const c = await f.campaign("요청 재시도");
    const r = await f.creators[0].db.rpc("marketplace_action", {
      p_action: "apply",
      p_campaign: c.id,
      p_pitch: "가상 협업 요청의 재시도를 검증합니다.",
    });
    expect(r.error).toBeNull();
    return r.data.id;
  }
  try {
    // LiveMessages refreshes once realtime subscribes; on a slow server that lands after the lost response and
    // shows the settled state, removing the retry this spec exercises (the replica has no realtime service).
    for (const p of [page, brand])
      await p.routeWebSocket(/\/realtime\//, (ws) => ws.close());
    await installSession(page, baseURL!, await localSession(f.creators[0]));
    await installSession(brand, baseURL!, await localSession(f.brand));
    for (const [actor, action, label, result] of [
      [page, "cancelled", "요청 취소", "취소됨"],
      [brand, "accepted", "수락", "협업 진행"],
    ] as const) {
      const id = await application(),
        keys: string[] = [];
      let lost = false;
      await actor.goto("/dashboard");
      const card = actor.locator("#proposal-" + id);
      await actor.route("**/api/proposals", async (route) => {
        if (route.request().method() !== "PATCH") {
          await route.continue();
          return;
        }
        const payload = route.request().postDataJSON();
        expect(payload.action).toBe(action);
        expect(payload.expectedStatus).toBe("pending");
        keys.push(payload.requestKey);
        if (!lost) {
          lost = true;
          expect((await route.fetch()).status()).toBe(200);
          await route.abort("connectionreset");
        } else await route.continue();
      });
      await card.getByRole("button", { name: label, exact: true }).click();
      await expect(card.getByRole("alert")).toContainText(
        "처리 결과를 확인하지 못했습니다",
      );
      await card.getByRole("button", { name: label, exact: true }).click();
      await expect(card.getByText(result, { exact: true })).toBeVisible();
      expect(keys.length).toBe(2);
      expect(keys[0]).toBe(keys[1]);
      expect(
        sql(
          `select count(*) from public.proposal_events where proposal_id='${id}'`,
        ),
      ).toBe("2");
      expect(
        sql(
          `select count(*) from public.notifications where proposal_id='${id}'`,
        ),
      ).toBe("2");
      expect(
        sql(
          `select count(*) from adme_ops.proposal_action_receipts where proposal_id='${id}'`,
        ),
      ).toBe("1");
      await actor.unroute("**/api/proposals");
      const counterpart = actor === page ? brand : page;
      await counterpart.goto("/dashboard");
      await expect(
        counterpart
          .locator("#proposal-" + id)
          .getByText(result, { exact: true }),
      ).toBeVisible();
      if (action === "cancelled") {
        await card.screenshot({
          path: `output/playwright/d049-cancel-${info.project.name}.png`,
        });
        expect(
          (
            await brand.request.patch("/api/proposals", {
              headers: { origin: baseURL! },
              data: { id, action: "accepted" },
            })
          ).status(),
        ).toBe(409);
      }
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await page.context().clearCookies();
    await context.close();
    await f.cleanup();
  }
});

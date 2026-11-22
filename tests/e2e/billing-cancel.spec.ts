// D068: the dashboard offers TEST cancel only on paid orders, the API refuses bad input / anonymous callers and
// never accepts a paymentKey. Locally there is no Toss TEST secret / edge runtime, so the cancel attempt must fail
// visibly and leave the order paid (provider cancel itself is BLOCKED and covered by tests/test-cancel.mjs on the DB side).
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
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
      "-qtA",
    ],
    { input: q, encoding: "utf8" },
  ).trim();
test("TEST cancel is offered on paid orders and fails safely without provider keys", async ({
  page,
  request,
}) => {
  const svc = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const email = `cancel-e2e-${Date.now()}-${randomUUID().slice(0, 6)}@example.com`,
    password = `Pw-${randomUUID()}`;
  const { data } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  const uid = data.user!.id;
  try {
    sql(
      `update profiles set role = 'brand', name = '취소 테스트' where id = '${uid}'`,
    );
    const order = sql(
      `insert into orders(owner_id, sku, amount) values ('${uid}', 'brand_pro', 49000) returning id`,
    )
      .split("\n")
      .pop()!;
    sql(
      `select finalize_test_order('${order}', '${uid}', 'fake_${randomUUID()}', 49000)`,
    );

    expect(
      (
        await request.post("/api/billing/cancel", {
          data: {
            orderId: order,
            idempotencyKey: randomUUID(),
            reason: "테스트",
          },
        })
      ).status(),
    ).toBe(401);

    await page.goto("/login");
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/dashboard/);
    const row = page.getByRole("row").filter({ hasText: "brand_pro" });
    await expect(row).toContainText("TEST 결제 완료");
    const bad = await page.request.post("/api/billing/cancel", {
      data: { orderId: order, paymentKey: "x", reason: "a" },
    });
    expect(bad.status()).toBe(400);

    await row.getByLabel("취소 사유").fill("테스트 취소");
    await row.getByRole("button", { name: "TEST 취소" }).click();
    await expect(row.getByRole("alert")).toContainText("Edge Function", { timeout: 30_000 });
    expect(sql(`select status from orders where id = '${order}'`)).toBe("paid");
    expect(
      sql(
        `select count(*) from payment_cancellations where order_id = '${order}'`,
      ),
    ).toBe("0");
  } finally {
    sql(`delete from payment_cancellations where owner_id = '${uid}'; delete from credit_ledger where owner_id = '${uid}';
         delete from entitlements where owner_id = '${uid}'; delete from orders where owner_id = '${uid}';`);
    await svc.auth.admin.deleteUser(uid);
  }
});

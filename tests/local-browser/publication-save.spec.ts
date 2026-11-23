import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import { localClient, localRuntime, sql } from "../support/local-qa.mjs";
import { qaSignupConsent } from "../support/consent-fixture.mjs";
for (const role of ["creator", "brand"] as const)
  test(`${role} publication save survives lost acknowledgement and stale replay cannot undo withdrawal`, async ({
    page,
  }, info) => {
    const runtime = localRuntime(),
      admin = localClient(runtime.SERVICE_ROLE_KEY),
      email = `publication-${randomUUID()}@example.test`,
      password = randomBytes(24).toString("base64url");
    const made = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { ...qaSignupConsent, role, name: "가상 공개 저장" },
    });
    expect(made.error).toBeNull();
    const id = made.data.user!.id;
    try {
      await page.goto("/login");
      await page.getByLabel("이메일", { exact: true }).fill(email);
      await page.getByLabel("비밀번호", { exact: true }).fill(password);
      await page.getByRole("button", { name: "로그인", exact: true }).click();
      await expect(page).toHaveURL(/dashboard/);
      await page.goto("/settings");
      if (role === "creator") {
        await page
          .getByLabel("크리에이터 이름", { exact: true })
          .fill("가상 공개 저장");
        await page.getByLabel("소개", { exact: true }).fill("가상 로컬 프로필");
        await page.getByLabel("프로필 공개", { exact: true }).check();
      } else {
        await page
          .getByLabel("브랜드명", { exact: true })
          .fill("가상 공개 브랜드");
        await page.getByLabel("업종", { exact: true }).fill("교육");
        await page
          .getByLabel("브랜드 소개", { exact: true })
          .fill("가상 로컬 브랜드 소개");
        await page.getByLabel("브랜드 소개 공개", { exact: true }).check();
      }
      const path = role === "creator" ? "/api/profile" : "/api/account",
        button = role === "creator" ? "프로필 저장" : "브랜드 정보 저장";
      const sent: Record<string, unknown>[] = [];
      let dropped = false;
      await page.route("**" + path, async (route) => {
        if (["POST", "PATCH"].includes(route.request().method())) {
          sent.push(route.request().postDataJSON());
          if (!dropped) {
            dropped = true;
            const reply = await route.fetch();
            expect(reply.status()).toBe(200);
            await route.abort("connectionreset");
            return;
          }
        }
        await route.continue();
      });
      await page.getByRole("button", { name: button, exact: true }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "네트워크" }),
      ).toBeVisible();
      await page.getByRole("button", { name: button, exact: true }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "저장했습니다" }),
      ).toBeVisible();
      expect(sent).toHaveLength(2);
      expect(sent[0]).toEqual(sent[1]);
      expect(
        sql(
          `select count(*) from adme_consent.events where actor_id='${id}' and scope='${role}' and accepted;`,
        ),
      ).toBe("1");
      await page
        .getByRole("button", { name: "선택적 프로필 공개 철회", exact: true })
        .click();
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: "선택적 공개를 철회했습니다" }),
      ).toBeVisible();
      await expect(
        page.getByLabel(
          role === "creator" ? "프로필 공개" : "브랜드 소개 공개",
          { exact: true },
        ),
      ).not.toBeChecked();
      const replay =
        role === "creator"
          ? await page.request.post(path, { data: sent[0] })
          : await page.request.patch(path, { data: sent[0] });
      expect(replay.status()).toBe(200);
      expect(
        sql(
          `select published from public.${role === "creator" ? "creators" : "brand_profiles"} where owner_id='${id}';`,
        ),
      ).toBe("f");
      const conflict = structuredClone(sent[0]);
      if (role === "creator")
        (conflict.profile as Record<string, unknown>).bio = "다른 요청";
      else
        (conflict.brand as Record<string, unknown>).introduction = "다른 요청";
      const wrong =
        role === "creator"
          ? await page.request.post(path, { data: conflict })
          : await page.request.patch(path, { data: conflict });
      expect(wrong.status()).toBe(422);
      await page
        .getByRole("button", { name: "내 확인 기록 보기", exact: true })
        .click();
      await expect(
        page.getByText(
          `${role === "creator" ? "크리에이터 프로필 공개" : "브랜드 소개 공개"} · 확인·동의`,
          { exact: false },
        ),
      ).toBeVisible();
      // A withdrawal acknowledgement can arrive after a newer scoped save.
      // Its old key must neither mutate the newer state nor show a false success.
      const choice = page.getByLabel(
        role === "creator" ? "프로필 공개" : "브랜드 소개 공개",
        { exact: true },
      );
      await choice.check();
      await page.getByRole("button", { name: button, exact: true }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "저장했습니다" }),
      ).toBeVisible();
      let globalDropped = false;
      await page.route("**/api/consent", async (route) => {
        if (route.request().method() === "POST" && !globalDropped) {
          globalDropped = true;
          const response = await route.fetch();
          expect(response.status()).toBe(200);
          await route.abort("connectionreset");
          return;
        }
        await route.continue();
      });
      await page
        .getByRole("button", { name: "선택적 프로필 공개 철회", exact: true })
        .click();
      await expect(
        page
          .locator(".panel")
          .filter({
            has: page.getByRole("heading", {
              name: "확인 기록과 공개 선택",
              exact: true,
            }),
          })
          .getByRole("alert"),
      ).toContainText("같은 요청으로 다시");
      await choice.check();
      await page.getByRole("button", { name: button, exact: true }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "저장했습니다" }),
      ).toBeVisible();
      await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === "/settings" &&
            r.request().resourceType() === "document" &&
            r.status() === 200,
        ),
        page.waitForEvent("load"),
        page
          .getByRole("button", { name: "선택적 프로필 공개 철회", exact: true })
          .click(),
      ]);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "나를 보여주는 방식.",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("다음 가능성을 불러오고 있습니다...", { exact: true }),
      ).not.toBeVisible();
      await expect(choice).toBeChecked();
      expect(
        sql(
          `select published from public.${role === "creator" ? "creators" : "brand_profiles"} where owner_id='${id}';`,
        ),
      ).toBe("t");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `output/playwright/publication-${role}-${info.project.name}.png`,
        fullPage: true,
      });
    } finally {
      sql(
        `delete from public.brand_contacts where owner_id='${id}';delete from public.brand_profiles where owner_id='${id}';delete from public.creators where owner_id='${id}';delete from adme_ops.rate_windows where subject='${id}';`,
      );
      expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
    }
  });

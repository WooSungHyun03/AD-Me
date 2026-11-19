import { z } from "zod";
import { apiRoute, fail, parseBody } from "@/lib/api";
import { requireProvisionedAdmin } from "@/lib/admin";

export const POST = apiRoute("admin.mfa.post", async (request) => {
  const c = await requireProvisionedAdmin();
  const input = await parseBody(
    request,
    z.discriminatedUnion("action", [
      z.object({ action: z.literal("enroll") }).strict(),
      z
        .object({
          action: z.literal("verify"),
          factorId: z.uuid(),
          code: z.string().regex(/^\d{6}$/),
        })
        .strict(),
    ]),
    "인증 정보를 확인해주세요.",
  );
  const { data: factors, error: listError } = await c.db.auth.mfa.listFactors();
  if (listError) fail("인증 수단을 불러오지 못했습니다.", 503);
  if (input.action === "enroll") {
    if (factors.totp.some((factor) => factor.status === "verified"))
      fail("등록된 인증 수단으로 OTP를 입력해주세요.", 409);
    // Reuse a pending enrollment instead of accumulating factors on retries.
    for (const factor of factors.all.filter(
      (f) => f.factor_type === "totp" && f.status === "unverified",
    )) {
      const { error } = await c.db.auth.mfa.unenroll({ factorId: factor.id });
      if (error) fail("미완료 인증 등록을 정리하지 못했습니다.", 503);
    }
    const { data, error } = await c.db.auth.mfa.enroll({
      factorType: "totp",
      issuer: "AD Me",
    });
    if (error) fail("OTP 등록을 시작하지 못했습니다.", 503);
    // Secret shown only to this authenticated account; never logged or placed in a URL.
    return Response.json(
      { factorId: data.id, secret: data.totp.secret },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
  if (
    !factors.all.some(
      (factor) => factor.id === input.factorId && factor.factor_type === "totp",
    )
  )
    fail("등록된 인증 수단을 확인해주세요.", 403);
  const { error } = await c.db.auth.mfa.challengeAndVerify({
    factorId: input.factorId,
    code: input.code,
  });
  if (error) {
    if (error.status === 429)
      fail("인증 요청이 많습니다. 잠시 후 다시 시도해주세요.", 429);
    fail("OTP를 확인하고 다시 입력해주세요.", 422);
  }
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { context } from "@/lib/api";
import { youtubeChannelId } from "@/lib/featured-youtube";

const contact = z
  .object({
    channelId: youtubeChannelId,
    email: z.union([z.email().max(254), z.literal("")]),
    phone: z.string().regex(/^(?:[+0-9(). -]{7,30})?$/),
    consent: z.boolean(),
  })
  .refine((data) => !data.consent || Boolean(data.email || data.phone));

export async function updateContact(
  _state: { message: string; ok: boolean },
  form: FormData,
) {
  const parsed = contact.safeParse({
    channelId: form.get("channelId"),
    email: String(form.get("email") ?? "").trim(),
    phone: String(form.get("phone") ?? "").trim(),
    consent: form.get("consent") === "on",
  });
  if (!parsed.success)
    return { ok: false, message: "업무 연락처와 공개 선택을 확인해 주세요." };
  const account = await context();
  if (!account || account.role !== "creator")
    return { ok: false, message: "크리에이터 계정으로 다시 로그인해 주세요." };
  const { channelId, email, phone, consent } = parsed.data;
  const { error } = await account.db.from("youtube_channel_contacts").upsert({
    owner_id: account.user.id,
    channel_id: channelId,
    business_email: email,
    business_phone: phone,
    consent,
  });
  if (error)
    return {
      ok: false,
      message: "연락처를 저장하지 못했습니다. 채널 인증 상태를 확인해 주세요.",
    };
  revalidatePath("/settings/youtube");
  revalidatePath("/creators/youtube/" + channelId);
  return {
    ok: true,
    message: consent
      ? "연락처 공개 설정을 저장했습니다."
      : "연락처를 비공개로 저장했습니다.",
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { youtubeChannelId } from "@/lib/featured-youtube";
import { currentUser, supabase } from "@/lib/supabase";

export async function saveChannel(id: string, saved: boolean): Promise<string> {
  if (!youtubeChannelId.safeParse(id).success)
    return "유효하지 않은 채널입니다.";
  const user = await currentUser();
  if (!user) return "로그인한 뒤 다시 시도해 주세요.";
  const table = (await supabase()).from("saved_youtube_channels");
  const { error } = saved
    ? await table.insert({ channel_id: id })
    : await table.delete().eq("owner_id", user.id).eq("channel_id", id);
  if (error && !(saved && error.code === "23505"))
    return "저장 상태를 변경하지 못했습니다.";
  revalidatePath("/creators/youtube/" + id);
  revalidatePath("/dashboard");
  return "";
}

import { type Creator } from "./catalog";
import { configured, supabase } from "./supabase";
export async function publicCreators(): Promise<Creator[]> {
  if (!configured()) return [];
  const db = await supabase();
  const { data, error } = await db
    .from("creators")
    .select("id,profile,published,owner_id")
    .eq("published", true)
    .eq("profile->>is_demo", "false");
  if (error) throw new Error("크리에이터 목록을 불러오지 못했습니다.");
  return (data ?? []).map((c) => ({
    ...c.profile,
    seed_id: c.id,
    published: c.published,
    owner_id: c.owner_id,
  }));
}

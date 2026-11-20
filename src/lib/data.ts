import "server-only";
import { creators } from "./catalog";
import { configured, supabase } from "./supabase";
import {
  projectPublicCreator,
  type PublicCatalogCreator,
} from "./creator-public-profile";
export async function publicCreators(): Promise<PublicCatalogCreator[]> {
  if (!configured())
    return creators
      .map((profile) =>
        projectPublicCreator({
          id: profile.seed_id,
          published: profile.published,
          profile,
        }),
      )
      .filter((c) => c !== null);
  const db = await supabase();
  const { data, error } = await db
    .from("creators")
    .select("id,profile,published")
    .eq("published", true)
    .eq("moderation_status", "allowed");
  if (error) throw new Error("크리에이터 목록을 불러오지 못했습니다.");
  return (data ?? []).map(projectPublicCreator).filter((c) => c !== null);
}

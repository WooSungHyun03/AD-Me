import "server-only";
import { creators } from "./catalog";
import { configured, supabase } from "./supabase";
import {
  projectPublicCreator,
  type PublicCatalogCreator,
  publicCatalogCreatorSchema,
} from "./creator-public-profile";
import { readPublicCreatorCatalog } from "./creator-catalog-read";
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
  return readPublicCreatorCatalog(db);
}
export async function publicCreator(
  reference: string,
): Promise<PublicCatalogCreator | null> {
  if (!configured())
    return (
      (await publicCreators()).find((c) => c.seed_id === reference) ?? null
    );
  const db = await supabase(),
    { data, error } = await db.rpc("creator_public_one", { p_ref: reference });
  if (error) throw Error("프로필을 불러오지 못했습니다.");
  if (data === null) return null;
  return publicCatalogCreatorSchema.parse(data);
}

import "server-only";
import { creators } from "./catalog";
import { configured, supabase } from "./supabase";
import {
  projectPublicCreator,
  type PublicCatalogCreator,
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

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  publicCatalogCreatorSchema,
  type PublicCatalogCreator,
} from "./creator-public-profile";

const windowSchema = z.strictObject({
  version: z.literal(1),
  items: z.array(publicCatalogCreatorSchema).max(200),
  nextCursor: z.string().min(1).max(100).nullable(),
});
export async function readPublicCreatorCatalog(
  db: Pick<SupabaseClient, "rpc">,
): Promise<PublicCatalogCreator[]> {
  let cursor = "";
  const rows: PublicCatalogCreator[] = [];
  const seen = new Set<string>();
  // Preserve the old 1000-row snapshot cap; don't silently claim a complete list.
  // D033 will replace this compatibility snapshot with server-side filtering.
  for (let page = 0; page < 10; page++) {
    const { data, error } = await db.rpc("creator_catalog_page", {
      p_after: cursor,
      p_limit: 100,
    });
    const parsed = windowSchema.safeParse(data);
    if (error || !parsed.success)
      throw new Error("크리에이터 목록을 불러오지 못했습니다.");
    for (const row of parsed.data.items) {
      if (seen.has(row.seed_id))
        throw new Error("크리에이터 목록의 순서가 올바르지 않습니다.");
      seen.add(row.seed_id);
      rows.push(row);
    }
    const next = parsed.data.nextCursor;
    if (next === null) return rows;
    if (
      next === cursor ||
      !parsed.data.items.length ||
      next !== parsed.data.items.at(-1)?.seed_id
    )
      throw new Error("크리에이터 목록의 순서가 올바르지 않습니다.");
    cursor = next;
  }
  throw new Error(
    "검색 가능한 목록 범위를 초과했습니다. 조건별 서버 검색 연결이 필요합니다.",
  );
}
const savedSchema = z.array(
  z.strictObject({
    creator_id: z.string().min(1).max(100),
    creator: publicCatalogCreatorSchema.nullable(),
  }),
);
export async function readMySavedCreatorCatalog(
  db: Pick<SupabaseClient, "rpc">,
) {
  const { data, error } = await db.rpc("my_saved_creator_catalog");
  const parsed = savedSchema.safeParse(data);
  if (error || !parsed.success)
    throw new Error("저장한 후보를 불러오지 못했습니다.");
  if (
    parsed.data.some(
      (row) => row.creator !== null && row.creator.seed_id !== row.creator_id,
    )
  )
    throw new Error("저장한 후보의 형식이 올바르지 않습니다.");
  return parsed.data;
}
const choiceSchema = z.array(
  z.strictObject({
    id: z.string().min(1).max(100),
    name: z.string().min(2).max(80),
  }),
);
export async function readCreatorProposalChoices(
  db: Pick<SupabaseClient, "rpc">,
  campaignId: string,
) {
  const { data, error } = await db.rpc("creator_proposal_choices", {
    p_campaign: campaignId,
  });
  const parsed = choiceSchema.safeParse(data);
  if (error || !parsed.success)
    throw new Error("제안할 크리에이터를 불러오지 못했습니다.");
  return parsed.data;
}

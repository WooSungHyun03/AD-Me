import { z } from "zod";
import type { supabase } from "@/lib/supabase";
// D036: owner-only list DTO from public.my_saved_lists(). Items carry the public creator reference
// and the catalog display name only while the creator stays catalog-visible.
const item = z.object({
  ref: z.string().min(1),
  name: z.string().nullable(),
  visible: z.boolean(),
});
const list = z.object({
  id: z.uuid(),
  name: z.string(),
  is_default: z.boolean(),
  campaign_id: z.uuid().nullable(),
  items: z.array(item),
});
export type SavedList = z.infer<typeof list>;
export const savedListsDto = z.array(list);
export async function readSavedLists(
  db: Awaited<ReturnType<typeof supabase>>,
): Promise<SavedList[] | null> {
  const { data, error } = await db.rpc("my_saved_lists");
  if (error) return null;
  const parsed = savedListsDto.safeParse(data);
  return parsed.success ? parsed.data : null;
}
export const itemLabel = (i: SavedList["items"][number]) =>
  i.visible && i.name ? i.name : "비공개 처리된 프로필";

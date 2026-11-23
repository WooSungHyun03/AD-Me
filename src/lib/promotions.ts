import { z } from "zod";
import { isDemoMode } from "@/lib/mode";
import { storageAdmin } from "@/lib/uploads";
// D070: HOT promotions come only from this slot source; search/matching never read entitlements.
// Disabled outside test_demo (no paid exposure in the real free service).
const slotSchema = z.object({
  slot: z.number().int().min(1).max(3),
  creator_id: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  starts_at: z.string(),
  expires_at: z.string(),
});
export type PromotionSlot = z.infer<typeof slotSchema>;
export async function promotionSlots(
  record: boolean,
): Promise<PromotionSlot[]> {
  if (!isDemoMode()) return [];
  const db = storageAdmin();
  if (!db) return [];
  const { data, error } = await db.rpc("serve_promotion_slots", {
    p_record: record,
  });
  if (error) return [];
  return z.array(slotSchema).parse(data ?? []);
}

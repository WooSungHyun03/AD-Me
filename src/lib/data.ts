import { connection } from "next/server";
import { creators, type Creator } from "./catalog";
import { isDemoMode } from "./mode";
import { configured, supabase } from "./supabase";
export async function publicCreators(): Promise<Creator[]> {
  const demo = isDemoMode();
  if (!configured()) {
    // free_beta must never present the 48 fictional fixtures as a working service.
    if (demo) return creators;
    await connection(); // report at request time instead of failing the build
    throw new Error("서비스 데이터베이스 연결이 준비되지 않았습니다.");
  }
  const db = await supabase();
  let q = db
    .from("creators")
    .select("id,profile,published,owner_id,claim_status")
    .eq("published", true);
  if (!demo) q = q.eq("profile->>is_demo", "false");
  const { data, error } = await q;
  if (error) throw new Error("크리에이터 목록을 불러오지 못했습니다.");
  return (data ?? []).map((c) => ({
    ...c.profile,
    seed_id: c.id,
    published: c.published,
    owner_id: c.owner_id,
    claim_status: c.claim_status,
  }));
}

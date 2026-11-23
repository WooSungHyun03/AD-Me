import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { searchCreators, searchSchema } from "@/lib/search";
export async function GET(req: Request) {
  const p = searchSchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!p.success) return fail("검색 조건을 확인해주세요.");
  try {
    return NextResponse.json(await searchCreators(p.data));
  } catch {
    return fail("크리에이터 목록을 불러오지 못했습니다.", 503);
  }
}

import { compatibleApiRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/mode";
import { promotionSlots } from "@/lib/promotions";
// D070: separate slot API (minimal DTO). Does not count impressions; page renders do.
 async function handleGET() {
  return NextResponse.json(
    {
      enabled: isDemoMode(),
      label: "TEST 광고",
      slots: await promotionSlots(false),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET=compatibleApiRoute("src/app/api/promotions/route.ts.GET",handleGET);

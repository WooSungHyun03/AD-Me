import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/admin";
import { compatibleApiRoute } from "@/lib/api";
import { details, probe } from "@/lib/health";
import { alert } from "@/lib/observability";

export const dynamic = "force-dynamic";

async function handleGET() {
  // The uptime contract is also used for sessions without current admin MFA.
  const admin = await requireAdminContext().catch(() => null);
  if (admin) return NextResponse.json(await details(admin.db));

  const status = await probe();
  if (!status.ok) {
    await alert(`health:${status.reason}`, `헬스체크 실패: ${status.reason}`);
  }
  return NextResponse.json(
    { status: status.ok ? "ok" : "down" },
    { status: status.ok ? 200 : 503 },
  );
}

export const GET = compatibleApiRoute("operations.health.get", handleGET);

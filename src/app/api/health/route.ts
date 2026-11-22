import { NextResponse } from "next/server";
import { context } from "@/lib/api";
import { details, probe } from "@/lib/health";
import { alert } from "@/lib/observability";
// Public: only {status} for uptime monitors. Admin session: connection details, usage vs free limits.
export const dynamic = "force-dynamic";
export async function GET() {
  const c = await context().catch(() => null);
  if (c?.role === "admin") return NextResponse.json(await details(c.db));
  const p = await probe();
  // An uptime monitor polling this URL turns an outage into one (deduplicated) alert.
  if (!p.ok) await alert(`health:${p.reason}`, `헬스체크 실패: ${p.reason}`);
  return NextResponse.json(
    { status: p.ok ? "ok" : "down" },
    { status: p.ok ? 200 : 503 },
  );
}

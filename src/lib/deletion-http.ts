import "server-only";
import { headers } from "next/headers";
import { serverAdmin } from "./server-admin";
import { requestBudgetSubjects } from "./request-budget-subjects";
import { fail, failDatabase } from "./api";
export async function deletionAdmin(id: string) {
  const admin = serverAdmin();
  if (!admin) fail("계정 삭제 요청 연결을 준비 중입니다.", 503);
  const subjects = requestBudgetSubjects(
    await headers(),
    process.env.VERCEL === "1",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "deletion:" + id,
  );
  const budget = await admin.rpc("deletion_edge_budget", {
    p_ip: subjects.ip,
    p_request: subjects.account,
  });
  if (budget.error)
    failDatabase(budget.error, "요청 한도를 확인하지 못했습니다.");
  if (typeof budget.data !== "number")
    fail("요청 한도를 확인하지 못했습니다.", 503);
  if (budget.data > 0)
    fail("요청이 많습니다. 잠시 후 다시 시도해주세요.", 429, budget.data);
  return admin;
}

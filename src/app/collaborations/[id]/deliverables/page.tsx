import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { context } from "@/lib/api";
import { deliveryPageSchema } from "@/lib/deliverables";
import { DeliveryWorkflow } from "@/components/delivery-workflow";
export const dynamic = "force-dynamic";
export default async function Deliverables({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ beforeVersion?: string }>;
}) {
  const c = await context();
  if (!c) redirect("/login");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const q = await searchParams;
  const before = z.coerce
    .number()
    .int()
    .min(1)
    .max(2147483647)
    .optional()
    .safeParse(q.beforeVersion);
  if (!before.success) notFound();
  const { data, error } = await c.db.rpc("delivery_page", {
    p_proposal: id,
    p_before: before.data ?? null,
    p_limit: 20,
  });
  if (error?.code === "42501") notFound();
  const result = deliveryPageSchema.safeParse(data);
  const status = {
    pending: "응답 대기",
    accepted: "협업 진행",
    rejected: "거절",
    submitted: "검토 대기",
    revision_requested: "수정 요청",
    completed: "완료",
  };
  return (
    <section className="wrap" style={{ maxWidth: 920 }}>
      <Link href="/dashboard">내 워크스페이스 ↗</Link>{" "}
      <Link href={`/collaborations/${id}/terms`}>협업 조건 ↗</Link>
      <h1 className="page-title">결과물 제출·검토.</h1>
      {error || !result.success || result.data.proposalId !== id ? (
        <p className="notice">
          결과물을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.
        </p>
      ) : (
        <>
          <p className="badge lime">{status[result.data.status]}</p>
          <DeliveryWorkflow
            key={`${id}-${result.data.roomRevision}-${before.data ?? 0}`}
            data={result.data}
          />
          <div className="inline">
            {result.data.nextVersion && (
              <Link
                className="button outline"
                href={`?beforeVersion=${result.data.nextVersion}`}
              >
                이전 제출본 더 보기
              </Link>
            )}
            {before.data && (
              <Link
                className="button ghost"
                href={`/collaborations/${id}/deliverables`}
              >
                최신 제출본부터 보기
              </Link>
            )}
          </div>
        </>
      )}
    </section>
  );
}

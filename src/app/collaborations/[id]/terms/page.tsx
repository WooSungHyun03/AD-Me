import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { context } from "@/lib/api";
import { agreementStateSchema } from "@/lib/agreements";
import { AgreementPanel } from "@/components/agreement-panel";
export const dynamic = "force-dynamic";
export default async function Terms({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const c = await context();
  if (!c) redirect("/login");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  // RPC repeats the party check; outsiders get 404 rather than a hint that the collaboration exists.
  const { data, error } = await c.db.rpc("agreement_state", {
    p_proposal: id,
  });
  if (error?.code === "42501") notFound();
  const state = agreementStateSchema.safeParse(data);
  return (
    <section className="wrap" style={{ maxWidth: 920 }}>
      <Link href="/dashboard">내 워크스페이스 ↗</Link>{" "}
      <Link href={`/collaborations/${id}/deliverables`}>결과물 ↗</Link>
      <h1 className="page-title">협업 조건과 합의 이력.</h1>
      {error || !state.success || state.data.proposalId !== id ? (
        <p className="notice">
          협업 조건을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.
        </p>
      ) : (
        <AgreementPanel initial={state.data} />
      )}
    </section>
  );
}

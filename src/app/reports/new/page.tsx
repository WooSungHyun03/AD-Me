import { redirect } from "next/navigation";
import { ReportForm } from "@/components/report-form";
import { currentUser } from "@/lib/supabase";
export default async function Report({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string; appeal?: string; kind?: string }>;
}) {
  const p = await searchParams;
  if (!(await currentUser())) {
    // Keep the profile (and request type) across sign-in; safeNext re-validates the shape.
    const back = p.creator
      ? `/reports/new?creator=${encodeURIComponent(p.creator)}${p.kind ? `&kind=${encodeURIComponent(p.kind)}` : ""}`
      : "/reports";
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }
  return (
    <section className="wrap">
      <span className="eyebrow">Requests</span>
      <h1 className="page-title">더 정확한 정보를 위해.</h1>
      <p>
        정정·신고·삭제 요청은 비공개로 접수되며 요청한 본인만 처리 상태를 볼 수
        있습니다. 다른 사람의 개인정보나 확인되지 않은 주장은 적지 말아주세요.
      </p>
      <ReportForm
        creatorId={p.creator ?? ""}
        parentId={p.appeal}
        initialKind={p.kind}
      />
    </section>
  );
}

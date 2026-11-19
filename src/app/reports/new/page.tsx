import { ReportForm } from "@/components/report-form";
export default async function Report({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string }>;
}) {
  const p = await searchParams;
  return (
    <section className="wrap">
      <h1 className="page-title">더 정확한 정보를 위해.</h1>
      <p>
        확인 가능한 출처와 함께 알려주세요. 신고는 비공개로 접수되며 관리자
        검토를 거칩니다.
      </p>
      <ReportForm creatorId={p.creator ?? ""} />
    </section>
  );
}

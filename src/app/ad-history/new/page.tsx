import Link from "next/link";
import { redirect } from "next/navigation";
import { context } from "@/lib/api";
import { AdHistoryForm } from "@/components/ad-history-form";
export default async function NewAdHistory() {
  const c = await context();
  if (!c) redirect("/login");
  if (c.role !== "creator")
    return (
      <section className="wrap">
        <h1>크리에이터 계정이 필요합니다.</h1>
      </section>
    );
  const { data: creator, error } = await c.db
    .from("creators")
    .select("id")
    .eq("owner_id", c.user.id)
    .maybeSingle();
  return (
    <section className="wrap">
      <h1 className="page-title">내 광고 이력 제출.</h1>
      <p>
        본인 제출 자료는 비공개로 접수되며, 출처 검토와 공개 정책 승인 후
        표시됩니다.
      </p>
      {error ? (
        <p className="notice">프로필을 불러오지 못했습니다.</p>
      ) : creator ? (
        <AdHistoryForm creatorId={creator.id} />
      ) : (
        <p>
          먼저{" "}
          <Link href="/settings">본인 크리에이터 프로필을 등록해주세요.</Link>
        </p>
      )}
    </section>
  );
}

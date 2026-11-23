import Link from "next/link";
import { redirect } from "next/navigation";
import { context } from "@/lib/api";
import { ReviewInbox } from "@/components/review-inbox";
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const c = await context();
  if (!c) redirect("/login");
  const { cursor } = await searchParams;
  return (
    <section className="wrap">
      <h1 className="page-title">자료 검토와 당사자 입장.</h1>
      <p>내가 제출했거나 내 프로필에 관한 비공개 자료를 확인합니다.</p>
      <Link href="/dashboard">내 워크스페이스 ↗</Link>
      <ReviewInbox db={c.db} cursor={cursor} path="/reports" />
    </section>
  );
}

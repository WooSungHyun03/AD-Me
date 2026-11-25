import Link from "next/link";
import { redirect } from "next/navigation";
import { context } from "@/lib/api";
import { ReviewInbox } from "@/components/review-inbox";
import { MyRequests } from "@/components/my-requests";
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const c = await context();
  if (!c) redirect("/login?next=/reports");
  const { cursor } = await searchParams;
  return (
    <section className="wrap">
      <h1 className="page-title">자료 검토와 당사자 입장.</h1>
      <p>내가 제출했거나 내 프로필에 관한 비공개 자료를 확인합니다.</p>
      <Link href="/dashboard">내 워크스페이스 ↗</Link>
      <MyRequests db={c.db} userId={c.user.id} />
      <ReviewInbox db={c.db} cursor={cursor} path="/reports" />
    </section>
  );
}

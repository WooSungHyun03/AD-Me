import Link from "next/link";
import { redirect } from "next/navigation";
import { context } from "@/lib/api";
import { ReviewInbox } from "@/components/review-inbox";
export default async function Reviews({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const c = await context();
  if (!c) redirect("/login");
  if (c.role !== "admin")
    return (
      <section className="wrap">
        <h1>관리자 권한이 필요합니다.</h1>
      </section>
    );
  const { data: allowed, error } = await c.db.rpc("is_admin");
  if (error || allowed !== true) redirect("/admin/security");
  const { cursor } = await searchParams;
  return (
    <section className="wrap">
      <h1 className="page-title">근거 검토함.</h1>
      <p>
        원본 주장·당사자 입장·확인된 사실을 구분하고 현재 버전을 검토합니다.
      </p>
      <Link href="/admin">운영 관리 ↗</Link>
      <ReviewInbox db={c.db} cursor={cursor} path="/admin/reviews" />
    </section>
  );
}

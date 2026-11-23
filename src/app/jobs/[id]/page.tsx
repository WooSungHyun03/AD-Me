import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { context } from "@/lib/api";
import { TestCheckout as Checkout } from "@/components/test-checkout";
import { JobForm } from "../forms";
import { jobExpiry, jobsSchema } from "../model";

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [c, db] = await Promise.all([context(), supabase()]);
  const { data, error } = await db.rpc("marketplace_board", { p_id: id.data });
  const result = jobsSchema.safeParse(data);
  if (error || !result.success)
    return (
      <section className="wrap">
        <p role="alert">공고를 불러오지 못했습니다.</p>
      </section>
    );
  const row = result.data[0];
  if (!row) notFound();
  const b = row.brief;
  const open = row.status === "published";
  return (
    <section className="wrap">
      <Link href="/jobs">공고 목록</Link>
      <h1 className="page-title">{b.title}</h1>
      <p>
        YouTube · {b.category} · {b.format}
      </p>
      <p>
        광고 상품 {b.product} · 총 예산 {b.budget_krw.toLocaleString("ko-KR")}원
      </p>
      <p>대상 {b.target_audience}</p>
      <h2>광고 목표와 결과물</h2>
      <p className="whitespace-pre-wrap">{b.goal}</p>
      {row.expires_at && <p>마감일 {jobExpiry(row.expires_at)} (한국 시간)</p>}
      {row.owned && row.status === "draft" && (
        <section className="ops-section">
          <h2>공고 게시</h2>
          <p>공개 모집 기간은 30일입니다. TEST 게시권 1장을 사용합니다.</p>
          <Checkout sku="job_post" />
          <JobForm kind="publish" id={row.id} />
        </section>
      )}
      {row.owned && open && (
        <section className="ops-section">
          <h2>지원자 검토</h2>
          <p>
            <Link href="/dashboard">워크스페이스에서 지원자 확인</Link>
          </p>
          <JobForm kind="close" id={row.id} />
        </section>
      )}
      {row.applied ? (
        <p>
          <Link href="/dashboard">제출한 지원서 상태 보기</Link>
        </p>
      ) : open && c?.role === "creator" ? (
        <section className="ops-section">
          <h2>공고 지원</h2>
          <p>
            소유권이 인증된 YouTube 채널과 공개 협업 프로필이 필요합니다. 제출에
            TEST 지원권 1장을 사용합니다.
          </p>
          <Link href="/settings/youtube">채널 인증 상태 확인</Link>
          <JobForm kind="apply" id={row.id} />
          <Checkout sku="job_application" />
        </section>
      ) : open && !c ? (
        <Link href="/login">로그인하고 지원하기</Link>
      ) : null}
    </section>
  );
}

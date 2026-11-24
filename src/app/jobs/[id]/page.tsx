import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { context } from "@/lib/api";
import { isDemoMode } from "@/lib/mode";
import { TestCheckout as Checkout } from "@/components/test-checkout";
import { JobForm } from "../forms";
import { jobExpiry, jobsSchema } from "../model";

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ completed?: string }>;
}) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [c, db] = await Promise.all([context(), supabase()]);
  const { data, error } = await db.rpc("marketplace_board", { p_id: id.data });
  const result = jobsSchema.safeParse(data);
  if (error || !result.success)
    return (
      <section className="wrap">
        <p role="alert">캠페인을 불러오지 못했습니다.</p>
      </section>
    );
  const row = result.data[0];
  if (!row) notFound();
  const b = row.brief;
  const open = row.status === "published";
  const requiresCredit = isDemoMode();
  const { completed } = await searchParams;
  const publishedNow = completed === "publish" && row.owned && open;
  const appliedNow = completed === "apply" && row.applied;
  return (
    <section className="figma-width figma-campaign-detail">
      <Link href="/jobs">캠페인 목록</Link>
      {(publishedNow || appliedNow) && (
        <aside className="figma-campaign-summary figma-campaign-completion" role="status">
          <h2>{publishedNow ? "캠페인을 공개했습니다" : "지원서를 제출했습니다"}</h2>
          <p>{publishedNow ? "지원자는 워크스페이스에서 검토할 수 있어요." : "브랜드가 지원서를 검토하면 워크스페이스에 상태가 표시됩니다."}</p>
          <Link className="button outline" href="/dashboard#workspace-collaboration">워크스페이스로 이동</Link>
        </aside>
      )}
      <div className="figma-campaign-layout">
        <div>
          <p className="figma-eyebrow">
            {b.product} · {b.category}
          </p>
          <h1 className="page-title">{b.title}</h1>
          <p>YouTube · {b.format}</p>
          <p>대상 {b.target_audience}</p>
          <h2>광고 목표와 결과물</h2>
          <p className="whitespace-pre-wrap">{b.goal}</p>
        </div>
        <aside className="figma-campaign-summary" aria-label="캠페인 조건">
          <p className="figma-eyebrow">
            {open ? "모집 중" : row.status === "draft" ? "작성 중" : "마감"}
          </p>
          <strong>{b.budget_krw.toLocaleString("ko-KR")}원</strong>
          <p>총 예산 · {b.format}</p>
          {row.expires_at && (
            <p>마감일 {jobExpiry(row.expires_at)} (한국 시간)</p>
          )}
          {row.owned && row.status === "draft" && (
            <section className="ops-section">
              <h2>캠페인 게시</h2>
              <p>
                공개 모집 기간은 30일입니다.
                {requiresCredit && " 게시권 1장을 사용합니다."}
              </p>
              {requiresCredit && <Checkout sku="job_post" />}
              <JobForm kind="publish" id={row.id} requiresCredit={requiresCredit} />
            </section>
          )}
          {row.owned && open && (
            <section className="ops-section">
              <h2>지원자 검토</h2>
              <p>
                <Link href="/dashboard#workspace-collaboration">워크스페이스에서 지원자 확인</Link>
              </p>
              <JobForm kind="close" id={row.id} />
            </section>
          )}
          {row.applied ? (
            <p>
              <Link href="/dashboard#workspace-collaboration">제출한 지원서 상태 보기</Link>
            </p>
          ) : open && c?.role === "creator" ? (
            <section className="ops-section">
              <h2>캠페인 지원</h2>
              <p>
                소유권이 인증된 YouTube 채널과 공개 협업 프로필이 필요합니다.
                {requiresCredit && " 제출에 지원권 1장을 사용합니다."}
              </p>
              <Link href="/settings/youtube">채널 인증 상태 확인</Link>
              <JobForm kind="apply" id={row.id} requiresCredit={requiresCredit} />
              {requiresCredit && <Checkout sku="job_application" />}
            </section>
          ) : open && !c ? (
            <Link href="/login">로그인하고 지원하기</Link>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

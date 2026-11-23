import Link from "next/link";
import { context } from "@/lib/api";
import { InquiryForm } from "@/components/inquiry-form";
import { inquiryCategories } from "@/lib/schemas";
export const metadata = {
  title: "도움말·문의",
  alternates: { canonical: "/help" },
};
const STATUS: Record<string, string> = {
  open: "접수됨",
  answered: "답변 완료",
  closed: "종료",
};
export default async function Help() {
  const c = await context();
  const { data: mine } = c
    ? await c.db
        .from("inquiries")
        .select("id,category,message,status,answer,answered_at,created_at")
        .eq("user_id", c.user.id)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: null };
  return (
    <section className="wrap prose">
      <h1 className="page-title">도움말·문의</h1>
      <h2>이용 방법</h2>
      <p>
        <strong>브랜드</strong>: 캠페인을 만들고 추천 크리에이터를 확인한 뒤
        저장·비교하고 제안을 보냅니다. 지원자 선정 전 비공개 검토 체크리스트를
        쓸 수 있습니다. 진행 상황은 대시보드의 단계별 목록과 CSV로 확인합니다.
      </p>
      <p>
        <strong>크리에이터</strong>: 프로필을 등록·공개하고 공개 모집 캠페인에
        지원하거나 받은 제안을 수락합니다. 결과물을 제출하면 브랜드가 검토 승인
        또는 수정 요청을 합니다.
      </p>
      <h2>데이터의 한계</h2>
      <ul>
        <li>DEMO 표식 크리에이터·캠페인은 가상 시연 자료입니다.</li>
        <li>본인 등록 정보는 자기 보고이며 외부 검증된 수치가 아닙니다.</li>
        <li>추천 점수는 입력된 조건의 일치도이며 광고 성과 예측이 아닙니다.</li>
        <li>
          노출·전환·매출은 추정하지 않으며, 앱에 기록된 상태와 결과물만
          집계합니다.
        </li>
        <li>
          추천 결과는 등록 정보와 공개 YouTube 자료를 바탕으로 제공합니다. 협업
          전에 채널과 조건을 직접 확인해 주세요.
        </li>
        <li>결제는 Toss TEST 모드이며 실제 과금되지 않습니다.</li>
      </ul>
      <p>
        자세한 기준은 <Link href="/about">서비스·데이터 안내</Link>와{" "}
        <Link href="/privacy">개인정보 처리방침</Link>을 참고하세요. 프로필
        정정·삭제·신고는 각 프로필의 신고 메뉴(접수번호 발급)를 이용하세요.
      </p>
      <h2>문의하기</h2>
      <InquiryForm signedIn={!!c} />
      {c && (
        <>
          <h2>내 문의</h2>
          {!mine?.length && <p>접수한 문의가 없습니다.</p>}
          {mine?.map((q) => (
            <article
              key={q.id}
              className="panel"
              style={{ marginBottom: 12 }}
              data-testid="my-inquiry"
            >
              <span className="badge">{STATUS[q.status]}</span>{" "}
              <span style={{ fontSize: 13 }}>
                {
                  inquiryCategories[
                    q.category as keyof typeof inquiryCategories
                  ]
                }{" "}
                ·{" "}
                {new Date(q.created_at).toLocaleDateString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}
              </span>
              <p style={{ whiteSpace: "pre-wrap" }}>{q.message}</p>
              {q.answer && (
                <p style={{ whiteSpace: "pre-wrap" }}>
                  <strong>답변</strong> {q.answer}
                </p>
              )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}

import { campaignBriefTermsStorageSchema } from "@/lib/campaign-brief";
const date = (utc: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(utc));
export function CampaignTermsSummary({ terms }: { terms: unknown }) {
  if (terms === undefined)
    return (
      <p className="notice">
        이전 버전 캠페인 · 기간·제공 조건·산출물이 구조화되어 있지 않습니다.
      </p>
    );
  const parsed = campaignBriefTermsStorageSchema.safeParse(terms);
  if (!parsed.success)
    return <p role="alert">상세 협업 조건을 불러오지 못했습니다.</p>;
  const value = parsed.data,
    c = value.compensation;
  return (
    <section aria-label="기록된 협업 조건" style={{ overflowWrap: "anywhere" }}>
      <h2>협업 조건</h2>
      <p>대한민국 표준시(KST) · 모집 상태는 별도로 관리됩니다.</p>
      <dl>
        {(
          [
            ["recruitment", "모집 기간"],
            ["production", "제작 기간"],
            ["posting", "게시 기간"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="terms-summary-row">
            <dt>{label}</dt>
            <dd>
              {date(value[key].start)} ~ {date(value[key].end)}
            </dd>
          </div>
        ))}
      </dl>
      <h3>제공 조건</h3>
      {c.mode === "unknown" ? (
        <p>보상 조건 미정</p>
      ) : (
        <>
          {c.cash && (
            <p>
              현금 단가 {c.cash.minimumKrw.toLocaleString("ko-KR")}원 ~{" "}
              {c.cash.maximumKrw.toLocaleString("ko-KR")}원
            </p>
          )}
          {c.product && (
            <p>
              제품 제공: {c.product.description} · {c.product.quantity}개
            </p>
          )}
        </>
      )}
      <h3>산출물</h3>
      <ol>
        {value.deliverables.map((item, index) => (
          <li key={index} className="terms-summary-row">
            <strong>
              {item.format} · {item.quantity}개
            </strong>
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              사용권: {item.usageRights}
            </p>
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              독점 조건: {item.exclusivity ?? "기재 없음"}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

import { configured, supabase } from "@/lib/supabase";
import { metricHistorySchema, metricSeries, metricLabels } from "@/lib/metrics";
const time = (v: string) =>
  new Date(v).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
export async function MetricHistory({ reference }: { reference: string }) {
  if (!configured()) return null;
  const db = await supabase(),
    { data, error } = await db.rpc("creator_metric_history", {
      p_ref: reference,
      p_days: 30,
    }),
    parsed = metricHistorySchema.safeParse(data);
  if (error || !parsed.success)
    return (
      <p className="notice">
        지표 시계열을 불러오지 못했습니다. 새로고침해 다시 확인해주세요.
      </p>
    );
  const history = parsed.data;
  return (
    <section
      className="panel"
      data-testid="metric-history"
      style={{ marginTop: 24 }}
    >
      <h3>출처가 기록된 지표 변화</h3>
      <p>
        최근 30일 관측 자료 · 기준 {time(history.asOf)} (KST). 관측 사이의
        미수집·미확인 구간은 0으로 채우지 않습니다. 과거 값은 당시 관측이며 현재
        값이나 광고 성과를 보장하지 않습니다.
      </p>
      <p>
        연령·성별·타깃 인구통계는 제공하지 않습니다. YouTube 파생 지표는 비활성
        상태입니다.
      </p>
      {!history.identities.some((i) => i.points.length) && (
        <p>
          시계열 공개가 승인된 관측 자료가 없습니다. 자료 미확보는 실적 0을 뜻하지
          않습니다.
        </p>
      )}
      {history.identities.map((i) => (
        <div key={i.id}>
          <h4>
            {i.displayName} · {i.provider}{" "}
            {i.isDemo ? "· 가상 검증 자료 DEMO" : ""}
          </h4>
          <p>
            출처 유형 {i.sourceType} · 정책 {i.policyVersion} · 갱신 기한{" "}
            {i.ttlSeconds / 3600}시간 · 시계열 공개 허용 범위 {i.historyWindowSeconds / 3600}시간
          </p>
          {metricSeries(i.points, i.ttlSeconds, history.asOf).map((s) => {
            const values = s.points.filter((p) => p.value !== null),
              timestamps = s.points.map((p) => Date.parse(p.observedAt)),
              minTime = Math.min(...timestamps),
              maxTime = Math.max(...timestamps),
              max = Math.max(1, ...values.map((p) => p.value!));
            const xy = (p: typeof s.latest) =>
              `${20 + ((Date.parse(p.observedAt) - minTime) / Math.max(1, maxTime - minTime)) * 560},${155 - (p.value! / max) * 130}`;
            return (
              <article key={s.key} data-testid="metric-series">
                <h5>
                  {metricLabels[s.name] ?? s.name} ·{" "}
                  {s.kind === "original"
                    ? "원본 관측 지표"
                    : "승인된 파생 지표"}
                </h5>
                <p>
                  최근 관측값{" "}
                  {s.latest.value === null
                    ? "미확인"
                    : s.latest.value.toLocaleString("ko-KR")}
                  {s.unit === "percent" ? "%" : ""} · 값이 있는 관측{" "}
                  {s.availableCount}개 / 전체 {s.points.length}개
                  {s.stale ? " · 갱신 기한 경과" : ""}
                  {s.availableCount < 2 ? " · 변화 판단 표본 부족" : ""}
                </p>
                {s.availableCount >= 2 && (
                  <svg
                    viewBox="0 0 600 180"
                    aria-hidden="true"
                    style={{
                      width: "100%",
                      maxWidth: 600,
                      background: "var(--paper, #F5F5F0)",
                    }}
                  >
                    {s.segments.map((segment, n) => (
                      <g key={n}>
                        <polyline
                          points={segment.map(xy).join(" ")}
                          fill="none"
                          stroke="#111312"
                          strokeWidth="2"
                        />
                        {segment.map((p) => {
                          const [cx, cy] = xy(p).split(",");
                          return (
                            <circle
                              key={p.observedAt}
                              cx={cx}
                              cy={cy}
                              r="3"
                              fill="#111312"
                            />
                          );
                        })}
                      </g>
                    ))}
                  </svg>
                )}
                <p className="muted">
                  관측 시각에 따른 선형 눈금 · 단위 {s.unit} · 관측 공백은
                  선으로 연결하지 않습니다. 값과 출처는 아래 표에서 확인할 수
                  있습니다.
                </p>
                <div className="table-scroll">
                  <table className="data-table">
                    <caption>
                      {metricLabels[s.name] ?? s.name} 관측 기록 (KST)
                    </caption>
                    <thead>
                      <tr>
                        <th>관측 / 수집</th>
                        <th>값</th>
                        <th>산식·표본·기간 / 출처</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.points.map((p) => (
                        <tr key={p.observedAt}>
                          <td>
                            {time(p.observedAt)}
                            <br />
                            {time(p.collectedAt)}
                          </td>
                          <td>
                            {p.value === null
                              ? "미확인"
                              : p.value.toLocaleString("ko-KR")}
                            {p.unit === "percent" ? "%" : ""}
                          </td>
                          <td>
                            {p.kind === "original"
                              ? "공급원 원본 관측 · 합산/평균 계산 없음"
                              : `${p.formula} · 표본 ${p.sampleSize} · ${time(p.periodStart!)} ~ ${time(p.periodEnd!)}`}
                            <br />
                            <a
                              href={p.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              지표 출처 ↗
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
          {i.pointsTruncated && (
            <p>최신 200개 관측만 표시합니다. 전체 이력이 아닙니다.</p>
          )}
        </div>
      ))}
      {history.truncated && <p>최대 10개 연결 자료를 표시합니다.</p>}
    </section>
  );
}

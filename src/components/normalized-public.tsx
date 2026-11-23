import { supabase, configured } from "@/lib/supabase";
import { normalizedPublicSchema } from "@/lib/ingestion/normalized-public";
const at = (v: string) =>
  new Date(v).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
export async function NormalizedPublic({ reference }: { reference: string }) {
  if (!configured()) return null;
  const db = await supabase(),
    { data, error } = await db.rpc("creator_normalized_public", {
      p_ref: reference,
    });
  const parsed = normalizedPublicSchema.safeParse(data);
  if (error || !parsed.success)
    return (
      <p className="muted">연결 자료의 공개 상태를 확인하지 못했습니다.</p>
    );
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <h3>SNS 출처와 관측 지표</h3>
      {!parsed.data.identities.length && (
        <p>
          현재 공개 승인된 SNS 지표가 없습니다. 본인 등록 견적·태그와 플랫폼
          관측 지표는 별도입니다.
        </p>
      )}
      {parsed.data.identities.map((i) => (
        <article key={i.id}>
          <h4>
            {i.displayName} · {i.provider}
          </h4>
          <p>
            {i.isDemo
              ? "가상 검증 자료 · DEMO"
              : i.sourceType === "owner_submission"
                ? "본인 제출 자료"
                : "수집 출처가 기록된 자료"}{" "}
            · 정책 버전 {i.policyVersion}
          </p>
          <a href={i.canonicalUrl} target="_blank" rel="noopener noreferrer">
            출처에서 확인 ↗
          </a>
          <p>관측 시각 {at(i.observedAt)} (KST)</p>
          <ul>
            {i.metrics.map((m) => (
              <li key={m.name + m.kind}>
                {m.name}:{" "}
                {m.value === null ? "미확인" : m.value.toLocaleString("ko-KR")}
                {m.unit === "percent" ? "%" : ""} ·{" "}
                {m.kind === "derived" ? "파생 지표" : "원본 지표"}
                {m.stale ? " · 갱신 기한 경과" : ""}
                <br />
                관측 {at(m.observedAt)} / 수집 {at(m.collectedAt)} (KST) ·{" "}
                <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer">
                  지표 출처 ↗
                </a>
              </li>
            ))}
          </ul>
        </article>
      ))}
      {parsed.data.truncated && <p>공개 연결 자료가 많아 일부만 표시합니다.</p>}
    </section>
  );
}

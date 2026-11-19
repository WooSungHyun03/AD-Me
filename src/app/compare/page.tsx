import Link from "next/link";
import { publicCreators } from "@/lib/data";
export default async function Compare({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const p = await searchParams;
  const creators = await publicCreators();
  const list = creators.filter((c) =>
    p.ids?.split(",").slice(0, 3).includes(c.seed_id),
  );
  return (
    <section className="wrap">
      <span className="eyebrow">Side by side</span>
      <h1 className="page-title">감각은 나란히, 결정은 명확히.</h1>
      <p>
        최대 3명의 프로필을 비교합니다. 추천 순위는 캠페인별 적합도로
        계산됩니다.
      </p>
      {list.length ? (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>비교 항목</th>
                {list.map((c) => (
                  <th key={c.seed_id}>
                    <Link href={`/creators/${c.seed_id}`}>{c.name} ↗</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "콘텐츠 분야",
                  (c: (typeof list)[number]) => c.categories.join(", "),
                ],
                ["분위기", (c: (typeof list)[number]) => c.vibes.join(", ")],
                [
                  "플랫폼",
                  (c: (typeof list)[number]) => c.platforms.join(", "),
                ],
                [
                  "가상 팔로워",
                  (c: (typeof list)[number]) =>
                    c.is_demo ? c.followers.toLocaleString() : "미확보",
                ],
                [
                  "가상 최소 견적",
                  (c: (typeof list)[number]) =>
                    c.price_min_krw.toLocaleString() + "원",
                ],
                [
                  "광고 형식",
                  (c: (typeof list)[number]) => c.formats.join(", "),
                ],
                [
                  "협업 가능",
                  (c: (typeof list)[number]) =>
                    c.is_available ? "가능" : "일정 확인 필요",
                ],
                ["오디언스", () => "데이터 미확보"],
                [
                  "검증 상태",
                  (c: (typeof list)[number]) =>
                    c.is_demo
                      ? "가상 데이터 / 실측 미검증"
                      : "본인 등록 / 외부 미검증",
                ],
              ].map(([label, fn]) => (
                <tr key={String(label)}>
                  <th>{String(label)}</th>
                  {list.map((c) => (
                    <td key={c.seed_id}>
                      {typeof fn === "function" ? fn(c) : fn}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">탐색 화면에서 비교할 후보를 선택해주세요.</div>
      )}
      <Link
        className="button outline"
        style={{ marginTop: 24 }}
        href="/creators"
      >
        탐색으로 돌아가기
      </Link>
    </section>
  );
}

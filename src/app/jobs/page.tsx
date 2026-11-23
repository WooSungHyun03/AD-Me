import Link from "next/link";
import { configured, supabase } from "@/lib/supabase";
import { jobExpiry, jobsSchema } from "./model";

export default async function Jobs() {
  const response = configured()
    ? await (await supabase()).rpc("marketplace_board")
    : null;
  const rows = jobsSchema.safeParse(response?.data);
  return (
    <section className="wrap marketplace-board">
      <div className="section-heading marketplace-board-heading">
        <div>
          <h1 className="page-title">YouTube 광고 공고</h1>
          <p>브랜드가 모집 중인 YouTube 협업을 살펴보세요.</p>
        </div>
        <Link className="button primary" href="/jobs/new">
          광고 공고 작성
        </Link>
      </div>
      {response?.error || !rows.success ? (
        <p role="alert">공고를 불러오지 못했습니다.</p>
      ) : !rows.data.length ? (
        <p className="empty">표시할 광고 공고가 없습니다.</p>
      ) : (
        rows.data.map((row) => (
          <Link
            className="result marketplace-board-row"
            key={row.id}
            href={"/jobs/" + row.id}
          >
            <span>↗</span>
            <div>
              <h3>{row.brief.title}</h3>
              <p>
                {row.brief.category} · {row.brief.format} ·{" "}
                {row.owned && row.status !== "published"
                  ? row.status === "draft"
                    ? "내 초안"
                    : "마감"
                  : row.expires_at
                    ? jobExpiry(row.expires_at) + " 마감"
                    : ""}
              </p>
            </div>
            <strong>{row.brief.budget_krw.toLocaleString("ko-KR")}원</strong>
          </Link>
        ))
      )}
    </section>
  );
}

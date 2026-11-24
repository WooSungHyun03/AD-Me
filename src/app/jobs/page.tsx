import Link from "next/link";
import { ArrowUpRight, ClipboardList } from "lucide-react";
import { configured, supabase } from "@/lib/supabase";
import { jobAccepting, jobDeadline, jobExpiry, jobsSchema } from "./model";

export const metadata = { title: "캠페인", alternates: { canonical: "/jobs" } };

const pageSize = 6;
const currency = new Intl.NumberFormat("ko-KR");

function campaignURL(filters: Record<string, string>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value) query.set(key, value);
  const suffix = query.toString();
  return suffix ? "/jobs?" + suffix : "/jobs";
}

export default async function CampaignBoard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = await searchParams;
  const response = configured()
    ? await (await supabase()).rpc("marketplace_board")
    : null;
  const parsed = jobsSchema.safeParse(response?.data ?? []);
  const rows = parsed.success ? parsed.data : [];
  const categories = [...new Set(rows.map(({ brief }) => brief.category))].sort(
    (a, b) => a.localeCompare(b, "ko"),
  );
  const category =
    typeof input.category === "string" && categories.includes(input.category)
      ? input.category
      : "";
  const open = input.open === "1" ? "1" : "";
  const sort = input.sort === "deadline" ? "deadline" : "";
  const filters = { category, open, sort };
  const active = rows.filter(
    (row) =>
      (!category || row.brief.category === category) &&
      (!open || jobAccepting(row)),
  );
  if (sort)
    active.sort((a, b) =>
      (jobDeadline(a) ?? "9999").localeCompare(jobDeadline(b) ?? "9999"),
    );

  const totalPages = Math.max(1, Math.ceil(active.length / pageSize));
  const requestedPage =
    typeof input.page === "string" && /^\d{1,6}$/.test(input.page)
      ? Number(input.page)
      : 1;
  const page = Math.min(totalPages, Math.max(1, requestedPage));
  const featured =
    page === 1 ? active.find((row) => jobAccepting(row)) : undefined;

  return (
    <section className="figma-width figma-campaign-board">
      <div className="figma-section-head">
        <div>
          <p className="figma-eyebrow">OPEN FOR COLLABORATION</p>
          <h1>나다운 콘텐츠가 빛날 기회.</h1>
          <p>당신의 채널과 잘 맞는 브랜드의 제안을 만나보세요.</p>
        </div>
        <Link className="button primary" href="/jobs/new">
          캠페인 작성 <span aria-hidden="true">+</span>
        </Link>
      </div>
      {response?.error || !parsed.success ? (
        <p role="alert">
          캠페인을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
      ) : (
        <>
          {featured && (
            <div className="figma-featured-campaign">
              <p className="figma-eyebrow">공개 캠페인</p>
              <h2>{featured.brief.title}</h2>
              <p>
                {featured.brief.product} · {featured.brief.category}
              </p>
              <Link className="button primary" href={"/jobs/" + featured.id}>
                캠페인 자세히 보기 <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          )}
          <nav className="figma-campaign-filters" aria-label="캠페인 필터">
            <Link
              className="button outline"
              aria-current={!category ? "true" : undefined}
              href={campaignURL({ ...filters, category: "" })}
            >
              전체
            </Link>
            {categories.map((value) => (
              <Link
                key={value}
                className="button outline"
                aria-current={category === value ? "true" : undefined}
                href={campaignURL({ ...filters, category: value })}
              >
                {value}
              </Link>
            ))}
            <Link
              className="button ghost"
              aria-current={open ? "true" : undefined}
              href={campaignURL({ ...filters, open: open ? "" : "1" })}
            >
              모집 중만 보기 {open && "✓"}
            </Link>
            <Link
              className="button ghost"
              aria-current={sort ? "true" : undefined}
              href={campaignURL({ ...filters, sort: sort ? "" : "deadline" })}
            >
              {sort ? "마감 임박순 ✓" : "마감 임박순"}
            </Link>
          </nav>
          {!active.length ? (
            <div className="marketplace-empty">
              <ClipboardList aria-hidden="true" size={28} />
              <h2>표시할 캠페인이 없습니다.</h2>
              {category || open ? (
                <Link href="/jobs" className="button outline">
                  필터 초기화
                </Link>
              ) : (
                <Link href="/creators" className="button outline">
                  YouTube 채널 탐색
                </Link>
              )}
            </div>
          ) : (
            <ul className="figma-campaign-results">
              {active
                .slice((page - 1) * pageSize, page * pageSize)
                .map((row) => (
                  <li key={row.id} className="figma-campaign-row">
                    <div>
                      <p className="figma-eyebrow">
                        {row.brief.product} · {row.brief.category}
                      </p>
                      <h2>{row.brief.title}</h2>
                      <p>
                        {row.brief.format}
                        {row.owned &&
                          row.status !== "published" &&
                          (row.status === "draft" ? " · 내 초안" : " · 마감")}
                      </p>
                    </div>
                    <div>
                      <strong>{currency.format(row.brief.budget_krw)}원</strong>
                      {jobDeadline(row) && (
                        <p>{jobExpiry(jobDeadline(row)!)} 마감</p>
                      )}
                      <Link
                        className="button outline"
                        href={"/jobs/" + row.id}
                        aria-label={row.brief.title + " 상세 보기"}
                      >
                        캠페인 상세 보기{" "}
                        <ArrowUpRight size={16} aria-hidden="true" />
                      </Link>
                    </div>
                  </li>
                ))}
            </ul>
          )}
          {totalPages > 1 && (
            <nav aria-label="캠페인 페이지" className="figma-campaign-filters">
              {page > 1 && (
                <Link
                  className="button outline"
                  href={campaignURL({ ...filters, page: String(page - 1) })}
                >
                  이전
                </Link>
              )}
              <span>
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  className="button outline"
                  href={campaignURL({ ...filters, page: String(page + 1) })}
                >
                  다음
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </section>
  );
}

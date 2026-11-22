import { notFound } from "next/navigation";
import Link from "next/link";
import { similarCreators } from "@/lib/catalog";
import { publicCreators } from "@/lib/data";
import { currentUser } from "@/lib/supabase";
import { ClaimButton } from "@/components/claim";
import { AddToList } from "@/components/lists";
import { supabase } from "@/lib/supabase";
import ads from "../../../../fixtures/ads.demo.json";
import { cache } from "react";
import type { Metadata } from "next";
import { indexable, siteUrl } from "@/lib/seo";
// One lookup per request for both metadata and the page.
const load = cache(async (id: string) =>
  (await publicCreators()).find((c) => c.seed_id === id),
);
// D083: only published, owner-verified, non-demo profiles are indexable; others are noindex (still public
// only because the DB marks them published — access control is the query, not this tag).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const c = await load(id);
  if (!c) return { title: "프로필을 찾을 수 없음", robots: { index: false } };
  const description = `${c.categories.join("·")} 크리에이터 프로필 · AD Me`;
  return {
    title: c.name,
    description,
    alternates: { canonical: `/creators/${encodeURIComponent(id)}` },
    ...(indexable(c)
      ? { openGraph: { title: c.name, description, type: "profile" } }
      : { robots: { index: false, follow: false } }),
  };
}
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await load(id);
  if (!c) notFound();
  const creators = await publicCreators();
  const claimed = c.claim_status === "verified";
  // Collected (non-demo) profiles stay unverified until an ownership claim is approved.
  const origin = c.is_demo
    ? "가상 프로필 · DEMO"
    : claimed
      ? "본인 연결 프로필 · 외부 지표 검증 전"
      : "미인증 · 협업 의사 미확인";
  const viewer = await currentUser();
  const user = c.is_demo || claimed ? null : viewer;
  // Groups for "그룹에 추가" (campaign shortlists are managed from the campaign page).
  const lists = viewer
    ? ((
        await (
          await supabase()
        )
          .from("saved_lists")
          .select("id,name")
          .is("campaign_id", null)
          .order("is_default", { ascending: false })
      ).data ?? [])
    : [];
  const similar = similarCreators(c, creators);
  // Structured data only for indexable profiles, and only self-declared, non-numeric fields.
  const jsonLd = indexable(c)
    ? JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        url: `${siteUrl()}/creators/${encodeURIComponent(id)}`,
        mainEntity: {
          "@type": "Person",
          name: c.name,
          knowsAbout: c.categories,
        },
      }).replace(/</g, "\\u003c")
    : null;
  return (
    <section className="wrap">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      )}
      <Link href="/creators" className="muted">
        ← 크리에이터 탐색
      </Link>
      <div className="split" style={{ marginTop: 35 }}>
        <aside>
          <div className="creator-visual" style={{ height: 340 }}>
            {c.name.slice(1)}
          </div>
          <p style={{ fontSize: 12, marginTop: 12 }}>{origin}</p>
          {c.is_demo || claimed ? (
            <Link
              className="button primary"
              href={`/campaigns/new?creator=${id}`}
            >
              협업 캠페인 만들기 ↗
            </Link>
          ) : (
            <>
              <p style={{ fontSize: 13 }}>
                본인 확인 전에는 제안을 받을 수 없습니다.
              </p>
              {user && <ClaimButton creatorId={id} />}
            </>
          )}
          <AddToList creatorId={id} lists={lists} />
        </aside>
        <div>
          <div className="tags">
            <span className="badge lime">
              {c.is_available === null
                ? "협업 의사 미확인"
                : c.is_available
                  ? "협업 가능"
                  : "협업 일정 확인 필요"}
            </span>
            <span className="badge">
              {c.is_demo ? "가상 프로필" : claimed ? "본인 연결" : "미인증"}
            </span>
          </div>
          <h1 className="page-title">{c.name}</h1>
          <p>
            @{c.handle} · {c.platforms.join(" / ")}
          </p>
          <p>{c.bio}</p>
          <div className="tags">
            {c.vibes.map((t) => (
              <span key={t} className="badge">
                {t}
              </span>
            ))}
          </div>
          <div className="metric-row">
            <div>
              <strong>
                {c.is_demo ? c.followers.toLocaleString() : "미확보"}
              </strong>
              <span>{c.is_demo ? "가상 팔로워" : "팔로워"}</span>
            </div>
            <div>
              <strong>
                {c.price_min_krw === null
                  ? "견적 미확인"
                  : `${c.price_min_krw.toLocaleString()}원~`}
              </strong>
              <span>
                {c.is_demo ? "가상 최소 견적" : "본인 등록 최소 견적"}
              </span>
            </div>
            <div>
              <strong>미확보</strong>
              <span>오디언스·참여율</span>
            </div>
          </div>
          <h3>콘텐츠 & 포트폴리오</h3>
          <p>
            {c.categories.join(" · ")}
            <br />
            광고 형식: {c.formats.join(" · ")}
            <br />
            {!c.social_url && !c.portfolio_url
              ? "등록된 포트폴리오와 SNS 원본 링크가 없습니다."
              : "본인이 등록한 링크이며 플랫폼 소유권은 별도 검증되지 않았습니다."}
          </p>
          <div className="inline" style={{ marginBottom: 24 }}>
            {c.social_url && c.social_url.startsWith("https://") && (
              <a
                className="button outline small"
                href={c.social_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                SNS 원본 ↗
              </a>
            )}
            {c.portfolio_url && c.portfolio_url.startsWith("https://") && (
              <a
                className="button outline small"
                href={c.portfolio_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                포트폴리오 ↗
              </a>
            )}
          </div>
          <h3>과거 광고 이력</h3>
          {ads
            .filter((a) => a.creator_seed_id === id)
            .map((a) => (
              <div className="notice" key={a.seed_id}>
                <strong>{a.brand_label}</strong> · {a.date}
                <br />
                {a.format} / {a.category}
                <br />
                {a.notice}
                <br />
                검증: 가상 예시 · 원본 출처 없음
              </div>
            ))}
          <h3 style={{ marginTop: 32 }}>브랜드 안전성 검토</h3>
          <p>
            검증된 공개 검토 자료가 없습니다. 자료 부족은 안전성을 보증하지
            않습니다. 미확인 논란을 자동 생성하지 않습니다.
          </p>
          <div className="inline">
            <Link
              className="button outline small"
              href={`/reports/new?creator=${id}`}
            >
              자료 정정·이슈 신고
            </Link>
            <Link
              className="button outline small"
              href={`/reports/new?creator=${id}&kind=deletion`}
            >
              이 프로필 삭제 요청
            </Link>
          </div>
          <h3 style={{ marginTop: 35 }}>비슷한 분위기의 크리에이터</h3>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            공개 프로필의 태그가 겹치는 정도로만 고르며, 분야(3) · 형식(2) ·
            분위기·플랫폼(1) 가중치 순으로 정렬합니다.{" "}
            {c.is_demo ? "가상 프로필끼리만" : "가상 프로필은 제외하고"}{" "}
            보여주며, 팔로워·가격·인구통계는 기준에 쓰지 않습니다.
          </p>
          {!similar.length && <p>겹치는 태그가 있는 공개 프로필이 없습니다.</p>}
          <div data-testid="similar">
            {similar.map((r) => (
              <Link
                className="result"
                key={r.creator.seed_id}
                href={`/creators/${r.creator.seed_id}`}
              >
                <span>↗</span>
                <div>
                  <strong>{r.creator.name}</strong>
                  <p style={{ margin: 0 }}>
                    공통 태그: {r.reasons.join(" · ")}
                  </p>
                </div>
                <span>{r.reasons.length}개 겹침</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

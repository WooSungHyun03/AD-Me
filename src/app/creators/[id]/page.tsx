import { configured, currentUser, supabase } from "@/lib/supabase";
import { readSavedLists } from "@/lib/saved-lists";
import { AddToList } from "@/components/lists";
import { youtubeChannelId } from "@/lib/featured-youtube";
import { PublicAdHistory } from "@/components/public-ad-history";
import { NormalizedPublic } from "@/components/normalized-public";
import { MetricHistory } from "@/components/metric-history";
import { PublicReviewRecords } from "@/components/public-review-records";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { similarCreators } from "@/lib/catalog";
import { publicCreators, publicCreator } from "@/lib/data";
import { PublicProfileLinks } from "@/components/public-profile-links";
import {
  normalizeSocialLink,
  publicProfilePath,
  safeHttpsLink,
} from "@/lib/social-links";
import ads from "../../../../fixtures/ads.demo.json";
import type { Metadata } from "next";
import { indexable } from "@/lib/seo";
// D083 (restored after merge a5f3326): missing/unpublished profiles are noindex with a "not found"
// title; only indexable (owner-verified, non-demo) profiles may be indexed. Access control is the
// public DTO query itself, not this tag.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const c = await publicCreator(id);
  if (!c)
    return {
      title: "프로필을 찾을 수 없음",
      robots: { index: false, follow: false },
    };
  const description = `${c.categories.join("·")} 크리에이터 프로필 · AD Me`;
  return {
    title: c.name,
    description,
    alternates: { canonical: `/creators/${encodeURIComponent(c.seed_id)}` },
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
  if (configured()) {
    const { data } = await (
      await supabase()
    ).rpc("creator_youtube_channel", { p_creator_id: id });
    if (youtubeChannelId.safeParse(data).success)
      redirect("/creators/youtube/" + data);
  }
  const c = await publicCreator(id);
  if (!c) notFound();
  if (c.seed_id !== id) redirect(`/creators/${encodeURIComponent(c.seed_id)}`);
  let creators: Awaited<ReturnType<typeof publicCreators>> = [];
  try {
    creators = await publicCreators();
  } catch {
    /* Main profile remains readable when the bounded similar-list is unavailable. */
  }
  // D036: signed-in viewers add this public reference to their own named groups (campaign
  // shortlists are managed from the campaign page).
  const groups =
    configured() && (await currentUser())
      ? ((await readSavedLists(await supabase())) ?? [])
          .filter((l) => !l.campaign_id)
          .map((l) => ({ id: l.id, name: l.name }))
      : [];
  const social = normalizeSocialLink(c.social_url);
  const portfolio = safeHttpsLink(c.portfolio_url);
  // D032: similar profiles by shared public tags only (category 3 · format 2 · vibe/platform 1); demo and
  // real profiles never mix and followers/price are not used.
  const similar = similarCreators(c, creators);
  return (
    <section className="figma-width figma-creator-profile">
      <Link href="/creators" className="muted">
        ← 크리에이터 탐색
      </Link>
      <div className="split figma-registered-profile">
        <aside>
          <div className="creator-visual" style={{ height: 340 }}>
            {c.name.slice(1)}
          </div>
          <p style={{ fontSize: 12, marginTop: 12 }}>
            {c.is_demo ? "가상 프로필 · DEMO" : "본인 등록 · 외부 검증 전"}
          </p>
          <Link
            className="button primary"
            href={`/campaigns/new?creator=${id}`}
          >
            협업 캠페인 만들기 ↗
          </Link>
          <AddToList creatorId={c.seed_id} lists={groups} />
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
              {c.is_demo ? "가상 프로필" : "본인 등록"}
            </span>
          </div>
          <h1 className="page-title">{c.name}</h1>
          <h2 className="sr-only">크리에이터 상세 정보</h2>
          <p>
            @{c.handle} · {c.platforms.join(" / ")}
          </p>
          <p>{c.bio}</p>
          <NormalizedPublic reference={c.seed_id} />
          <MetricHistory reference={c.seed_id} />
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
                {c.is_demo && c.followers !== null
                  ? c.followers.toLocaleString()
                  : "미확보"}
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
            {!social && !portfolio
              ? "등록된 포트폴리오와 SNS 원본 링크가 없습니다."
              : "본인이 등록한 링크이며 플랫폼 소유권은 별도 검증되지 않았습니다."}
          </p>
          <PublicProfileLinks
            path={publicProfilePath(id, c.published)}
            social={social}
            portfolioUrl={portfolio?.href}
          />
          <h3>과거 광고 이력</h3>
          <PublicAdHistory creatorId={id} />
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
          <PublicReviewRecords creatorId={id} />
          <Link
            className="button outline small"
            href={`/reports/new?creator=${id}`}
          >
            자료 정정·이슈 신고
          </Link>
          <Link
            className="button outline small"
            href={`/reports/new?creator=${encodeURIComponent(id)}&kind=deletion`}
          >
            이 프로필 삭제 요청
          </Link>
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
                href={`/creators/${encodeURIComponent(r.creator.seed_id)}`}
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

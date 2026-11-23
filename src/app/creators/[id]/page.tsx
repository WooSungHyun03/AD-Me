import { configured, supabase } from "@/lib/supabase";
import { youtubeChannelId } from "@/lib/featured-youtube";
import { PublicAdHistory } from "@/components/public-ad-history";
import { NormalizedPublic } from "@/components/normalized-public";
import { MetricHistory } from "@/components/metric-history";
import { PublicReviewRecords } from "@/components/public-review-records";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { rank } from "@/lib/catalog";
import { publicCreators, publicCreator } from "@/lib/data";
import { PublicProfileLinks } from "@/components/public-profile-links";
import {
  normalizeSocialLink,
  publicProfilePath,
  safeHttpsLink,
} from "@/lib/social-links";
import ads from "../../../../fixtures/ads.demo.json";
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
  const social = normalizeSocialLink(c.social_url);
  const portfolio = safeHttpsLink(c.portfolio_url);
  const similar = rank(
    {
      category: c.categories[0],
      vibes: c.vibes,
      format: c.formats[0],
      budget_krw: c.price_max_krw,
    },
    creators,
  )
    .filter((r) => r.creatorId !== id)
    .slice(0, 3);
  return (
    <section className="wrap">
      <Link href="/creators" className="muted">
        ← 크리에이터 탐색
      </Link>
      <div className="split" style={{ marginTop: 35 }}>
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
        </aside>
        <div>
          <div className="tags">
            <span className="badge lime">
              {c.is_available ? "협업 가능" : "협업 일정 확인 필요"}
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
              <strong>{c.price_min_krw.toLocaleString()}원~</strong>
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
          <h3 style={{ marginTop: 35 }}>비슷한 분위기의 크리에이터</h3>
          {similar.map((r) => (
            <Link
              className="result"
              key={r.creatorId}
              href={`/creators/${r.creatorId}`}
            >
              <span>↗</span>
              <div>
                <strong>{r.creator.name}</strong>
                <p style={{ margin: 0 }}>{r.matchedTags.join(" · ")}</p>
              </div>
              <span>{r.score}점</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

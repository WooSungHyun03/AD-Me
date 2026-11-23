import { parseVideoWindow, selectVideoWindow } from "@/lib/video-insights";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BadgeCheck, ChevronDown } from "lucide-react";
import { publicCreator } from "@/lib/data";
import { PublicAdHistory } from "@/components/public-ad-history";
import { cache } from "react";
import { YoutubeImage } from "@/components/youtube-image";
import { SaveYoutubeChannel } from "@/components/save-youtube-channel";
import {
  featuredYoutube,
  isYoutubeDataStale,
  youtubeChannelId,
  youtubeCount,
  youtubeMetric,
  type FeaturedChannel,
} from "@/lib/featured-youtube";
import { isDemoMode } from "@/lib/mode";
import { currentUser, supabase } from "@/lib/supabase";

const loadYoutubeChannel = cache((id: string) => featuredYoutube("", id, 1));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const noindex = {
    robots: { index: false, follow: false },
  } satisfies Metadata;
  if (!youtubeChannelId.safeParse(id).success) return noindex;
  const { items } = await loadYoutubeChannel(id);
  const channel = items[0];
  if (!channel) return noindex;
  const description = `${channel.title}의 YouTube 채널 정보와 최근 공개 영상 · AD Me`;
  return {
    title: channel.title,
    description,
    alternates: { canonical: `/creators/youtube/${id}` },
    ...(channel.creator_id && !isDemoMode() ? {} : noindex),
  };
}

const date = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeZone: "Asia/Seoul",
});
const dateTime = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});
const languages = new Intl.DisplayNames(["ko"], { type: "language" });
const dateLabel = (value?: string | null) =>
  value ? date.format(new Date(value)) : "정보 없음";
const recentLimit = 12;

const topicNames: Record<string, string> = {
  Food: "음식",
  "Lifestyle_(sociology)": "라이프스타일",
};
Object.assign(topicNames, {
  Entertainment: "엔터테인먼트",
  Music: "음악",
  Video_game: "게임",
  Fashion: "패션",
  Hobby: "취미",
  Tourism: "여행",
  Technology: "테크",
  Sport: "스포츠",
  Physical_fitness: "피트니스",
  Knowledge: "지식",
  Film: "영화",
});
function topicLabel(topic: string) {
  const name = topic.split("/").pop() ?? "";
  return Object.hasOwn(topicNames, name)
    ? topicNames[name]
    : name.replaceAll("_", " ");
}
function languageLabel(language?: string | null) {
  if (!language) return "정보 없음";
  try {
    return languages.of(language) ?? language;
  } catch {
    return language;
  }
}

function VideoList({ videos }: { videos: FeaturedChannel["videos"] }) {
  return (
    <ul className="youtube-video-grid">
      {videos.map((video) => (
        <li key={video.id}>
          <a
            className="youtube-video-link"
            href={"https://www.youtube.com/watch?v=" + video.id}
            target="_blank"
            rel="noreferrer"
          >
            <YoutubeImage src={video.thumbnail} kind="thumbnail" />
            <span className="youtube-video-title">
              {video.title} <ArrowUpRight size={15} aria-hidden="true" />
            </span>
            <time dateTime={video.publishedAt}>
              {dateLabel(video.publishedAt)}
            </time>
            <span className="youtube-video-stats">
              {video.views != null && (
                <span>조회수 {youtubeMetric(video.views, "회")}</span>
              )}
              {video.likes != null && (
                <span>좋아요 {youtubeMetric(video.likes, "개")}</span>
              )}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function YoutubeChannel({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ videos?: string | string[] }>;
}) {
  const [{ id }, { videos: requestedWindow }] = await Promise.all([
    params,
    searchParams,
  ]);
  const window = parseVideoWindow(requestedWindow);
  if (!youtubeChannelId.safeParse(id).success) notFound();
  const [{ items, unavailable }, user] = await Promise.all([
    loadYoutubeChannel(id),
    currentUser(),
  ]);
  if (unavailable) {
    return (
      <section className="wrap">
        <h1 className="page-title">채널 정보를 불러오지 못했습니다</h1>
        <p role="alert">잠시 후 다시 시도해 주세요.</p>
        <Link className="button outline" href="/creators">
          채널 목록
        </Link>
      </section>
    );
  }
  const channel = items[0];
  if (!channel) notFound();
  const { metadata, creator_id: creatorId, videos } = channel;
  const db = await supabase();
  const [saved, owner, chat, contact] = await Promise.all([
    user
      ? db
          .from("saved_youtube_channels")
          .select("channel_id")
          .eq("channel_id", id)
          .maybeSingle()
      : null,
    creatorId ? publicCreator(creatorId) : null,
    creatorId && user ? db.rpc("youtube_own_room", { p_channel: id }) : null,
    creatorId ? db.rpc("public_youtube_contact", { p_id: id }) : null,
  ]);
  const sourceHashtags = [
    ...new Set(metadata?.description?.match(/#[\p{L}\p{M}\p{N}_]+/gu) ?? []),
  ].slice(0, 10);
  const topics = [
    ...new Set((metadata?.topics ?? []).map(topicLabel).filter(Boolean)),
  ];
  const lastVideo = videos[0];
  const visibleVideos = window
    ? selectVideoWindow(videos, window, Date.parse(channel.fetched_at))
    : videos;
  const windows = [
    ["", "전체"],
    ["7", "최근 7일"],
    ["30", "최근 30일"],
    ["90", "최근 90일"],
    ["latest-10", "최근 10개"],
    ["latest-20", "최근 20개"],
  ] as const;
  const stale = isYoutubeDataStale(channel.fetched_at);

  return (
    <article className="wrap youtube-profile">
      <Link className="youtube-back" href="/creators">
        <ArrowLeft size={16} /> 크리에이터 탐색
      </Link>
      <div className="youtube-hero">
        <YoutubeImage src={metadata?.banner} kind="banner" eager />
        <div className="youtube-identity">
          <YoutubeImage src={metadata?.avatar} kind="avatar" eager />
          <div className="youtube-identity-copy">
            <div className="tags">
              <span className="badge">YouTube 공개 채널</span>
              {creatorId && (
                <span className="badge lime">
                  <BadgeCheck size={14} /> AD Me 소유권 인증
                </span>
              )}
              {!creatorId && <span className="badge">AD Me 소유권 미확인</span>}
            </div>
            <h1>{channel.title}</h1>
            {metadata?.handle && (
              <p className="youtube-handle">{metadata.handle}</p>
            )}
            {!!topics.length && (
              <p className="youtube-topics">{topics.join(" · ")}</p>
            )}
          </div>
        </div>
        <div className="youtube-actions">
          {creatorId && (
            <Link
              className="button primary"
              href={`/campaigns/new?creator=${creatorId}`}
            >
              협업 제안하기
            </Link>
          )}
          {chat?.data && (
            <Link
              className="button outline"
              href={`/dashboard#proposal-${chat.data}`}
            >
              채팅하기
            </Link>
          )}
          <a
            className={creatorId ? "button outline" : "button primary"}
            href={"https://www.youtube.com/channel/" + id}
            target="_blank"
            rel="noreferrer"
          >
            YouTube 원본 채널 열기 <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          {user ? (
            <SaveYoutubeChannel id={id} saved={Boolean(saved?.data)} />
          ) : (
            <Link className="button outline" href="/login">
              관심 채널 저장
            </Link>
          )}
        </div>
      </div>
      <nav className="youtube-jump" aria-label="채널 상세 섹션">
        <a href="#overview">채널 개요</a>
        <a href="#content">콘텐츠 분석</a>
        <a href="#videos">최근 영상</a>
        <a href="#collaboration">광고·협업</a>
      </nav>
      <section className="youtube-section" id="overview">
        <div className="youtube-section-head">
          <h2>채널 개요</h2>
          <p>
            YouTube Data API ·{" "}
            <time dateTime={channel.fetched_at}>
              {dateTime.format(new Date(channel.fetched_at))} KST
            </time>{" "}
            갱신
          </p>
        </div>
        {stale && (
          <p className="notice" role="status">
            갱신이 지연되어 마지막으로 수집한 값을 표시합니다.
          </p>
        )}
        <dl className="youtube-metrics">
          <div>
            <dt>구독자</dt>
            <dd>{youtubeCount(channel.subscriber_count)}</dd>
          </div>
          <div>
            <dt>채널 누적 조회수</dt>
            <dd>{youtubeMetric(metadata?.views, "회")}</dd>
          </div>
          <div>
            <dt>공개 영상 총수</dt>
            <dd>{youtubeMetric(metadata?.videoCount, "개")}</dd>
          </div>
          <div>
            <dt>최근 수집 영상</dt>
            <dd>
              {videos.length ? youtubeMetric(videos.length, "개") : "정보 없음"}
            </dd>
          </div>
          <div>
            <dt>최근 공개 영상 게시일</dt>
            <dd>{dateLabel(lastVideo?.publishedAt)}</dd>
          </div>
          <div>
            <dt>통계 출처</dt>
            <dd>YouTube</dd>
          </div>
        </dl>
        <div className="youtube-overview-details">
          <div>
            <h3>채널 소개</h3>
            <p className="youtube-description">
              {metadata?.description || "채널 소개 정보가 없습니다."}
            </p>
          </div>
          <dl>
            <div>
              <dt>채널 개설일</dt>
              <dd>{dateLabel(metadata?.createdAt)}</dd>
            </div>
            <div>
              <dt>채널 기본 언어</dt>
              <dd>{languageLabel(metadata?.language)}</dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="youtube-section" id="content">
        <div className="youtube-section-head">
          <h2>콘텐츠 분석</h2>
        </div>
        <h3>YouTube 주제 분류</h3>
        {topics.length ? (
          <ul className="tags youtube-topic-list">
            {topics.map((topic) => (
              <li className="badge" key={topic}>
                {topic}
              </li>
            ))}
          </ul>
        ) : (
          <p>제공된 주제 분류가 없습니다.</p>
        )}
        <h3>YouTube 채널 소개 해시태그</h3>
        {sourceHashtags.length ? (
          <ul className="tags youtube-topic-list">
            {sourceHashtags.map((tag) => (
              <li className="badge" key={tag}>
                {tag}
              </li>
            ))}
          </ul>
        ) : (
          <p>채널 소개에 공개된 해시태그가 없습니다.</p>
        )}
        <h3>크리에이터 등록 태그</h3>
        {owner?.vibes?.length ? (
          <ul className="tags youtube-topic-list">
            {owner.vibes.map((tag: string) => (
              <li className="badge" key={tag}>
                {tag}
              </li>
            ))}
          </ul>
        ) : (
          <p>채널 소유자가 공개한 태그가 없습니다.</p>
        )}
      </section>
      <section className="youtube-section" id="videos">
        <div className="youtube-section-head">
          <h2>최근 공개 영상</h2>
          {!!videos.length && <p>수집 {videos.length}개 · 최근 게시순</p>}
        </div>
        <nav className="video-window-nav" aria-label="공개 영상 기간">
          {windows.map(([value, label]) => (
            <Link
              key={label}
              href={
                value
                  ? `?videos=${value}#videos`
                  : `/creators/youtube/${id}#videos`
              }
              aria-current={
                value === (window ? requestedWindow : "") ? "true" : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>
        <p className="video-window-note">
          수집한 {videos.length}개 중 {visibleVideos.length}개 표시 · 채널 갱신
          시각 기준 · 영상 형식 구분 정보 없음
        </p>
        <p className="video-window-note">
          조회수와 좋아요는 공개 영상의 원본 수치입니다. 평균 조회수와 기간
          증가량은 분석 가능한 출처가 연결된 경우에 제공됩니다.
        </p>
        {visibleVideos.length ? (
          <VideoList videos={visibleVideos.slice(0, recentLimit)} />
        ) : (
          <p>선택한 범위의 공개 영상 정보가 없습니다.</p>
        )}
        {visibleVideos.length > recentLimit && (
          <details className="youtube-more">
            <summary>
              영상 {visibleVideos.length - recentLimit}개 더 보기{" "}
              <ChevronDown size={17} />
            </summary>
            <VideoList videos={visibleVideos.slice(recentLimit)} />
          </details>
        )}
      </section>
      <section className="youtube-section" id="collaboration">
        <div className="youtube-section-head">
          <h2>광고·협업</h2>
        </div>
        <h3>검증된 광고 이력</h3>
        {creatorId ? (
          <PublicAdHistory creatorId={creatorId} />
        ) : (
          <p>공개 출처로 확인된 광고 이력이 없습니다.</p>
        )}
        <div className="youtube-overview-details">
          <div>
            <h3>협업 정보</h3>
            <p>
              {owner
                ? owner.is_available
                  ? "협업 제안 접수 중"
                  : "협업 일정 확인 필요"
                : "협업 가능 여부 미확인"}
            </p>
            {owner?.bio && <p>{owner.bio}</p>}
            {!!owner?.formats?.length && (
              <p>선호 형식 · {owner.formats.join(" · ")}</p>
            )}
            {owner?.price_min_krw != null && (
              <p>
                희망 단가 · {owner.price_min_krw.toLocaleString("ko-KR")}원부터
              </p>
            )}
            {owner?.portfolio_url?.startsWith("https://") && (
              <a href={owner.portfolio_url} target="_blank" rel="noreferrer">
                포트폴리오 ↗
              </a>
            )}
          </div>
          <div>
            <h3>업무 연락처</h3>
            {contact?.error ? (
              <p role="alert">연락처를 불러오지 못했습니다.</p>
            ) : contact?.data ? (
              <ul className="youtube-topic-list">
                {contact.data.email && (
                  <li>
                    <a href={`mailto:${contact.data.email}`}>
                      {contact.data.email}
                    </a>
                  </li>
                )}
                {contact.data.phone && (
                  <li>
                    <a href={`tel:${contact.data.phone}`}>
                      {contact.data.phone}
                    </a>
                  </li>
                )}
              </ul>
            ) : (
              <p>공개된 업무 연락처가 없습니다.</p>
            )}
            {creatorId && <p>협업이 수락되면 AD Me에서 채팅할 수 있습니다.</p>}
          </div>
        </div>
      </section>
      <Link className="youtube-back" href="/privacy">
        채널 정보 정정·삭제 요청 안내
      </Link>
    </article>
  );
}

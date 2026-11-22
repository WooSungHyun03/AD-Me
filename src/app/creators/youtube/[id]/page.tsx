import Link from "next/link";
import { notFound } from "next/navigation";
import { featuredYoutube, youtubeCount } from "@/lib/featured-youtube";

const date = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeZone: "Asia/Seoul",
});

export default async function YoutubeChannel({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(id)) notFound();
  const { items, unavailable } = await featuredYoutube("", id, 1);
  if (unavailable)
    return (
      <section className="wrap">
        <p role="alert">채널 정보를 불러오지 못했습니다.</p>
        <Link href="/creators">채널 목록</Link>
      </section>
    );
  const channel = items[0];
  if (!channel) notFound();
  return (
    <section className="wrap">
      <Link href="/creators">크리에이터 탐색</Link>
      <p>
        <span className="badge">YouTube 공개 채널</span>
      </p>
      <h1 className="page-title">{channel.title}</h1>
      <p>
        구독자 {youtubeCount(channel.subscriber_count)} · YouTube Data API ·{" "}
        {date.format(new Date(channel.fetched_at))} 갱신
      </p>
      <p>AD Me 가입·협업 가능 여부는 확인되지 않았습니다.</p>
      <a
        className="button outline"
        href={"https://www.youtube.com/channel/" + channel.channel_id}
        target="_blank"
        rel="noreferrer"
      >
        YouTube 원본 채널 열기
      </a>
      <section className="ops-section">
        <h2>최근 공개 영상</h2>
        {channel.videos.length ? (
          <ul>
            {channel.videos.map((video) => (
              <li className="ops-row" key={video.id}>
                <a
                  href={"https://www.youtube.com/watch?v=" + video.id}
                  target="_blank"
                  rel="noreferrer"
                >
                  {video.title}
                </a>
                <p>
                  {date.format(new Date(video.publishedAt))}
                  {video.views == null
                    ? ""
                    : " · 조회수 " + video.views.toLocaleString("ko-KR") + "회"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>공개 영상 정보가 없습니다.</p>
        )}
      </section>
      <Link href="/privacy">채널 정보 정정·삭제 요청 안내</Link>
    </section>
  );
}

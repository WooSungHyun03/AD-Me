import Link from "next/link";
import { configured, supabase } from "@/lib/supabase";

type YoutubeProfile = {
  channel_id: string;
  title: string;
  subscriber_count: number | null;
  fetched_at: string;
  creator_id: string;
};
export default async function YoutubeCreators({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const response = configured()
    ? await (await supabase()).rpc("ops_public_channels", { p_query: q })
    : null;
  const profiles = (response?.data ?? []) as YoutubeProfile[];
  return (
    <section className="wrap">
      <Link href="/creators">크리에이터 탐색으로 돌아가기</Link>
      <h1 className="page-title">확인된 YouTube 채널</h1>
      <p>
        소유권을 확인하고 공개에 동의한 AD Me 크리에이터를 검색합니다. 구독자
        수는 YouTube API에서 제공한 값입니다.
      </p>
      <form method="get" className="form">
        <label>
          채널 이름
          <input type="search" name="q" maxLength={80} defaultValue={q} />
        </label>
        <button className="button outline">검색</button>
      </form>
      {!response || response.error ? (
        <p role="alert">채널 목록에 연결하지 못했습니다.</p>
      ) : profiles.length === 0 ? (
        <p className="empty">
          공개된 채널 중 검색 조건과 일치하는 채널이 없습니다.
        </p>
      ) : (
        <ul>
          {profiles.map((profile) => (
            <li key={profile.channel_id} className="ops-row">
              <strong>{profile.title}</strong>
              <p>
                구독자{" "}
                {profile.subscriber_count?.toLocaleString("ko-KR") ?? "비공개"}{" "}
                · 조회 {profile.fetched_at.slice(0, 10)}
              </p>
              <p>
                <Link href={"/creators/" + profile.creator_id}>
                  AD Me 프로필
                </Link>{" "}
                ·{" "}
                <a
                  href={"https://www.youtube.com/channel/" + profile.channel_id}
                  target="_blank"
                  rel="noreferrer"
                >
                  YouTube 원본 채널
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import Link from "next/link";
import { Search } from "lucide-react";
import type { FeaturedChannel } from "@/lib/featured-youtube";
import {
  publicTopicOptions,
  publishedTopicMatch,
  type PublicTopic,
} from "@/lib/public-youtube-topics";

export function ChannelSearch({
  query = "",
  params,
}: {
  query?: string;
  params?: URLSearchParams;
}) {
  return (
    <form action="/creators" method="get" className="discovery-search">
      <label htmlFor="channel-name" className="sr-only">
        채널 이름
      </label>
      <Search className="discovery-search-icon" size={20} aria-hidden="true" />
      <input
        id="channel-name"
        type="search"
        name="q"
        maxLength={80}
        defaultValue={query}
        placeholder="YouTube 채널 이름을 검색하세요"
      />
      {[...(params ?? [])]
        .filter(([key]) => key !== "q")
        .map(([key, value], index) => (
          <input key={key + index} type="hidden" name={key} value={value} />
        ))}
      <button className="button primary" type="submit">
        검색
      </button>
    </form>
  );
}

const subscriberRanges = [
  { key: "", label: "전체", min: 0, max: Infinity },
  { key: "under-100k", label: "10만 미만", min: 0, max: 100_000 },
  { key: "100k-1m", label: "10만~100만", min: 100_000, max: 1_000_000 },
  { key: "over-1m", label: "100만 이상", min: 1_000_000, max: Infinity },
];

export function filterPublicChannels(
  channels: FeaturedChannel[],
  params: URLSearchParams,
) {
  const range = subscriberRanges.find(
    ({ key }) => key === params.get("subscribers"),
  );
  const requestedTopic = params.get("yt-topic");
  const topic =
    requestedTopic && Object.hasOwn(publicTopicOptions, requestedTopic)
      ? (requestedTopic as PublicTopic)
      : null;
  const filtered = channels.filter((channel) => {
    const count = channel.subscriber_count;
    return (
      (!range?.key ||
        (count != null && count >= range.min && count < range.max)) &&
      (!topic || publishedTopicMatch(channel.metadata?.topics ?? [], topic))
    );
  });
  if (params.get("yt-sort") === "subscribers")
    return filtered.sort(
      (a, b) => (b.subscriber_count ?? -1) - (a.subscriber_count ?? -1),
    );
  if (params.get("yt-sort") === "updated")
    return filtered.sort(
      (a, b) => Date.parse(b.fetched_at) - Date.parse(a.fetched_at),
    );
  return filtered;
}

export function PublicChannelFilters({
  params,
  count,
}: {
  params: URLSearchParams;
  count: number;
}) {
  const current = params.get("subscribers") ?? "";
  const active = subscriberRanges.some(({ key }) => key === current)
    ? current
    : "";
  return (
    <div className="discovery-filter-group">
      <form className="discovery-selects" method="get" action="/creators">
        {[...params]
          .filter(([key]) => !["yt-topic", "yt-sort"].includes(key))
          .map(([name, value], index) => (
            <input type="hidden" name={name} value={value} key={name + index} />
          ))}
        <label>
          YouTube 주제
          <select name="yt-topic" defaultValue={params.get("yt-topic") ?? ""}>
            <option value="">전체 주제</option>
            {Object.keys(publicTopicOptions).map((topic) => (
              <option key={topic}>{topic}</option>
            ))}
          </select>
        </label>
        <label>
          결과 정렬
          <select name="yt-sort" defaultValue={params.get("yt-sort") ?? ""}>
            <option value="">기본 정렬</option>
            <option value="subscribers">구독자 많은 순</option>
            <option value="updated">데이터 최근 갱신순</option>
          </select>
        </label>
        <button type="submit" className="button outline">
          필터 적용
        </button>
      </form>
      <div className="discovery-toolbar">
        <nav aria-label="공개 채널 구독자 수">
          {subscriberRanges.map(({ key, label }) => {
            const query = new URLSearchParams(params);
            if (key) query.set("subscribers", key);
            else query.delete("subscribers");
            return (
              <Link
                key={label}
                href={query.size ? "/creators?" + query : "/creators"}
                aria-current={active === key ? "true" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <span>{count.toLocaleString("ko-KR")}개 채널</span>
      </div>
    </div>
  );
}

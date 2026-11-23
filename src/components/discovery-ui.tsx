import Link from "next/link";
import { Search } from "lucide-react";
import type { FeaturedChannel } from "@/lib/featured-youtube";

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
  rangeKey?: string,
) {
  const range = subscriberRanges.find(({ key }) => key === rangeKey);
  if (!range?.key) return channels;
  return channels.filter(
    ({ subscriber_count }) =>
      subscriber_count != null &&
      subscriber_count >= range.min &&
      subscriber_count < range.max,
  );
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
  );
}

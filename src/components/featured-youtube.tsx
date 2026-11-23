import Link from "next/link";
import { ArrowUpRight, CalendarDays, UsersRound } from "lucide-react";
import { youtubeCount, type FeaturedChannel } from "@/lib/featured-youtube";
import { YoutubeImage } from "./youtube-image";

const updatedDate = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  timeZone: "Asia/Seoul",
});

export function YoutubeChannelCards({
  channels,
}: {
  channels: FeaturedChannel[];
}) {
  return (
    <div className="creator-grid discovery-channel-grid">
      {channels.map((channel) => (
        <Link
          className="creator youtube-directory-card discovery-channel"
          data-testid="youtube-channel"
          key={channel.channel_id}
          href={"/creators/youtube/" + channel.channel_id}
        >
          <div className="discovery-channel-top">
            <YoutubeImage src={channel.metadata?.avatar} kind="avatar" />
            <div>
              <h3>{channel.title}</h3>
              <span>
                {channel.creator_id ? "AD Me 소유권 인증" : "YouTube 공개 채널"}
              </span>
            </div>
          </div>
          <div className="discovery-channel-metrics">
            <div>
              <span>
                <UsersRound size={14} aria-hidden="true" /> 구독자
              </span>
              <strong>{youtubeCount(channel.subscriber_count)}</strong>
            </div>
            <div>
              <span>
                <CalendarDays size={14} aria-hidden="true" /> 최근 갱신
              </span>
              <strong>
                {updatedDate.format(new Date(channel.fetched_at))}
              </strong>
            </div>
          </div>
          <span className="discovery-channel-cta">
            채널 상세 보기 <ArrowUpRight size={16} aria-hidden="true" />
          </span>
        </Link>
      ))}
    </div>
  );
}

import Link from "next/link";
import { ArrowUpRight, Video } from "lucide-react";
import { youtubeCount, type FeaturedChannel } from "@/lib/featured-youtube";

export function YoutubeChannelCards({
  channels,
}: {
  channels: FeaturedChannel[];
}) {
  return (
    <div className="creator-grid">
      {channels.map((channel) => (
        <Link
          className="creator youtube-directory-card"
          data-testid="youtube-channel"
          key={channel.channel_id}
          href={"/creators/youtube/" + channel.channel_id}
        >
          <div className="inline">
            <Video size={17} aria-hidden="true" />
            <span className="badge">YouTube 공개 채널</span>
          </div>
          <div className="creator-top">
            <h3>{channel.title}</h3>
            <ArrowUpRight size={18} aria-hidden="true" />
          </div>
          <p>구독자 {youtubeCount(channel.subscriber_count)}</p>
        </Link>
      ))}
    </div>
  );
}

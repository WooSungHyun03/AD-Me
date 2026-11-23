import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { youtubeCount, type FeaturedChannel } from "@/lib/featured-youtube";

import { YoutubeImage } from "./youtube-image";

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
            <YoutubeImage src={channel.metadata?.avatar} kind="avatar" />
            <span className="badge">
              {channel.creator_id ? "AD Me 소유권 인증" : "YouTube 공개 채널"}
            </span>
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

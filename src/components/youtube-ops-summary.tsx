import { isYoutubeDataStale } from "@/lib/featured-youtube";
import { CalendarClock, CircleAlert, Database, ListChecks } from "lucide-react";

export function YoutubeOpsSummary({
  channels,
  jobs,
}: {
  channels: { fetched_at: string }[];
  jobs?: { kind: string; status: string }[] | null;
}) {
  const youtubeJobs = jobs?.filter((job) => job.kind.startsWith("youtube_"));
  const metrics = [
    { icon: Database, label: "최근 수집 채널", value: channels.length },
    {
      icon: CircleAlert,
      label: "48시간 지난 채널",
      value: channels.filter((channel) =>
        isYoutubeDataStale(channel.fetched_at),
      ).length,
    },
    {
      icon: ListChecks,
      label: "조회된 대기·진행 작업",
      value: youtubeJobs?.filter((job) =>
        ["queued", "running"].includes(job.status),
      ).length,
    },
    {
      icon: CircleAlert,
      label: "조회된 실패 작업",
      value: youtubeJobs?.filter((job) => job.status === "failed").length,
    },
  ];
  return (
    <section className="sync-overview" aria-label="YouTube 동기화 요약">
      <div className="sync-overview-heading">
        <h3>YouTube 동기화 상태</h3>
        <p>
          <CalendarClock size={16} aria-hidden="true" /> 매일 오전 4시 KST
        </p>
      </div>
      <dl className="sync-overview-grid">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label}>
            <dt>
              <Icon size={16} aria-hidden="true" /> {label}
            </dt>
            <dd>
              {value === undefined
                ? "조회 권한 없음"
                : value.toLocaleString("ko-KR")}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

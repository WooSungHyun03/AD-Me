import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, supabase } from "@/lib/supabase";
import { loadNotifications, notificationText } from "@/lib/notifications";
import { MarkAllRead, NotificationBadge } from "@/components/notifications";
export const metadata = { title: "알림함 · AD Me" };
export default async function Notifications() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/notifications");
  const { items, unread, lastReadId } = await loadNotifications(
    await supabase(),
    50,
  );
  return (
    <section className="wrap">
      <span className="eyebrow">Notifications</span>
      <h1 className="page-title">알림함</h1>
      <div className="inline" style={{ margin: "18px 0 28px" }}>
        <NotificationBadge userId={user.id} initial={unread} />
        <MarkAllRead upto={items[0]?.id ?? 0} />
      </div>
      {items.length === 0 ? (
        <p className="muted">아직 받은 알림이 없습니다.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {items.map((n) => (
            <li
              key={n.id}
              data-testid="notification"
              data-unread={n.id > lastReadId}
              className="notice"
              style={{
                borderLeftColor: n.id > lastReadId ? undefined : "transparent",
              }}
            >
              {n.id > lastReadId && <span className="badge lime">새 알림</span>}{" "}
              <Link
                href={
                  n.proposal_id
                    ? `/dashboard#proposal-${n.proposal_id}`
                    : n.campaign_id
                      ? `/campaigns/${n.campaign_id}`
                      : "/saved-searches"
                }
              >
                {notificationText(n)}
              </Link>
              <br />
              <span className="muted" style={{ fontSize: 13 }}>
                {new Date(n.created_at).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

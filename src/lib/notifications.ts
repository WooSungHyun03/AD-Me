import type { SupabaseClient } from "@supabase/supabase-js";
export type Notification = {
  id: number;
  proposal_id: string | null;
  kind: "status" | "message" | "deliverable" | "saved_search";
  new_count: number | null;
  status: string | null;
  created_at: string;
};
const statusText: Record<string, string> = {
  pending: "새 제안·지원이 도착했습니다",
  accepted: "협업 요청이 수락되었습니다",
  rejected: "협업 요청이 거절되었습니다",
  cancelled: "상대가 요청을 취소했습니다",
  submitted: "결과물이 제출되었습니다",
  revision_requested: "수정 요청이 도착했습니다",
  completed: "협업이 완료되었습니다",
};
export const notificationText = (
  n: Pick<Notification, "kind" | "status" | "new_count">,
) =>
  n.kind === "saved_search"
    ? `저장 검색 조건에 새로 맞는 크리에이터 ${n.new_count}명이 있습니다`
    : n.kind === "message"
      ? "새 메시지가 도착했습니다"
      : n.kind === "deliverable"
        ? "결과물 링크가 도착했습니다"
        : (statusText[n.status ?? ""] ?? "협업 상태가 바뀌었습니다");
// RLS decides visibility; this only reads what the signed-in user may see.
export async function loadNotifications(db: SupabaseClient, limit = 30) {
  const [items, unread, cursor] = await Promise.all([
    db
      .from("notifications")
      .select("id,proposal_id,kind,status,new_count,created_at")
      .order("id", { ascending: false })
      .limit(limit),
    db.rpc("notification_unread"),
    db.from("notification_cursors").select("last_read_id").maybeSingle(),
  ]);
  if (items.error || unread.error) throw new Error("notifications_unavailable");
  return {
    items: (items.data ?? []) as Notification[],
    unread: (unread.data as number) ?? 0,
    lastReadId: (cursor.data?.last_read_id as number) ?? 0,
  };
}

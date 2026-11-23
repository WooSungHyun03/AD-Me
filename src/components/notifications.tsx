"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
const REFRESH = "adme:notifications";
const POLL_MS = 30_000;
// Realtime is only a "something changed" signal; the count always comes from the server (RLS-checked).
export function NotificationBadge({
  userId,
  initial,
}: {
  userId: string;
  initial: number;
}) {
  const [unread, setUnread] = useState(initial);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) setUnread((await res.json()).unread);
    } catch {
      /* keep the last known count; the next poll retries */
    }
  }, []);
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const db = url && key ? createBrowserClient(url, key) : null;
    let channel: ReturnType<NonNullable<typeof db>["channel"]> | null = null;
    let stopped = false;
    // Attach the user's token before subscribing; otherwise RLS treats the socket as anon and drops events.
    db?.auth.getSession().then(async ({ data }) => {
      if (stopped || !data.session) return;
      await db.realtime.setAuth(data.session.access_token);
      channel = db
        .channel(`notifications-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          refresh,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notification_cursors",
            filter: `user_id=eq.${userId}`,
          },
          refresh,
        )
        .subscribe();
    });
    const timer = setInterval(refresh, POLL_MS); // fallback when realtime is unavailable
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(REFRESH, refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(REFRESH, refresh);
      stopped = true;
      if (channel) db?.removeChannel(channel);
    };
  }, [userId, refresh]);
  return (
    <Link href="/notifications" className="button outline small">
      알림함{" "}
      <span data-testid="unread-count" aria-live="polite">
        {unread > 0
          ? `${unread > 99 ? "99+" : unread}개 안 읽음`
          : "새 알림 없음"}
      </span>
    </Link>
  );
}
export function MarkAllRead({ upto }: { upto: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        className="button outline"
        disabled={upto === 0}
        onClick={async () => {
          const res = await fetch("/api/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ upto }),
          }).catch(() => null);
          if (!res?.ok) return setError("읽음 처리에 실패했습니다.");
          window.dispatchEvent(new Event(REFRESH));
          router.refresh();
        }}
      >
        모두 읽음으로 표시
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}

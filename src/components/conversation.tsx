"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  conversationPageSchema,
  type ConversationMessage,
} from "@/lib/conversation";
import { safeHttpsLink } from "@/lib/social-links";
import { MessageForm } from "./deal-controls";
import { RoomImages } from "./image-upload";

function MessageReport({ id }: { id: string }) {
  const [result, setResult] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <details>
      <summary>메시지 신고</summary>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending) return;
          const reason = new FormData(e.currentTarget).get("reason");
          setPending(true);
          try {
            const res = await fetch("/api/messages/report", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messageId: id, reason }),
            });
            const data = await res.json();
            setResult(
              res.ok
                ? "비공개 검토 요청이 접수되었습니다."
                : data.error?.message || "신고를 저장하지 못했습니다.",
            );
          } catch {
            setResult("네트워크 오류입니다. 다시 시도해주세요.");
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="field">
          메시지 신고 사유
          <textarea
            name="reason"
            required
            minLength={10}
            maxLength={2000}
            disabled={pending}
          />
        </label>
        <button className="button outline small" disabled={pending}>
          메시지 신고 접수
        </button>
        {result && <p role="status">{result}</p>}
      </form>
    </details>
  );
}
function ConversationBody({
  proposalId,
  viewerId,
  deliverable,
  writable,
  refreshVersion,
}: {
  proposalId: string;
  viewerId: string;
  deliverable: boolean;
  writable: boolean;
  refreshVersion?: string;
}) {
  const [items, setItems] = useState<ConversationMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false),
    [blockedByMe, setBlockedByMe] = useState(false);
  const [loaded, setLoaded] = useState(false),
    [loading, setLoading] = useState(true),
    [changing, setChanging] = useState(false),
    [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const fetchPage = useCallback(
    async (before: string | null, signal: AbortSignal) => {
      const q = new URLSearchParams({ proposalId });
      if (before) q.set("cursor", before);
      const res = await fetch(`/api/messages?${q}`, {
        cache: "no-store",
        signal,
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error?.message || "메시지를 불러오지 못했습니다.");
      const parsed = conversationPageSchema.safeParse(data);
      if (!parsed.success)
        throw new Error("메시지 응답을 확인하지 못했습니다.");
      return parsed.data;
    },
    [proposalId],
  );
  const applyPage = useCallback(
    (
      page: ReturnType<typeof conversationPageSchema.parse>,
      before: string | null,
    ) => {
      setError("");
      setItems((current) =>
        before
          ? [
              ...current,
              ...page.items.filter(
                (m) => !current.some((old) => old.id === m.id),
              ),
            ]
          : page.items,
      );
      setCursor(page.nextCursor);
      setBlocked(page.blocked);
      setBlockedByMe(page.blockedByMe);
      setLoaded(true);
    },
    [],
  );
  const load = useCallback(
    async (before: string | null) => {
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      setLoading(true);
      try {
        const page = await fetchPage(before, controller.signal);
        if (!controller.signal.aborted) applyPage(page, before);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "메시지를 불러오지 못했습니다.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [fetchPage, applyPage],
  );
  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    fetchPage(null, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) applyPage(page, null);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "메시지를 불러오지 못했습니다.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [fetchPage, applyPage, refreshVersion]);
  return (
    <div style={{ marginTop: 16 }}>
      <div className="inline">
        <button
          className="button ghost small"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            void load(null);
          }}
        >
          메시지 새로고침
        </button>
        <button
          className="button outline small"
          disabled={changing || !loaded}
          onClick={async () => {
            setChanging(true);
            setError("");
            try {
              const res = await fetch("/api/messages/block", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ proposalId, blocked: !blockedByMe }),
              });
              const data = await res.json();
              if (!res.ok)
                throw new Error(
                  data.error?.message || "차단 상태를 변경하지 못했습니다.",
                );
              await load(null);
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "차단 상태를 변경하지 못했습니다.",
              );
            } finally {
              setChanging(false);
            }
          }}
        >
          {blockedByMe ? "대화 차단 해제" : "대화 차단"}
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading && <p aria-live="polite">메시지를 불러오는 중입니다.</p>}
      {cursor && (
        <button
          className="button outline small"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            void load(cursor);
          }}
        >
          이전 메시지 더 보기
        </button>
      )}
      {loaded && !items.length && (
        <p className="notice">아직 메시지가 없습니다.</p>
      )}
      {[...items].reverse().map((m) => {
        const link = safeHttpsLink(m.url ?? undefined);
        return (
          <div
            className="notice"
            key={m.id}
            data-testid="conversation-message"
            style={{ overflowWrap: "anywhere" }}
          >
            <strong>
              {m.senderId === viewerId ? "나" : "협업 파트너"} ·{" "}
              {m.kind === "deliverable" ? "결과물" : "메시지"}
            </strong>
            <time dateTime={m.createdAt} style={{ display: "block" }}>
              {new Date(m.createdAt).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}
            </time>
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{m.body}</p>
            {link && (
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                결과물 열기 ↗
              </a>
            )}
            {m.senderId !== viewerId && <MessageReport id={m.id} />}
          </div>
        );
      })}
      {blocked && (
        <p className="notice">
          대화가 차단되어 새 메시지를 보낼 수 없습니다. 기존 대화는 확인할 수
          있습니다.
        </p>
      )}
      {loaded && (
        <RoomImages proposalId={proposalId} canUpload={!blocked && writable} />
      )}
      {loaded && !blocked && writable && (
        <MessageForm
          proposalId={proposalId}
          deliverable={deliverable}
          onSent={() => void load(null)}
        />
      )}
    </div>
  );
}
export function Conversation(props: {
  proposalId: string;
  viewerId: string;
  refreshVersion?: string;
  deliverable: boolean;
  writable: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      data-live-chat
      style={{ marginTop: 24 }}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>메시지·결과물</summary>
      {open && <ConversationBody {...props} />}
    </details>
  );
}

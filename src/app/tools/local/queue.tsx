"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { z } from "zod";
import type { draftResult } from "@/lib/intelligence";

type Draft = z.infer<typeof draftResult>;

export function DraftQueue() {
  const [id, setId] = useState<string>();
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Draft>();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let polls = 0;
    async function poll() {
      try {
        const response = await fetch(
          "/api/intelligence?id=" + encodeURIComponent(id!),
          { signal: controller.signal },
        );
        const job = await response.json();
        if (!response.ok || job.status === "failed") {
          setMessage(
            job.error?.message ?? "현재 모델이 초안을 생성하지 못했습니다.",
          );
          setId(undefined);
        } else if (job.status === "done") {
          setDraft(job.output ?? undefined);
          setMessage(
            job.output
              ? "초안이 준비됐습니다."
              : "모델 응답을 읽지 못했습니다.",
          );
          setId(undefined);
        } else if (++polls >= 60) {
          setMessage(
            "처리가 지연되고 있습니다. 로컬 작업 서버 연결을 확인해주세요.",
          );
          setId(undefined);
        } else {
          setMessage(
            job.status === "running"
              ? "초안을 작성하고 있습니다…"
              : "작업 서버 연결을 기다리고 있습니다…",
          );
          timer = setTimeout(poll, 3000);
        }
      } catch {
        if (!controller.signal.aborted) {
          setMessage("작업 상태를 확인하지 못했습니다.");
          setId(undefined);
        }
      }
    }
    void poll();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const brief = new FormData(event.currentTarget).get("brief");
    setSending(true);
    setDraft(undefined);
    setMessage("요청을 보내고 있습니다…");
    try {
      const response = await fetch("/api/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const payload = await response.json();
      if (response.ok) setId(payload.id);
      else setMessage(payload.error?.message ?? "요청을 접수하지 못했습니다.");
    } catch {
      setMessage("연결을 확인한 뒤 다시 시도해주세요.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ops-section">
      <form className="form ops-form" onSubmit={submit}>
        <label>
          광고 브리프
          <textarea
            name="brief"
            required
            minLength={10}
            maxLength={1600}
            rows={6}
          />
        </label>
        <button className="button outline" disabled={sending || !!id}>
          초안 생성
        </button>
        <p role="status">{message}</p>
      </form>
      {draft && (
        <article className="panel">
          <h2>광고 콘셉트</h2>
          <p>{draft.concept}</p>
          <h3>콘텐츠 구성</h3>
          <ol>
            {draft.outline.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
          <h3>협업 제안 초안</h3>
          <p>{draft.proposal}</p>
        </article>
      )}
    </div>
  );
}

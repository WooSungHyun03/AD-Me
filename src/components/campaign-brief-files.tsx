"use client";
import { useRef, useState } from "react";
import {
  type BriefFilesPage,
  briefFilesPage,
} from "@/lib/campaign-brief-files";
const date = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});
export function CampaignBriefFiles({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: BriefFilesPage;
}) {
  const [page, setPage] = useState(initial),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const busy = useRef(false),
    uploadKey = useRef<string | null>(null),
    changeKey = useRef<{ signature: string; key: string } | null>(null);
  const endpoint = `/api/campaigns/${campaignId}/brief`;
  async function load() {
    const response = await fetch(endpoint, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok)
      throw Error(data.error?.message ?? "첨부 이력을 불러오지 못했습니다.");
    setPage(briefFilesPage.parse(data));
  }
  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof TypeError || error instanceof SyntaxError
          ? "전송 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해주세요."
          : error instanceof Error
            ? error.message
            : "요청 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해주세요.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function change(action: "restore" | "clear", fileId: string | null) {
    const signature = action + ":" + fileId;
    if (changeKey.current?.signature !== signature)
      changeKey.current = { signature, key: crypto.randomUUID() };
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        fileId,
        expectedVersion: page.revision,
        clientKey: changeKey.current.key,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      await load().catch(() => {});
      throw Error(data.error?.message ?? "변경하지 못했습니다.");
    }
    await load();
    changeKey.current = null;
    setMessage(
      action === "restore"
        ? "이전 파일을 새 활성 버전으로 복원했습니다."
        : "활성 첨부를 해제했습니다. 이전 이력은 보존 기간 동안 유지됩니다.",
    );
  }
  return (
    <div className="form-stack">
      <p>
        현재 버전 {page.revision} · 첨부를 바꾸어도 이전 파일은 승인된 보존 기간
        동안 이력에서 확인할 수 있습니다. 파일은 이 캠페인의 소유자만 열 수
        있습니다.
      </p>
      <p>브리프 파일은 계정 전체에서 최대 20개까지 보관할 수 있습니다.</p>
      {!page.enabled && (
        <p className="notice" role="status">
          첨부 파일 기능을 준비 중입니다.
        </p>
      )}
      {page.enabled && (
        <form
          className="form-stack"
          aria-label="캠페인 브리프 첨부"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const body = new FormData(form);
            void run(async () => {
              uploadKey.current ??= crypto.randomUUID();
              body.set("clientKey", uploadKey.current);
              body.set("expectedVersion", String(page.revision));
              const response = await fetch(endpoint, { method: "POST", body });
              const data = await response.json();
              if (!response.ok) {
                await load().catch(() => {});
                throw Error(
                  data.error?.message ?? "첨부를 저장하지 못했습니다.",
                );
              }
              await load();
              uploadKey.current = null;
              form.reset();
              setMessage("새 첨부 버전을 저장했습니다.");
            });
          }}
        >
          <label className="field">
            브리프 파일 (4MB 이하)
            <input
              name="file"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.pdf"
              required
              disabled={pending}
              onChange={() => {
                uploadKey.current = null;
              }}
            />
          </label>
          <label>
            <input type="checkbox" name="rights" required disabled={pending} />{" "}
            직접 만들었거나 사용할 권리가 있는 파일입니다.
          </label>
          <button className="button primary" disabled={pending}>
            새 첨부 버전 저장
          </button>
        </form>
      )}
      {page.activeFile && (
        <button
          className="button outline"
          disabled={pending}
          onClick={() => void run(() => change("clear", null))}
        >
          활성 첨부 해제
        </button>
      )}
      <p role="status" aria-live="polite">
        {pending ? "처리 중입니다." : message}
      </p>
      <h2>저장된 첨부 파일</h2>
      {!page.files.length && (
        <p className="empty">아직 저장된 첨부 파일이 없습니다.</p>
      )}
      {page.files.map((file, index) => (
        <article
          className="panel"
          key={file.fileId ?? index}
          data-testid="brief-file"
        >
          <h3>
            {file.name ?? "보존 기간이 종료된 파일"}{" "}
            {file.fileId && page.activeFile === file.fileId && (
              <span className="badge lime">활성</span>
            )}
          </h3>
          <p>
            {date.format(new Date(file.createdAt))} ·{" "}
            {file.size == null ? "" : Math.ceil(file.size / 1024) + "KB"}
          </p>
          {file.fileId && (
            <div className="inline">
              <button
                className="button outline small"
                disabled={pending}
                onClick={() =>
                  void run(async () => {
                    const response = await fetch(`${endpoint}/${file.fileId}`, {
                      method: "POST",
                    });
                    const data = await response.json();
                    if (!response.ok)
                      throw Error(
                        data.error?.message ?? "파일을 열지 못했습니다.",
                      );
                    window.location.assign(data.url);
                  })
                }
              >
                파일 받기
              </button>
              {page.enabled && page.activeFile !== file.fileId && (
                <button
                  className="button outline small"
                  disabled={pending}
                  onClick={() => void run(() => change("restore", file.fileId))}
                >
                  이 파일로 복원
                </button>
              )}
            </div>
          )}
        </article>
      ))}
      <h2>변경 이력</h2>
      {page.history.length > 0 ? (
        <ol>
          {page.history.map((item) => (
            <li key={item.revision}>
              버전 {item.revision} ·{" "}
              {
                {
                  upload: "새 첨부",
                  restore: "이전 파일 복원",
                  clear: "활성 첨부 해제",
                }[item.action]
              }{" "}
              ·{" "}
              {item.name ??
                (item.action === "clear" ? "첨부 없음" : "보존 기간 종료")}{" "}
              · {date.format(new Date(item.createdAt))}
            </li>
          ))}
        </ol>
      ) : (
        <p>변경 이력이 없습니다.</p>
      )}
      {page.revision > page.history.length && (
        <p>
          최근 20개 변경을 표시합니다. 보존 기간 내 모든 첨부 파일은 위 목록에서
          확인할 수 있습니다.
        </p>
      )}
    </div>
  );
}

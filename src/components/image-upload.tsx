"use client";
import { useRef, useState } from "react";
export function ImageUpload({
  purpose,
  proposalId,
  onUploaded,
}: {
  purpose: "brand_logo" | "message_image";
  proposalId?: string;
  onUploaded?: (id: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const key = useRef<string | null>(null),
    busy = useRef(false);
  async function upload() {
    if (!file || busy.current) return;
    key.current ??= crypto.randomUUID();
    busy.current = true;
    setPending(true);
    setMessage("");
    const name =
      file.name.replace(/[\x00-\x1f\x7f/\\]/g, "").slice(0, 100) || "이미지";
    const q = new URLSearchParams({
      id: key.current,
      purpose,
      name,
      ...(proposalId ? { proposalId } : {}),
    });
    try {
      const res = await fetch(`/api/images?${q}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(
          data.error?.message ||
            "이미지를 저장하지 못했습니다. 같은 파일로 다시 시도해주세요.",
        );
        return;
      }
      onUploaded?.(data.id);
      setMessage(
        purpose === "brand_logo"
          ? "로고를 확인했습니다. 브랜드 정보를 저장하면 적용됩니다."
          : "이미지 메시지를 보냈습니다.",
      );
    } catch {
      setMessage(
        "전송 결과를 확인하지 못했습니다. 같은 파일로 다시 시도해주세요.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="form-stack">
      <label className="field">
        {purpose === "brand_logo" ? "브랜드 로고 파일" : "대화 이미지 파일"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={pending}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            key.current = null;
            setMessage("");
          }}
        />
      </label>
      <p className="muted">
        정지 PNG·JPEG·WebP, 최대4MB. 위치·기기 메타데이터를 제거한 PNG로
        저장합니다.
      </p>
      <button
        type="button"
        className="button outline small"
        disabled={!file || pending}
        onClick={() => void upload()}
      >
        {pending
          ? "이미지 확인 중…"
          : purpose === "brand_logo"
            ? "로고 이미지 업로드"
            : "이미지 보내기"}
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
export function RoomImages({
  proposalId,
  canUpload,
}: {
  proposalId: string;
  canUpload: boolean;
}) {
  const [files, setFiles] = useState<
      { id: string; name: string; bytes: number; messageId: string }[] | null
    >(null),
    [message, setMessage] = useState("");
  async function load() {
    try {
      const res = await fetch(`/api/images/room?proposalId=${proposalId}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error?.message || "첨부 이력을 불러오지 못했습니다.");
        return;
      }
      setFiles(data);
      setMessage("");
    } catch {
      setMessage("첨부 이력을 불러오지 못했습니다. 다시 시도해주세요.");
    }
  }
  return (
    <section className="panel">
      <h4>대화 이미지 첨부</h4>
      {canUpload && (
        <ImageUpload
          purpose="message_image"
          proposalId={proposalId}
          onUploaded={() => void load()}
        />
      )}
      <button
        type="button"
        className="button outline small"
        onClick={() => void load()}
      >
        첨부 이미지 목록 새로고침
      </button>
      <p>
        최근20개 첨부입니다. 다운로드할 때 참여 권한과 차단 상태를 다시
        확인합니다.
      </p>
      {message && <p role="alert">{message}</p>}
      {files && (
        <ul>
          {files.map((f) => (
            <li key={f.id}>
              <a href={`/api/images/${f.id}`} download>
                {f.name} · {Math.ceil(f.bytes / 1024)}KB 다운로드
              </a>
            </li>
          ))}
        </ul>
      )}
      {files?.length === 0 && <p>아직 첨부한 이미지가 없습니다.</p>}
    </section>
  );
}

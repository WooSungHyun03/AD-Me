"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { z } from "zod";
const recordSchema = z.strictObject({
  id: z.uuid(),
  version: z.string().max(80),
  purpose: z.enum(["terms", "privacy", "adult_beta", "profile_publication"]),
  accepted: z.boolean(),
  recordedAt: z.iso.datetime({ offset: true }),
});
const labels = {
  terms: "이용약관",
  privacy: "개인정보 안내",
  adult_beta: "성인 자기확인",
  profile_publication: "선택적 프로필 공개",
};
export function ConsentSettings() {
  const router = useRouter();
  const [items, setItems] = useState<z.infer<typeof recordSchema>[] | null>(
      null,
    ),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const key = useRef<string | null>(null);
  async function history() {
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/consent", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw Error();
      setItems(z.array(recordSchema).max(50).parse(data.items));
    } catch {
      setError("기록을 불러오지 못했습니다. 다시 확인해주세요.");
    } finally {
      setPending(false);
    }
  }
  async function withdraw() {
    setPending(true);
    setError("");
    setMessage("");
    key.current ??= crypto.randomUUID();
    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey: key.current,
          purpose: "profile_publication",
          accepted: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw Error();
      recordSchema.parse(data);
      key.current = null;
      setMessage(
        "선택적 공개를 철회했습니다. 프로필·링크·브랜드 소개의 공개를 중단했습니다. 계정·파일 전체 삭제는 별도입니다.",
      );
      setItems(null);
      router.refresh();
    } catch {
      setError(
        "철회 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해주세요.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel" style={{ marginTop: 32 }} aria-busy={pending}>
      <h2>확인 기록과 공개 선택</h2>
      <p>
        <Link href="/privacy">개인정보 처리 안내</Link> ·{" "}
        <Link href="/terms">이용약관</Link>
      </p>
      <p>
        가입에 필요한 확인과 선택적 공개를 구분합니다. 공개를 다시 시작하려면
        프로필에서 권리·공개 동의와 공개 설정을 확인해주세요. 필수 동의 철회와
        계정 전체 삭제는{" "}
        <a href="mailto:2242798@donga.ac.kr">운영자 권리 요청</a>으로 접수할 수
        있습니다.
      </p>
      <div className="inline">
        <button
          className="button outline small"
          onClick={() => void history()}
          disabled={pending}
        >
          내 확인 기록 보기
        </button>
        <button
          className="button outline small"
          onClick={() => void withdraw()}
          disabled={pending}
        >
          선택적 프로필 공개 철회
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {items?.length === 0 && (
        <p role="status">
          기록이 없습니다. 이전 계정의 확인을 소급해서 동의로 기록하지 않습니다.
        </p>
      )}
      {items && items.length > 0 && (
        <>
          <p>최근 최대50개 기록 · 서버 UTC 저장/KST 표시</p>
          <ul>
            {items.map((r) => (
              <li key={r.id}>
                {labels[r.purpose]} · {r.accepted ? "확인·동의" : "철회"} ·{" "}
                {r.version} ·{" "}
                {new Date(r.recordedAt).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BrandAccount } from "@/lib/brand-profile";

export function BrandAccountForm({
  name,
  initial,
}: {
  name: string;
  initial?: BrandAccount;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      className="panel form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setMessage("");
        try {
          const response = await fetch("/api/account", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: form.get("name"),
              brand: {
                brandName: form.get("brandName"),
                industry: form.get("industry"),
                introduction: form.get("introduction"),
                published: form.has("published"),
                contactName: form.get("contactName"),
                contactEmail: form.get("contactEmail"),
                contactVisibility: form.get("contactVisibility"),
                logoUploadId: null,
              },
            }),
          });
          const result = await response.json();
          setMessage(
            response.ok
              ? "브랜드와 담당자 정보를 저장했습니다."
              : result.error?.message || "저장하지 못했습니다.",
          );
          if (response.ok) router.refresh();
        } catch {
          setMessage("네트워크 오류입니다. 다시 시도해주세요.");
        } finally {
          setPending(false);
        }
      }}
    >
      <h2>브랜드 소개와 담당자</h2>
      <p>
        브랜드 소개와 담당자 연락처는 따로 관리합니다. 사업자번호나 사업자
        인증은 요구하지 않습니다.
      </p>
      <input type="hidden" name="name" value={name} />
      <label className="field">
        브랜드명
        <input
          name="brandName"
          required
          minLength={2}
          maxLength={120}
          defaultValue={initial?.brandName}
        />
      </label>
      <label className="field">
        업종
        <input
          name="industry"
          required
          maxLength={80}
          defaultValue={initial?.industry}
        />
      </label>
      <label className="field">
        브랜드 소개
        <textarea
          name="introduction"
          aria-label="브랜드 소개"
          maxLength={2000}
          defaultValue={initial?.introduction}
        />
      </label>
      <label className="inline">
        <input
          type="checkbox"
          name="published"
          defaultChecked={initial?.published}
        />
        브랜드 소개 공개
      </label>
      <p className="notice">
        로고 업로드는 준비 중입니다. 현재는 외부 이미지 주소를 받지 않습니다.
      </p>
      <label className="field">
        담당자 이름
        <input
          name="contactName"
          maxLength={80}
          autoComplete="name"
          defaultValue={initial?.contactName}
        />
      </label>
      <label className="field">
        담당자 업무 이메일
        <input
          name="contactEmail"
          type="email"
          maxLength={254}
          autoComplete="email"
          defaultValue={initial?.contactEmail}
        />
      </label>
      <label className="field">
        담당자 공개 범위
        <select
          name="contactVisibility"
          aria-label="담당자 공개 범위"
          defaultValue={initial?.contactVisibility ?? "private"}
        >
          <option value="private">나만 보기</option>
          <option value="collaborators">수락한 협업 상대에게 공유</option>
        </select>
      </label>
      <p>
        연락처는 공개 브랜드 소개에 포함하지 않습니다. 공유를 중단하면 이후
        조회가 차단됩니다.
      </p>
      <button className="button primary" disabled={pending}>
        {pending ? "저장 중…" : "브랜드 정보 저장"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}

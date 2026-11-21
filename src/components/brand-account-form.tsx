"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { policyDocument, publicationIntent } from "@/lib/consent";
import { usePublicationChoice } from "./use-publication-choice";
import { useRouter } from "next/navigation";
import type { BrandAccount } from "@/lib/brand-profile";
import { ImageUpload } from "./image-upload";
import Image from "next/image";

export function BrandAccountForm({
  name,
  initial,
  brandId,
}: {
  name: string;
  initial?: BrandAccount;
  brandId?: string;
}) {
  const [pending, setPending] = useState(false);
  const [published, setPublished] = usePublicationChoice(
    initial?.published ?? false,
  );
  const [message, setMessage] = useState("");
  const router = useRouter();
  const [logo, setLogo] = useState<string | null | undefined>(undefined);
  const intent = useRef<ReturnType<typeof publicationIntent> | null>(null);
  return (
    <form
      className="panel form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setMessage("");
        const body = {
          name: form.get("name"),
          brand: {
            brandName: form.get("brandName"),
            industry: form.get("industry"),
            introduction: form.get("introduction"),
            published: form.has("published"),
            contactName: form.get("contactName"),
            contactEmail: form.get("contactEmail"),
            contactVisibility: form.get("contactVisibility"),
            ...(logo === undefined ? {} : { logoUploadId: logo }),
          },
        };
        intent.current = publicationIntent(intent.current, body);
        try {
          const response = await fetch("/api/account", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...body,
              publication: {
                version: policyDocument.version,
                documentHash: policyDocument.documentHash,
                requestKey: intent.current.requestKey,
              },
            }),
          });
          const result = await response.json();
          if (response.ok) intent.current = null;
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
      <div>
        <h2 style={{ fontSize: 21 }}>브랜드 로고</h2>
        {brandId && (
          <Image
            key={logo ?? brandId}
            src={`/api/brands/${brandId}/logo`}
            width={128}
            height={128}
            unoptimized
            alt="공개 브랜드 로고"
            style={{ objectFit: "contain", background: "#F5F5F0" }}
            onError={(e) => {
              e.currentTarget.hidden = true;
            }}
          />
        )}
        <ImageUpload purpose="brand_logo" onUploaded={(id) => setLogo(id)} />
        <button
          type="button"
          className="button ghost small"
          onClick={() => setLogo(null)}
        >
          저장 시 로고 연결 해제
        </button>
        {logo === null && (
          <p role="status">
            브랜드 정보를 저장하면 로고 공개 연결을 해제합니다.
          </p>
        )}
      </div>
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
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
        />
        브랜드 소개 공개
      </label>
      <p className="notice">
        공개 선택과 저장 결과를 정책 {policyDocument.version}에 기록합니다.{" "}
        <Link href="/privacy">처리 안내</Link> ·{" "}
        <Link href="/terms">이용약관</Link>. 비공개로도 계정을 사용할 수
        있습니다. 업로드한 로고는 브랜드 정보 저장 시 적용되며, 소개 공개 설정에
        따라 표시됩니다. 외부 이미지 주소는 받지 않습니다.
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

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { jobAction, saveJob, saveProduct, searchCreators } from "./actions";
import { categories } from "@/lib/catalog";
const formats = ["숏폼", "브랜디드 영상", "제품 리뷰", "언박싱", "라이브"];

export function ProductForm() {
  const [result, action, pending] = useActionState(saveProduct, "");
  return (
    <form className="form ops-form" action={action}>
      <label>
        상품 이름
        <input required name="name" minLength={2} maxLength={100} />
      </label>
      <label>
        상품 설명
        <textarea
          required
          name="description"
          minLength={5}
          maxLength={1200}
          rows={4}
        />
      </label>
      <button className="button primary" disabled={pending}>
        {pending ? "등록 중…" : "상품 등록"}
      </button>
      <p role="status">{result}</p>
    </form>
  );
}

export function JobDraftForm({
  products,
}: {
  products: { id: string; name: string }[];
}) {
  const [result, action, pending] = useActionState(saveJob, "");
  return (
    <form className="form ops-form" action={action}>
      <label>
        광고 상품
        <select name="productId" required>
          {products.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        공고 제목
        <input name="title" required minLength={2} maxLength={120} />
      </label>
      <label>
        콘텐츠 분야
        <select name="category">
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        YouTube 광고 형식
        <select name="format">
          {formats.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>
      <label>
        총 예산 (원)
        <input
          name="budget_krw"
          type="number"
          min={10000}
          max={100000000}
          required
        />
      </label>
      <label>
        광고 목표와 요청 결과물
        <textarea name="goal" required minLength={2} maxLength={500} rows={4} />
      </label>
      <label>
        대상 시청자
        <input name="target_audience" required minLength={2} maxLength={500} />
      </label>
      <label>
        콘텐츠 분위기 (쉼표로 구분)
        <input name="vibes" required maxLength={160} />
      </label>
      <button className="button primary" disabled={pending}>
        {pending ? "저장 중…" : "무료로 초안 저장"}
      </button>
      <p role="status">{result}</p>
    </form>
  );
}

export function JobForm({
  id,
  kind,
}: {
  id: string;
  kind: "publish" | "close" | "apply";
}) {
  const [result, action, pending] = useActionState(jobAction, "");
  return (
    <form className="form ops-form" action={action}>
      <input name="job" value={id} type="hidden" />
      <input name="action" value={kind} type="hidden" />
      {kind === "apply" && (
        <label>
          지원 메시지
          <textarea
            name="pitch"
            required
            minLength={10}
            maxLength={2000}
            rows={5}
          />
        </label>
      )}
      <button className="button primary" disabled={pending}>
        {pending
          ? "처리 중…"
          : {
              publish: "게시권 1장으로 공개",
              close: "공고 마감",
              apply: "지원권 1장으로 제출",
            }[kind]}
      </button>
      <p role="status">{result}</p>
    </form>
  );
}

export function SearchForm() {
  const [result, action, pending] = useActionState(searchCreators, {});
  return (
    <>
      <form className="form ops-form" action={action}>
        <label>
          분야·해시태그·제작 형식
          <input name="query" maxLength={120} placeholder="예: 뷰티" />
        </label>
        <label>
          최소 구독자 수
          <input
            name="min"
            type="number"
            defaultValue={0}
            min={0}
            max={10000000000}
            required
          />
        </label>
        <label>
          최대 구독자 수
          <input
            name="max"
            type="number"
            defaultValue={10000000000}
            min={0}
            max={10000000000}
            required
          />
        </label>
        <label>
          최근 공개 영상
          <select name="days">
            <option value="0">전체</option>
            <option value="30">30일 이내</option>
            <option value="90">90일 이내</option>
          </select>
        </label>
        <label>
          희망 광고비 상한 (0원은 제한 없음)
          <input
            name="budget"
            type="number"
            defaultValue={0}
            min={0}
            max={100000000}
            required
          />
        </label>
        <button className="button primary" disabled={pending}>
          {pending ? "검색 중…" : "검색권 1장으로 검색"}
        </button>
        <p role="status">{result.message}</p>
      </form>
      {result.candidates?.map((item, index) => (
        <article className="ops-row" key={item.id}>
          <Link href={"/creators/" + encodeURIComponent(item.id)}>
            추천 후보 {index + 1} 프로필
          </Link>
          <p>{item.reason}</p>
        </article>
      ))}
    </>
  );
}

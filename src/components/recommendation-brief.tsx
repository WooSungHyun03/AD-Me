"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { recommendCreators } from "@/app/recommend-creators";
import { publicTopicOptions } from "@/lib/public-youtube-topics";
import { YoutubeImage } from "./youtube-image";

export function RecommendationBrief() {
  const [result, action, pending] = useActionState(recommendCreators, {});
  const [brief, setBrief] = useState({
    product: "",
    audience: "",
    category: "",
    budget: "",
    preference: "",
  });
  function update(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.currentTarget;
    setBrief((current) => ({ ...current, [name]: value }));
  }
  return (
    <div className="brief-workbench">
      <form
        action={action}
        className="brief-form"
        aria-label="유튜버 추천 조건"
      >
        <label className="field">
          상품명·설명
          <input
            name="product"
            value={brief.product}
            onChange={update}
            required
            minLength={2}
            maxLength={120}
            placeholder="예: 저당 단백질 스낵"
          />
        </label>
        <label className="field">
          타깃 고객
          <input
            name="audience"
            value={brief.audience}
            onChange={update}
            required
            minLength={2}
            maxLength={160}
            placeholder="예: 운동을 즐기는 20~30대"
          />
        </label>
        <label className="field">
          콘텐츠 분야
          <select
            name="category"
            value={brief.category}
            onChange={update}
            required
          >
            <option value="" disabled>
              분야 선택
            </option>
            {Object.keys(publicTopicOptions).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="field">
          광고 예산 (원)
          <input
            name="budget"
            value={brief.budget}
            onChange={update}
            required
            type="number"
            min={10000}
            max={100000000}
            inputMode="numeric"
            placeholder="1000000"
          />
        </label>
        <label className="field brief-wide">
          선호 태그 (선택)
          <input
            name="preference"
            value={brief.preference}
            onChange={update}
            maxLength={120}
            placeholder="예: 자연스러움, 전문적"
          />
        </label>
        <label className="field">
          분야 조건
          <select name="categoryPolicy" defaultValue="hard">
            <option value="hard">일치 필수</option>
            <option value="soft">선호 조건</option>
          </select>
        </label>
        <label className="field">
          예산 조건
          <select name="budgetPolicy" defaultValue="hard">
            <option value="hard">예산 이내 필수</option>
            <option value="soft">선호 조건</option>
          </select>
        </label>
        <label className="field brief-wide">
          필수 조건 미확인 후보
          <select name="unknownPolicy" defaultValue="exclude">
            <option value="exclude">제외</option>
            <option value="hold">확인 필요로 표시</option>
          </select>
        </label>
        <button type="submit" className="button primary brief-wide" disabled={pending}>
          <Search size={18} aria-hidden="true" />{" "}
          {pending ? "후보 확인 중…" : "조건에 맞는 유튜버 찾기"}
        </button>
      </form>
      {result.error && (
        <p className="notice" role="alert">
          {result.error}
        </p>
      )}
      {result.brief && (
        <div className="brief-results" aria-live="polite">
          <h2>{result.brief.product} 협업 후보</h2>
          <p>
            {result.brief.category} · 최대{" "}
            {result.brief.budget.toLocaleString("ko-KR")}원 · 타깃{" "}
            {result.brief.audience}
          </p>
          {result.incomplete && (
            <p role="status">일부 후보 자료를 불러오지 못했습니다.</p>
          )}
          <h3>등록 크리에이터</h3>
          {result.registered?.length ? (
            <ul className="brief-registered">
              {result.registered.map((r) => (
                <li key={r.id}>
                  <Link href={`/creators/${encodeURIComponent(r.id)}`}>
                    <strong>{r.name}</strong>{" "}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                  <p>
                    {r.status === "hold"
                      ? "필수 조건 확인 필요 · "
                      : "입력 조건 통과 · "}
                    {r.reasons.join(" · ")}
                    {r.score != null ? ` · 프로필 적합도 ${r.score}점` : ""}
                  </p>
                  <p>
                    데이터 충족률 {r.coverage}% · 조건 점수는 협업 성과의 예측이
                    아닙니다.
                  </p>
                  <p>확인할 항목 {r.missing.join(" · ")}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>분야와 예산이 확인된 협업 가능 프로필을 찾지 못했습니다.</p>
          )}
          {result.channels?.length ? (
            <>
              <h3>같은 주제의 공개 YouTube 채널</h3>
              <p>
                YouTube가 제공한 주제 분류 기준입니다. 공개 채널의 오디언스,
                견적, 협업 가능 여부는 미확인입니다.
              </p>
              <ul className="brief-registered">
                {result.channels.map((channel) => (
                  <li key={channel.channel_id}>
                    <Link href={`/creators/youtube/${channel.channel_id}`}>
                      <YoutubeImage
                        src={channel.metadata?.avatar}
                        kind="avatar"
                      />
                      <span>
                        <strong>{channel.title}</strong>
                        <br />
                        {channel.subscriber_count == null
                          ? "구독자 정보 없음"
                          : `구독자 ${channel.subscriber_count.toLocaleString("ko-KR")}명`}
                      </span>
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>같은 주제로 분류된 공개 채널이 없습니다.</p>
          )}
          <Link className="discovery-text-link" href="/creators">
            전체 크리에이터 탐색
          </Link>
        </div>
      )}
    </div>
  );
}

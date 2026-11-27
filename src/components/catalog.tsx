"use client";
import { creatorPlatforms, platformLabels } from "@/lib/service-catalog";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Heart, ArrowUpRight } from "lucide-react";
import { creators as fixtures } from "@/lib/catalog";
import type { PublicCatalogCreator } from "@/lib/creator-public-profile";
import {
  catalogFollowerValue,
  creatorFilterIssues,
  filterCreators,
  parseCreatorFilters,
  serializeCreatorFilters,
  emptyCreatorFilters,
  type CreatorFilters,
} from "@/lib/creator-filters";
import { useCatalogFilters } from "./use-catalog-filters";
import { createCreatorSearchStore } from "@/lib/creator-search-store";
import type { FilteredCatalog } from "@/lib/filtered-catalog";
import { SearchProposalForm } from "./search-proposal";

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function FilterChoices({
  name,
  title,
  options,
  selected,
  toggle,
}: {
  name: string;
  title: string;
  options: { value: string; label: string }[];
  selected: string[];
  toggle: (value: string) => void;
}) {
  const interactive = useSyncExternalStore(
    subscribeToHydration,
    clientReady,
    serverReady,
  );
  return (
    <details
      className="catalog-filter-choices"
      data-testid={`filter-${name}`}
      inert={!interactive}
      aria-busy={!interactive}
    >
      <summary>
        {title}{" "}
        <span>{selected.length ? `${selected.length}개 선택` : "전체"}</span>
      </summary>
      <fieldset aria-label={title}>
        <legend>{title} 선택</legend>
        {options.map(({ value, label }) => (
          <label key={value}>
            <input
              type="checkbox"
              checked={selected.includes(value)}
              disabled={selected.length >= 8 && !selected.includes(value)}
              onChange={() => toggle(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
    </details>
  );
}
export function Catalog({
  items = fixtures,
  initialSaved = [],
  remote = false,
  initialPage,
  initialFilters = emptyCreatorFilters(),
}: {
  items?: PublicCatalogCreator[];
  initialSaved?: string[];
  remote?: boolean;
  initialPage?: FilteredCatalog;
  initialFilters?: CreatorFilters;
}) {
  const { filters, update, reset } = useCatalogFilters();
  const [saved, setSaved] = useState<string[]>(initialSaved),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState("");
  const issues = creatorFilterIssues(filters);
  const [store] = useState(() =>
    createCreatorSearchStore(initialPage, initialFilters),
  );
  const remoteState = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const filterKey = serializeCreatorFilters(filters).toString();
  const invalid = issues.length > 0;
  useEffect(() => {
    if (!remote) return;
    if (invalid) {
      store.cancel();
      return;
    }
    void store.load(parseCreatorFilters(new URLSearchParams(filterKey)));
  }, [remote, store, filterKey, invalid]);
  // No unmount cancel: StrictMode's mount cleanup aborted an in-flight "더 보기" and the reload replaced it (D084 CI flake).
  const list = invalid
    ? []
    : remote
      ? remoteState.page.items
      : filterCreators(items, filters);
  const loading = remote && remoteState.loading && !invalid;
  const searchError = remote ? remoteState.error : "";
  const options = (values: string[]) =>
    [...new Set(values)]
      .sort((a, b) => a.localeCompare(b, "ko-KR"))
      .map((value) => ({ value, label: value }));
  function toggle(key: "platforms" | "categories" | "tags", value: string) {
    update((current) => ({
      [key]: current[key].includes(value)
        ? current[key].filter((v) => v !== value)
        : [...current[key], value],
    }));
  }
  async function save(id: string) {
    setError("");
    const res = await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId: id }),
    });
    if (!res.ok) {
      setError(
        res.status === 401
          ? "즐겨찾기는 로그인 후 계정에 저장됩니다."
          : "저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
      return;
    }
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  return (
    <>
      <SearchProposalForm apply={update} />
      <p>
        <Link href={`/saved-searches?${serializeCreatorFilters(filters)}`}>
          현재 조건 저장·내 저장 검색
        </Link>
      </p>
      <div className="toolbar">
        <input
          className="search"
          aria-label="크리에이터 검색"
          placeholder="이름, 계정, 분위기로 검색해보세요"
          value={filters.query}
          maxLength={120}
          onChange={(e) => update({ query: e.target.value }, true)}
        />
        <select
          aria-label="정렬"
          value={filters.sort}
          onChange={(e) =>
            update({ sort: e.target.value as CreatorFilters["sort"] })
          }
        >
          <option value="name">이름순</option>
          <option value="followers">팔로워 많은 순</option>
          <option value="price">견적 낮은 순</option>
        </select>
      </div>
      {error && (
        <div role="alert" className="notice">
          {error} <Link href="/login">로그인 →</Link>
        </div>
      )}
      {searchError && (
        <div role="alert" className="notice">
          {searchError}{" "}
          <button
            type="button"
            className="button outline small"
            onClick={() => void store.load(filters, false, true)}
          >
            검색 다시 시도
          </button>
        </div>
      )}
      {issues.length > 0 && (
        <div role="alert" className="notice" data-testid="filter-errors">
          {issues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </div>
      )}
      <div className="catalog-layout">
        <aside className="filters catalog-filters" aria-label="크리에이터 필터">
          <p className="catalog-filter-help">
            같은 항목은 하나라도 일치하면 포함하고, 서로 다른 항목은 모두
            일치해야 합니다. 항목별 최대 8개를 선택할 수 있습니다.
          </p>
          <div data-testid="metric-filter-availability">
            <label className="field">
              최소 참여율 (%)
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={filters.minEngagement ?? ""}
                disabled={
                  !remoteState.page.metrics?.engagement.available || !remote
                }
                onChange={(e) =>
                  update({ minEngagement: e.target.value }, true)
                }
              />
            </label>
            <p className="catalog-filter-help">
              {remote && remoteState.page.metrics?.engagement.available
                ? `승인된 자료 ${remoteState.page.metrics.engagement.profiles}개 프로필 · 표본 2개 이상, 갱신 기한 내 비 YouTube 자료 중 하나가 조건을 충족해야 합니다. 미확보 값은 0%가 아닙니다.`
                : "승인된 참여율 자료가 없어 필터를 제공하지 않습니다. YouTube 파생 참여율은 제외합니다."}
            </p>
            {filters.minEngagement && (
              <button
                className="button ghost small"
                onClick={() => update({ minEngagement: "" })}
              >
                참여율 조건 해제
              </button>
            )}
            <p className="catalog-filter-help">
              연령·성별 필터는 수집하지 않아 제공하지 않습니다.
            </p>
            {!!remoteState.page.metrics?.engagement.definitions.length && (
              <details>
                <summary>참여율 출처·산식</summary>
                {remoteState.page.metrics.engagement.definitions.map((d, n) => (
                  <p key={n}>
                    {d.provider} · 정책 {d.policyVersion} · {d.formula}
                  </p>
                ))}
                <p>
                  최대 20개 산식을 표시합니다. 상세 관측 기간·표본·출처는
                  프로필에서 확인해주세요.
                </p>
              </details>
            )}
          </div>
          <FilterChoices
            name="platform"
            title="플랫폼"
            options={creatorPlatforms.map((value) => ({
              value,
              label: platformLabels[value],
            }))}
            selected={filters.platforms}
            toggle={(value) => toggle("platforms", value)}
          />
          <FilterChoices
            name="category"
            title="콘텐츠 분야"
            options={options([
              ...items.flatMap((c) => c.categories),
              ...(remote ? remoteState.page.facets.categories : []),
              ...filters.categories,
            ])}
            selected={filters.categories}
            toggle={(value) => toggle("categories", value)}
          />
          <FilterChoices
            name="tag"
            title="이미지·분위기"
            options={options([
              ...items.flatMap((c) => c.vibes),
              ...(remote ? remoteState.page.facets.tags : []),
              ...filters.tags,
            ])}
            selected={filters.tags}
            toggle={(value) => toggle("tags", value)}
          />
          <div className="catalog-number-filters">
            {(
              [
                ["minPrice", "최소 예산 (원)", 100000000],
                ["maxPrice", "최대 예산 (원)", 100000000],
                ["minFollowers", "최소 팔로워", 10000000000],
                ["maxFollowers", "최대 팔로워", 10000000000],
              ] as const
            ).map(([key, label, max]) => (
              <label className="field" key={key}>
                {label}
                <input
                  type="number"
                  min="0"
                  max={max}
                  step="1"
                  value={filters[key]}
                  onChange={(e) => update({ [key]: e.target.value }, true)}
                  placeholder="제한 없음"
                />
              </label>
            ))}
          </div>
          <p className="catalog-filter-help">
            예산은 견적 범위와 겹치는 후보를 찾습니다. 팔로워 조건을 사용하면
            미확보 프로필은 제외합니다. DEMO 수치는 가상입니다.
          </p>
          <label>
            <input
              type="checkbox"
              checked={filters.available}
              onChange={(e) => update({ available: e.target.checked })}
            />
            협업 가능한 크리에이터
          </label>
          <button className="button outline small" onClick={reset}>
            필터 초기화
          </button>
        </aside>
        <div>
          <p style={{ fontSize: 13 }} role="status" data-testid="catalog-count">
            {/* Invalid filters never search, so they must not wait for a load or show a stale total. */}
            {remote && !invalid && !remoteState.loaded ? (
              "검색 결과를 확인하고 있습니다."
            ) : (
              <>
                <strong style={{ color: "#111312" }}>
                  {remote && !invalid ? remoteState.page.total : list.length}명
                </strong>
                의 크리에이터
              </>
            )}
          </p>
          <h2 className="sr-only">검색 결과</h2>
          <div className="creator-grid" aria-busy={loading}>
            {list.map((c, i) => (
              <article
                key={c.seed_id}
                className="creator"
                data-testid="creator-card"
              >
                <Link href={`/creators/${c.seed_id}`} prefetch={false}>
                  <div
                    className="creator-visual"
                    style={{
                      background: ["#dce1cd", "#e7dfcf", "#d5dddb", "#e2d7cf"][
                        i % 4
                      ],
                    }}
                  >
                    <span className="badge">
                      {c.is_demo ? "DEMO" : "본인 등록"} · {c.categories[0]}
                    </span>
                    {c.name.slice(1)}
                  </div>
                </Link>
                <div className="creator-top">
                  <Link href={`/creators/${c.seed_id}`} prefetch={false}>
                    <h3>
                      {c.name}{" "}
                      <ArrowUpRight size={14} style={{ display: "inline" }} />
                    </h3>
                  </Link>
                  <button
                    aria-label={`${c.name} 즐겨찾기`}
                    className={`icon-button ${saved.includes(c.seed_id) ? "saved" : ""}`}
                    onClick={() => save(c.seed_id)}
                  >
                    <Heart size={15} />
                  </button>
                </div>
                <p>
                  @{c.handle} · {c.platforms.join(" / ")}
                </p>
                <div className="tags">
                  {c.vibes.map((t) => (
                    <span className="badge" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
                <div className="creator-bottom">
                  <span>
                    {catalogFollowerValue(c) !== null
                      ? `${(catalogFollowerValue(c)! / 10000).toFixed(1)}만 팔로워 · 가상`
                      : "팔로워 미확보"}
                  </span>
                  <strong>
                    {c.price_min_krw === null
                      ? "견적 미확인"
                      : `${(c.price_min_krw / 10000).toLocaleString()}만원~`}
                  </strong>
                </div>
                <label
                  style={{
                    display: "flex",
                    gap: 8,
                    fontSize: 12,
                    marginTop: 12,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(c.seed_id)}
                    disabled={
                      selected.length === 3 && !selected.includes(c.seed_id)
                    }
                    onChange={() =>
                      setSelected((s) =>
                        s.includes(c.seed_id)
                          ? s.filter((x) => x !== c.seed_id)
                          : [...s, c.seed_id],
                      )
                    }
                  />
                  후보 비교에 담기
                </label>
              </article>
            ))}
          </div>
          {loading && <p role="status">검색 결과를 불러오고 있습니다.</p>}
          {remote &&
            remoteState.page.nextCursor &&
            !invalid &&
            !searchError && (
              <button
                type="button"
                className="button outline"
                disabled={loading}
                onClick={() => void store.load(filters, true)}
              >
                다음 후보 더 불러오기
              </button>
            )}
          {!list.length && !loading && !searchError && (
            <div className="empty">
              조건에 맞는 크리에이터가 없습니다. 필터를 조정해주세요.
            </div>
          )}
          {selected.length > 0 && (
            <div className="compare-bar">
              <span>후보 {selected.length}/3명 선택</span>
              <Link
                className="button primary small"
                href={`/compare?ids=${selected.join(",")}`}
              >
                후보 비교하기 →
              </Link>
              <button
                className="button ghost small"
                onClick={() => setSelected([])}
              >
                비우기
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

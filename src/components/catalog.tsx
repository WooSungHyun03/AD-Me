"use client";
import Link from "next/link";
import { useState } from "react";
import { Heart, ArrowUpRight } from "lucide-react";
import {
  categories,
  vibes,
  creators as fixtures,
  type Creator,
} from "@/lib/catalog";
export function Catalog({ items = fixtures }: { items?: Creator[] }) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [platform, setPlatform] = useState(""),
    [tag, setTag] = useState(""),
    [budget, setBudget] = useState(""),
    [available, setAvailable] = useState(false),
    [sort, setSort] = useState("name"),
    [saved, setSaved] = useState<string[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState("");
  let list = items.filter(
    (c) =>
      (!query ||
        `${c.name} ${c.handle} ${c.vibes.join(" ")} ${c.bio}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!category || c.categories.includes(category)) &&
      (!platform || c.platforms.includes(platform)) &&
      (!tag || c.vibes.includes(tag)) &&
      (!budget || c.price_min_krw <= Number(budget)) &&
      (!available || c.is_available),
  );
  list = [...list].sort((a, b) =>
    sort === "followers"
      ? b.followers - a.followers
      : sort === "price"
        ? a.price_min_krw - b.price_min_krw
        : a.name.localeCompare(b.name),
  );
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
      <div className="toolbar">
        <input
          className="search"
          aria-label="크리에이터 검색"
          placeholder="이름, 계정, 분위기로 검색해보세요"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="플랫폼"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          <option value="">모든 플랫폼</option>
          {["instagram", "youtube", "tiktok"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          aria-label="정렬"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
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
      <div className="catalog-layout">
        <aside className="filters">
          <label className="field" style={{ display: "grid", width: "100%" }}>
            콘텐츠 분야
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">모든 분야</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field" style={{ display: "grid", width: "100%" }}>
            이미지·분위기
            <select value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">모든 분위기</option>
              {vibes.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field" style={{ display: "grid", width: "100%" }}>
            최대 예산 (원)
            <input
              type="number"
              min="0"
              value={budget}
              placeholder="예: 1000000"
              onChange={(e) => setBudget(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />
            협업 가능한 크리에이터
          </label>
          <button
            className="button outline small"
            onClick={() => {
              setQuery("");
              setCategory("");
              setPlatform("");
              setTag("");
              setBudget("");
              setAvailable(false);
            }}
          >
            필터 초기화
          </button>
        </aside>
        <div>
          <p style={{ fontSize: 13 }}>
            <strong style={{ color: "#111312" }}>{list.length}명</strong>의
            크리에이터
          </p>
          <div className="creator-grid">
            {list.map((c, i) => (
              <article
                key={c.seed_id}
                className="creator"
                data-testid="creator-card"
              >
                <Link href={`/creators/${c.seed_id}`}>
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
                  <Link href={`/creators/${c.seed_id}`}>
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
                    {c.is_demo
                      ? `${(c.followers / 10000).toFixed(1)}만 팔로워 · 가상`
                      : "팔로워 미확보"}
                  </span>
                  <strong>
                    {(c.price_min_krw / 10000).toLocaleString()}만원~
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
          {!list.length && (
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

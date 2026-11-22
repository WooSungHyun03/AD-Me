"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { savedSearchList } from "@/lib/saved-searches";
import {
  serializeCreatorFilters,
  type CreatorFilters,
} from "@/lib/creator-filters";
import type { z } from "zod";
export function SavedSearches({ filters }: { filters: CreatorFilters }) {
  const [items, setItems] = useState<z.infer<typeof savedSearchList>>([]),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  async function reload(signal?: AbortSignal) {
    const r = await fetch("/api/saved-searches", { signal, cache: "no-store" }),
      data = await r.json();
    if (!r.ok)
      throw Error(data.error?.message || "목록을 불러오지 못했습니다.");
    setItems(savedSearchList.parse(data));
  }
  useEffect(() => {
    const c = new AbortController();
    void reload(c.signal).catch((e) => {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : "목록 오류");
    });
    return () => c.abort();
  }, []);
  async function mutate(method: string, body: unknown) {
    setPending(true);
    setError("");
    try {
      const r = await fetch("/api/saved-searches", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        d = await r.json();
      if (!r.ok)
        throw Error(d.error?.message || "저장 검색을 변경하지 못했습니다.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="panel">
      <p>
        계정당 최대20개입니다. 현재는 조건 저장과 다시 열기를 제공합니다. 신규
        후보 알림은 아직 제공하지 않습니다.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void mutate("POST", {
            id: crypto.randomUUID(),
            expected: 0,
            name,
            filters,
          });
        }}
      >
        <label className="field">
          저장 검색 이름
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
          />
        </label>
        <button
          className="button small"
          disabled={pending || items.length >= 20}
        >
          현재 조건 저장
        </button>
      </form>
      <p>
        <Link href={`/creators?${serializeCreatorFilters(filters)}`}>
          저장할 조건 확인·수정
        </Link>
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        className="button outline small"
        disabled={pending}
        onClick={() => {
          setError("");
          void reload().catch((e) => setError(e.message));
        }}
      >
        목록 새로고침
      </button>
      {!items.length && <p>저장된 검색 조건이 없습니다.</p>}
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/creators?${serializeCreatorFilters(item.filters)}`}>
              {item.name}
            </Link>{" "}
            <span>
              조건 v{item.filterVersion} · 수정 {item.revision}
            </span>{" "}
            <button
              className="button outline small"
              disabled={pending}
              onClick={() =>
                void mutate("POST", {
                  id: item.id,
                  expected: item.revision,
                  name: item.name,
                  filters,
                })
              }
            >
              현재 조건으로 갱신
            </button>{" "}
            <button
              className="button outline small"
              disabled={pending}
              onClick={() =>
                void mutate("DELETE", { id: item.id, expected: item.revision })
              }
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

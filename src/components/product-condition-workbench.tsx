"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  productConditionPageSchema,
  type ProductConditionPage,
} from "@/lib/product-conditions";
import { RecommendationBrief } from "./recommendation-brief";

const labels = { category: "분야", vibe: "분위기", format: "형식" };
export function ProductConditionWorkbench({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [data, setData] = useState<ProductConditionPage | null>(null),
    [audience, setAudience] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [selected, setSelected] = useState<number[]>([]);
  const createKey = useRef<string | null>(null),
    decisionKey = useRef<string | null>(null),
    polls = useRef(0);
  const decode = useCallback(
    async (response: Response) => {
      const value = await response.json();
      if (!response.ok)
        throw Error(value.error?.message || "조건을 불러오지 못했습니다.");
      if (value === null) return null;
      const page = productConditionPageSchema.parse(value);
      if (page.productId !== productId)
        throw Error("상품 응답을 확인하지 못했습니다.");
      return page;
    },
    [productId],
  );
  const refresh = useCallback(
    async (id?: string) => {
      setError("");
      try {
        const response = await fetch(
          `/api/product-conditions?${id ? `id=${id}` : `productId=${productId}`}`,
          { cache: "no-store" },
        );
        const value = await decode(response);
        setData(value);
        if (value?.decision !== "pending") setSelected([]);
      } catch {
        setError(
          "현재 상태를 확인하지 못했습니다. 다시 불러오거나 수동 추천을 사용해주세요.",
        );
      }
    },
    [decode, productId],
  );
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    fetch(`/api/product-conditions?productId=${productId}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(decode)
      .then((value) => {
        if (!cancelled) {
          setData(value);
          if (value) setAudience(value.source.audience);
        }
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "저장된 조건을 불러오지 못했습니다. 수동 추천은 계속 사용할 수 있습니다.",
          );
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [productId, decode]);
  useEffect(() => {
    if (
      !data ||
      !["queued", "running"].includes(data.status) ||
      polls.current >= 20
    )
      return;
    const timeout = setTimeout(() => {
      polls.current += 1;
      void refresh(data.id);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [data, refresh]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    createKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/product-conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          audience,
          clientKey: createKey.current,
        }),
      });
      const value = await response.json();
      if (!response.ok)
        throw Error(value.error?.message || "요청을 접수하지 못했습니다.");
      const receipt = z.strictObject({ id: z.uuid() }).safeParse(value);
      if (!receipt.success)
        throw Error(
          "접수 결과를 확인하지 못했습니다. 같은 입력으로 다시 시도해주세요.",
        );
      polls.current = 0;
      setSelected([]);
      decisionKey.current = null;
      await refresh(receipt.data.id);
    } catch (e) {
      setError(
        e instanceof Error && !(e instanceof TypeError)
          ? e.message
          : "전송 결과를 확인하지 못했습니다. 같은 입력으로 다시 시도해주세요.",
      );
    } finally {
      setPending(false);
    }
  }
  function toggle(index: number) {
    const kind = data?.output?.suggestions[index].kind;
    setSelected((old) =>
      old.includes(index)
        ? old.filter((v) => v !== index)
        : [
            ...old.filter(
              (v) =>
                kind === "vibe" || data?.output?.suggestions[v].kind !== kind,
            ),
            index,
          ].sort((a, b) => a - b),
    );
    decisionKey.current = null;
  }
  async function decide(action: "confirm" | "dismiss") {
    if (!data) return;
    setPending(true);
    setError("");
    decisionKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/product-conditions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: data.id,
          clientKey: decisionKey.current,
          expectedVersion: data.revision,
          action,
          selected: action === "confirm" ? selected : [],
        }),
      });
      setData(await decode(response));
    } catch {
      setError(
        "처리 결과를 확인하지 못했습니다. 상태를 다시 불러오거나 같은 선택으로 재시도해주세요.",
      );
    } finally {
      setPending(false);
    }
  }
  const confirmed = data?.status === "done" && data.decision === "confirmed";
  return (
    <div>
      <h2>{productName}</h2>
      <form className="panel" onSubmit={create}>
        <label className="field">
          직접 입력한 타깃 고객
          <input
            value={audience}
            required
            minLength={2}
            maxLength={160}
            disabled={pending}
            onChange={(e) => {
              setAudience(e.target.value);
              createKey.current = null;
            }}
            placeholder="예: 요리를 즐기는 성인 고객"
          />
        </label>
        <p>
          조건 추출 요청은 본인 상품만 사용하며, 제안된 내용을 자동으로 검색에
          적용하지 않습니다.
        </p>
        <button
          className="button primary"
          disabled={pending || !audience.trim() || data !== null}
        >
          {pending ? "처리 중…" : "상품 조건 추출 요청"}
        </button>
        {data && (
          <button
            type="button"
            className="button outline"
            disabled={pending}
            onClick={() => {
              createKey.current = null;
              setData(null);
              setSelected([]);
              decisionKey.current = null;
            }}
          >
            새 입력으로 다시 준비
          </button>
        )}
      </form>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {data && (
        <div className="panel" style={{ marginTop: 24 }}>
          <p role="status">
            {
              {
                queued: "조건 추출 대기 중",
                running: "조건 추출 중",
                done: "검토할 조건이 준비됐습니다.",
                failed:
                  "조건 추출을 마치지 못했습니다. 수동 추천을 이용하거나 새 요청을 준비해주세요.",
                stale:
                  "상품·정책이 변경되었습니다. 이전 조건을 적용할 수 없습니다.",
                disabled:
                  "조건 추출을 준비 중입니다. 수동 추천을 이용해주세요.",
              }[data.status]
            }
          </p>
          <button
            className="button outline small"
            type="button"
            disabled={pending}
            onClick={() => {
              polls.current = 0;
              void refresh(data.id);
            }}
          >
            현재 상태 다시 불러오기
          </button>
          {data.status === "done" &&
            data.output &&
            data.decision === "pending" && (
              <>
                <h3>근거를 확인하고 적용할 조건을 직접 선택하세요</h3>
                <p>
                  분야와 형식은 각각 하나만 선택할 수 있습니다. 예산은 직접
                  입력합니다.
                </p>
                {!data.output.suggestions.length && (
                  <p>
                    원문에서 확인할 조건이 없습니다. 수동 추천을 이용해주세요.
                  </p>
                )}
                {data.output.suggestions.map((row, index) => (
                  <label className="field" key={`${row.kind}:${row.value}`}>
                    <span>
                      <input
                        type="checkbox"
                        checked={selected.includes(index)}
                        disabled={pending}
                        onChange={() => toggle(index)}
                      />{" "}
                      {labels[row.kind]} · {row.value}
                    </span>
                    <span>원문 근거: {row.quote}</span>
                  </label>
                ))}
                <button
                  className="button primary"
                  type="button"
                  disabled={pending || !selected.length}
                  onClick={() => void decide("confirm")}
                >
                  선택한 조건 확인·추천 폼에 반영
                </button>{" "}
                <button
                  className="button outline"
                  type="button"
                  disabled={pending}
                  onClick={() => void decide("dismiss")}
                >
                  이 제안 사용 안 함
                </button>
              </>
            )}
          {data.decision === "dismissed" && (
            <p>이 제안은 사용하지 않기로 했습니다. 추천에 적용하지 않습니다.</p>
          )}
        </div>
      )}
      {confirmed && (
        <div style={{ marginTop: 24 }}>
          <h2>확인한 조건으로 추천 준비</h2>
          <p>
            예산과 조건을 확인한 뒤 직접 검색을 실행하세요. 조건을 수정하면 수동
            입력으로 전환합니다.
          </p>
          <RecommendationBrief
            key={`${data.id}:${data.revision}`}
            initial={{
              product: data.source.name,
              audience: data.source.audience,
              category:
                data.selected.find((row) => row.kind === "category")?.value ??
                "",
              format:
                data.selected.find((row) => row.kind === "format")?.value ?? "",
              preference: data.selected
                .filter((row) => row.kind === "vibe")
                .map((row) => row.value)
                .join(", "),
            }}
            condition={{
              id: data.id,
              revision: data.revision,
              sourceVersion: data.sourceVersion,
            }}
          />
        </div>
      )}
      <p style={{ marginTop: 24 }}>
        <Link className="button outline" href="/#recommendation">
          수동으로 유튜버 추천 조건 입력
        </Link>
      </p>
    </div>
  );
}

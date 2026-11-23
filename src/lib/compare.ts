// D040: one definition of the comparison rows, used by the page and the CSV.
// Each cell is a value or an explicit gap; the source/basis and freshness rows are separate from the values,
// and private notes are never part of these rows (they render only on the owner's own view).
import type { Creator } from "./catalog";
import { provenance, toCsv } from "./csv";
export type Cell = { text: string; missing?: boolean };
const gap = (text: string): Cell => ({ text, missing: true });
const list = (xs: string[]): Cell =>
  xs.length ? { text: xs.join(", ") } : gap("미입력");
export const COMPARE_ROWS: [string, (c: Creator) => Cell][] = [
  ["콘텐츠 분야", (c) => list(c.categories)],
  ["분위기", (c) => list(c.vibes)],
  ["플랫폼", (c) => list(c.platforms)],
  ["광고 형식", (c) => list(c.formats)],
  [
    "팔로워",
    (c) =>
      c.is_demo
        ? { text: `${c.followers.toLocaleString()} (가상)` }
        : gap("미확보"),
  ],
  [
    "최소 견적",
    (c) =>
      c.price_min_krw === null
        ? gap("견적 미확인")
        : { text: `${c.price_min_krw.toLocaleString()}원` },
  ],
  [
    "협업 가능",
    (c) =>
      c.is_available === null
        ? gap("협업 의사 미확인")
        : { text: c.is_available ? "가능" : "일정 확인 필요" },
  ],
  ["오디언스", () => gap("데이터 미확보")],
  [
    "출처·근거",
    (c) => {
      const p = provenance(c, c.owner_id);
      return { text: `${p.label} — ${p.basis}` };
    },
  ],
  [
    "기준 시점",
    (c) => {
      const at = (c as Creator & { verified_at?: string }).verified_at;
      return at
        ? { text: at.slice(0, 10) }
        : gap(
            c.is_demo ? "가상 데이터(시점 없음)" : "외부 검증 전(시점 미확인)",
          );
    },
  ],
];
export const parseIds = (s: string | null | undefined) =>
  [
    ...new Set(
      (s ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter((x) => /^[A-Za-z0-9_-]{1,80}$/.test(x)),
    ),
  ].slice(0, 3);
export function compareCsv(people: Creator[]) {
  return toCsv([
    ["비교 항목", ...people.map((c) => c.name)],
    ["ID", ...people.map((c) => c.seed_id)],
    ...COMPARE_ROWS.map(([label, fn]) => [
      label,
      ...people.map((c) => {
        const v = fn(c);
        return v.missing ? `[결측] ${v.text}` : v.text;
      }),
    ]),
  ]);
}

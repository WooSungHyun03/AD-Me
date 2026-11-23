import { emptyCreatorFilters, type CreatorFilters } from "./creator-filters";
import { creatorFilterSchema } from "./filtered-catalog";

const platforms = {
  인스타그램: "instagram",
  유튜브: "youtube",
  틱톡: "tiktok",
} as const;
const categories = [
  "뷰티",
  "패션",
  "푸드",
  "리빙",
  "여행",
  "운동",
  "테크",
  "교육",
];
export type SearchProposal = {
  version: 1;
  mode: "deterministic";
  filters: CreatorFilters;
  evidence: string[];
  warnings: string[];
  unparsed: string;
};

// Deliberately limited grammar. Unrecognized/ambiguous words are shown for review, never guessed.
export function proposeSearch(text: string): SearchProposal {
  if (!text.trim() || text.length > 500 || /[\u0000-\u001f\u007f]/.test(text))
    throw Error("검색 문장을 1~500자로 입력해주세요.");
  let remainder = text;
  const filters = emptyCreatorFilters(),
    evidence: string[] = [],
    warnings: string[] = [];
  for (const [label, value] of Object.entries(platforms)) {
    if (remainder.includes(label)) {
      filters.platforms.push(value);
      evidence.push(`${label} → 플랫폼`);
      remainder = remainder.replaceAll(label, " ");
    }
  }
  for (const category of categories) {
    if (remainder.includes(category)) {
      filters.categories.push(category);
      evidence.push(`${category} → 분야`);
      remainder = remainder.replaceAll(category, " ");
    }
  }
  const bounds: Partial<Record<keyof CreatorFilters, string>> = {};
  remainder = remainder.replace(
    /(팔로워|예산)\s*([0-9]+(?:\.[0-9]+)?)\s*(만|천)?\s*(명|원)\s*(이상|이하)/g,
    (
      match,
      subject: string,
      raw: string,
      multiplier: string | undefined,
      unit: string,
      op: string,
    ) => {
      const correctUnit = subject === "팔로워" ? "명" : "원";
      const value =
        Number(raw) *
        (multiplier === "만" ? 10000 : multiplier === "천" ? 1000 : 1);
      const key =
        `${op === "이상" ? "min" : "max"}${subject === "팔로워" ? "Followers" : "Price"}` as keyof CreatorFilters;
      if (
        unit !== correctUnit ||
        !Number.isSafeInteger(value) ||
        value < 0 ||
        bounds[key] !== undefined
      ) {
        warnings.push(`중복되거나 단위가 불명확한 조건: ${match}`);
        return match;
      }
      bounds[key] = String(value);
      evidence.push(match);
      return " ";
    },
  );
  Object.assign(filters, bounds);
  const parsed = creatorFilterSchema.safeParse(filters);
  if (!parsed.success || warnings.length > 0) {
    warnings.push("숫자 범위가 유효하지 않아 숫자 조건을 제외했습니다.");
    for (let i = evidence.length - 1; i >= 0; i--)
      if (/^(팔로워|예산)/.test(evidence[i])) evidence.splice(i, 1);
    filters.minFollowers =
      filters.maxFollowers =
      filters.minPrice =
      filters.maxPrice =
        "";
  }
  remainder = remainder.replace(/[ ,·]+/g, " ").trim();
  if (remainder)
    warnings.push(
      "남은 문구는 필터로 적용되지 않습니다. 나이·성별·모호한 단위 등은 직접 확인해주세요.",
    );
  return {
    version: 1,
    mode: "deterministic",
    filters: creatorFilterSchema.parse(filters),
    evidence,
    warnings,
    unparsed: remainder,
  };
}

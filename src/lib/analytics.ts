// D006 product-event contract. The database (migration 20261123100017) is the only writer; this file is the
// shared definition for docs, the admin funnel and tests. Nothing here is sent from the browser.
export const FUNNEL = [
  "signup",
  "explore",
  "shortlist",
  "proposal",
  "accept",
] as const;
export type FunnelEvent = (typeof FUNNEL)[number];

export const EVENTS: Record<
  FunnelEvent,
  { label: string; when: string; dedupe: string }
> = {
  signup: { label: "가입", when: "profiles 생성 시", dedupe: "주체당 1회" },
  explore: {
    label: "탐색",
    when: "로그인 상태로 크리에이터 탐색 페이지 열람",
    dedupe: "주체당 하루(KST) 1회",
  },
  shortlist: {
    label: "후보 저장",
    when: "후보 목록에 크리에이터 추가",
    dedupe: "주체·크리에이터 쌍당 1회",
  },
  proposal: {
    label: "제안",
    when: "제안/지원 생성(시작한 쪽 기준)",
    dedupe: "제안당 1회",
  },
  accept: {
    label: "수락",
    when: "상대가 수락(pending→accepted)",
    dedupe: "제안당 1회",
  },
};
export const EVENT_RETENTION_DAYS = 400;
// Stored per event: event, occurred_at, subject ('p:' + HMAC of user id, salt server-only), role, dedupe_key.
export const NEVER_COLLECTED = [
  "이메일",
  "사용자 ID 원문",
  "메시지·제안서 원문",
  "검색어",
  "상대 크리에이터 ID",
];

/** Step-to-step conversion (distinct subjects); null when the previous step is 0. */
export function conversion(counts: Partial<Record<FunnelEvent, number>>) {
  return FUNNEL.map((e, i) => {
    const n = counts[e] ?? 0;
    const prev = i ? (counts[FUNNEL[i - 1]] ?? 0) : null;
    return {
      event: e,
      label: EVENTS[e].label,
      n,
      rate: prev ? Math.round((n / prev) * 1000) / 10 : null,
    };
  });
}

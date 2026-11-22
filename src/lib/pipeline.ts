// D056: one stage definition for the dashboard list, its counts and the CSV, so they can never disagree.
// "Results" are only facts recorded in the app (status-change dates, deliverables submitted) — no estimated
// reach, conversion or revenue.
import { toCsv } from "./csv";
export const STATUS_LABEL: Record<string, string> = {
  pending: "응답 대기",
  accepted: "협업 진행",
  rejected: "거절",
  cancelled: "취소됨",
  submitted: "검토 대기",
  revision_requested: "수정 요청",
  completed: "완료",
};
export const STAGES = {
  active: { label: "활성 제안", statuses: ["pending"] },
  progress: { label: "진행 중", statuses: ["accepted", "revision_requested"] },
  review: { label: "검토 대기", statuses: ["submitted"] },
  completed: { label: "완료", statuses: ["completed"] },
  closed: { label: "종료(거절·취소)", statuses: ["rejected", "cancelled"] },
} as const;
export type Stage = keyof typeof STAGES;
export const isStage = (s: unknown): s is Stage =>
  typeof s === "string" && s in STAGES;
export const stageOf = (status: string) =>
  (Object.keys(STAGES) as Stage[]).find((k) =>
    (STAGES[k].statuses as readonly string[]).includes(status),
  );

type P = {
  id: string;
  status: string;
  kind: string;
  brand_id: string;
  campaign_id: string;
  created_at: string;
};
export const inStage = <T extends P>(rows: T[], stage?: Stage) =>
  stage ? rows.filter((p) => stageOf(p.status) === stage) : rows;
export function summarize(rows: P[]) {
  return Object.fromEntries(
    (Object.keys(STAGES) as Stage[]).map((k) => [k, inStage(rows, k).length]),
  ) as Record<Stage, number>;
}

const day = (t?: string) =>
  t ? new Date(t).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) : "";
export function pipelineCsv(
  rows: P[],
  uid: string,
  titles: Map<string, string>,
  events: { proposal_id: string; to_status: string; created_at: string }[],
  deliverables: Map<string, number>,
) {
  // First time each status was reached (from the recorded event log).
  const first = (id: string, s: string) =>
    events.find((e) => e.proposal_id === id && e.to_status === s)?.created_at;
  return toCsv([
    [
      "제안 ID",
      "구분",
      "내 역할",
      "캠페인",
      "단계",
      "상태",
      "요청일",
      "수락일",
      "첫 제출일",
      "완료일",
      "제출 결과물 수",
    ],
    ...rows.map((p) => [
      p.id,
      p.kind === "application" ? "지원" : "제안",
      p.brand_id === uid ? "브랜드" : "크리에이터",
      titles.get(p.campaign_id) ?? p.campaign_id,
      STAGES[stageOf(p.status) ?? "closed"].label,
      STATUS_LABEL[p.status] ?? p.status,
      day(p.created_at),
      day(first(p.id, "accepted")),
      day(first(p.id, "submitted")),
      day(first(p.id, "completed")),
      deliverables.get(p.id) ?? 0,
    ]),
  ]);
}

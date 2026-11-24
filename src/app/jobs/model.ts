import { z } from "zod";
import { campaignBriefTermsStorageSchema } from "@/lib/campaign-brief";

export const jobsSchema = z.array(
  z.object({
    id: z.uuid(),
    brief: z.object({
      title: z.string(),
      product: z.string(),
      category: z.string(),
      format: z.string(),
      budget_krw: z.number(),
      goal: z.string(),
      target_audience: z.string(),
      terms: campaignBriefTermsStorageSchema.optional(),
    }),
    status: z.enum(["draft", "published", "closed"]),
    expires_at: z.string().nullable(),
    owned: z.boolean(),
    applied: z.boolean(),
    recruit_until: z.string().nullable().optional(),
    accepting: z.boolean().optional(),
    capacity: z.number().int().nullable().optional(),
    selected_count: z.number().int().optional(),
  }),
);

type RecruitmentRow = {
  status: string;
  expires_at: string | null;
  recruit_until?: string | null;
  accepting?: boolean;
  brief: { terms?: { recruitment: { start: string; end: string } } };
};
export function jobDeadline(row: RecruitmentRow) {
  const dates = [
    row.expires_at,
    row.recruit_until,
    row.brief.terms?.recruitment.end,
  ].filter((d): d is string => typeof d === "string");
  return dates.sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
}
export function jobAccepting(row: RecruitmentRow, now = Date.now()) {
  const dates = [
    row.expires_at,
    row.recruit_until,
    row.brief.terms?.recruitment.end,
  ].filter((d): d is string => d != null);
  const start = row.brief.terms?.recruitment.start;
  return (
    row.status === "published" &&
    row.expires_at !== null &&
    row.accepting !== false &&
    dates.every((d) => Number.isFinite(Date.parse(d)) && Date.parse(d) > now) &&
    (start === undefined || Date.parse(start) <= now)
  );
}
export function jobScheduled(row: RecruitmentRow, now = Date.now()) {
  const start = row.brief.terms?.recruitment.start;
  return (
    row.status === "published" && start !== undefined && Date.parse(start) > now
  );
}

export function jobExpiry(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
  }).format(new Date(value));
}

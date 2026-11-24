import { expect, it } from "vitest";
import { jobAccepting, jobDeadline } from "@/app/jobs/model";
const now = Date.parse("2026-11-24T12:00:00Z");
const row = {
  status: "published" as const,
  expires_at: "2026-12-24T12:00:00Z",
  brief: {},
};
it("respects server closure/full flag even while publication is still active", () => {
  expect(jobAccepting({ ...row, accepting: false }, now)).toBe(false);
});
it("uses half-open structured recruitment windows and the earliest legacy deadline", () => {
  const scheduled = {
    ...row,
    brief: {
      terms: {
        recruitment: {
          start: "2026-11-24T12:00:00Z",
          end: "2026-11-25T12:00:00Z",
        },
      },
    },
  };
  expect(jobAccepting(scheduled, now - 1)).toBe(false);
  expect(jobAccepting(scheduled, now)).toBe(true);
  expect(
    jobAccepting(scheduled, Date.parse(scheduled.brief.terms.recruitment.end)),
  ).toBe(false);
  expect(
    jobDeadline({ ...scheduled, recruit_until: "2026-11-24T13:00:00Z" }),
  ).toBe("2026-11-24T13:00:00Z");
});
it("preserves legacy campaigns and rejects expired/draft/closed or malformed deadlines", () => {
  expect(jobAccepting(row, now)).toBe(true);
  expect(jobAccepting({ ...row, expires_at: null }, now)).toBe(false);
  expect(jobAccepting({ ...row, status: "draft" }, now)).toBe(false);
  expect(jobAccepting({ ...row, status: "closed" }, now)).toBe(false);
  expect(
    jobAccepting({ ...row, expires_at: new Date(now).toISOString() }, now),
  ).toBe(false);
  expect(jobAccepting({ ...row, expires_at: "invalid" }, now)).toBe(false);
});

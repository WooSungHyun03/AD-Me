import { expect, it } from "vitest";
import { campaignCalendar } from "@/lib/campaign-calendar";
import { campaignBriefTermsSchema } from "@/lib/campaign-brief";
const terms = campaignBriefTermsSchema.parse({
  version: 2,
  recruitment: { start: "2027-01-01T00:00", end: "2027-01-02T00:00" },
  production: { start: "2027-01-02T00:00", end: "2027-01-03T00:00" },
  posting: { start: "2027-01-03T00:00", end: "2027-01-04T00:00" },
  compensation: { mode: "unknown" },
  deliverables: [
    { format: "숏폼", quantity: 1, usageRights: "소개", exclusivity: null },
  ],
});
const input = {
  id: "ad000000-0000-4000-8000-000000000301",
  title: "가".repeat(80) + "\r\nATTENDEE:secret;a,b",
  terms,
};
it("exports KST midnight as previous UTC day with stable private UIDs and no injected properties", () => {
  const output = campaignCalendar(input);
  expect(output).toContain("DTSTART:20261231T150000Z");
  expect(output.match(/BEGIN:VEVENT/g)).toHaveLength(3);
  expect(output).not.toContain("\r\nATTENDEE:");
  expect(output).toContain("\\;a\\,b");
  for (const line of output.split("\r\n"))
    expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  expect(output.match(/UID:.*/g)).toEqual(
    campaignCalendar(input).match(/UID:.*/g),
  );
});
it("rejects incomplete schedules and invalid IDs rather than guessing dates", () => {
  expect(() => campaignCalendar({ ...input, terms: undefined })).toThrow();
  expect(() => campaignCalendar({ ...input, id: "foreign\n" })).toThrow();
});

import { z } from "zod";
import { campaignBriefTermsStorageSchema } from "./campaign-brief";
const escapeText = (v: string) =>
  v
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
// RFC5545 physical lines are at most75 UTF-8 octets (including continuation space).
export function foldCalendarLine(value: string) {
  let line = "",
    bytes = 0;
  const lines: string[] = [];
  for (const point of value) {
    const length = new TextEncoder().encode(point).length;
    if (bytes + length > 75) {
      lines.push(line);
      line = " ";
      bytes = 1;
    }
    line += point;
    bytes += length;
  }
  lines.push(line);
  return lines.join("\r\n");
}
const stamp = (value: string) =>
  new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
export function campaignCalendar(
  input: { id: string; title: string; terms: unknown },
  now = new Date(),
) {
  const id = z.uuid().parse(input.id),
    title = z.string().min(1).max(120).parse(input.title),
    terms = campaignBriefTermsStorageSchema.parse(input.terms);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AD Me//Campaign Calendar//KO",
    "CALSCALE:GREGORIAN",
  ];
  for (const [key, label] of [
    ["recruitment", "모집"],
    ["production", "제작"],
    ["posting", "게시"],
  ] as const) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${id}-${key}@ad-me.local`,
      `DTSTAMP:${stamp(now.toISOString())}`,
      `DTSTART:${stamp(terms[key].start)}`,
      `DTEND:${stamp(terms[key].end)}`,
      `SUMMARY:${escapeText(title)} · ${label}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldCalendarLine).join("\r\n") + "\r\n";
}

import { describe, expect, it } from "vitest";
import {
  IMPORT_LIMITS,
  parseCsv,
  provenance,
  readImport,
  toCsv,
} from "@/lib/csv";

const rowsOf = (text: string) => {
  const r = readImport(text);
  if ("error" in r) throw new Error(r.error);
  return r.rows;
};

describe("CSV export/parse (D038)", () => {
  it("round-trips Korean, quotes, commas and newlines; formulas are neutralised on export", () => {
    const data = [
      ["ID", "이름"],
      ["a-1", '한글 "따옴표", 쉼표\n줄바꿈'],
      ["b", '=HYPERLINK("https://evil")'],
    ];
    const back = parseCsv(toCsv(data));
    expect(back[1]).toEqual(data[1]);
    expect(back[2][1]).toBe('\'=HYPERLINK("https://evil")');
    for (const lead of ["=", "+", "-", "@", "\t"])
      expect(toCsv([[lead + "1"]])).toContain(`"'${lead}1"`);
  });
  it("rejects an unterminated quote and handles CRLF/BOM", () => {
    expect(() => parseCsv('a,"b')).toThrow();
    expect(parseCsv("﻿ID,출처\r\nx,DEMO\r\n")).toEqual([
      ["ID", "출처"],
      ["x", "DEMO"],
    ]);
  });
});

describe("import validation (D038)", () => {
  it("file-level limits: bytes, rows, header, encoding", () => {
    expect(
      readImport("ID,출처\n" + "x".repeat(IMPORT_LIMITS.bytes)),
    ).toHaveProperty("error");
    const many =
      "ID,출처\n" +
      Array.from(
        { length: IMPORT_LIMITS.rows + 1 },
        (_, i) => `c${i},DEMO`,
      ).join("\n");
    expect(readImport(many)).toHaveProperty("error");
    expect(readImport("이름,출처\n서하린,DEMO")).toHaveProperty("error");
    expect(readImport("ID,출처\n��,DEMO")).toHaveProperty("error"); // EUC-KR read as UTF-8
  });
  it("per-row errors: URL not fetched, formula, missing source, duplicate; valid rows stay", () => {
    const rows = rowsOf(
      [
        "이름,ID,출처",
        "ok,creator-001,DEMO",
        "url,https://instagram.com/someone,DEMO",
        'formula,"=HYPERLINK(""x"")",DEMO',
        "nosrc,creator-002,",
        "dup,creator-001,DEMO",
        "empty,,DEMO",
      ].join("\n"),
    );
    expect(rows.map((r) => [r.line, r.error ? "err" : "ok"])).toEqual([
      [2, "ok"],
      [3, "err"],
      [4, "err"],
      [5, "err"],
      [6, "err"],
      [7, "err"],
    ]);
    expect(rows[1].error).toMatch(/수집하지 않음/);
    expect(rows[2].error).toMatch(/형식/);
    expect(rows[4].error).toMatch(/중복/);
  });
  it("provenance labels match what export writes", () => {
    expect(provenance({ is_demo: true }, null).label).toBe("DEMO");
    expect(provenance({ is_demo: false }, "u").label).toBe("본인 등록");
    expect(
      provenance({ is_demo: false, data_source: "youtube_data_api" }, null)
        .label,
    ).toBe("미인증 수집");
  });
});

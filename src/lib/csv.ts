export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function toCsv(rows: unknown[][]) {
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

// D038: RFC 4180 parser (quoted fields, "" escapes, CRLF/LF, UTF-8 BOM). Throws on an unterminated quote.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const s = text.replace(/^\uFEFF/, "");
  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === ",") endCell();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      endCell();
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (quoted) throw new Error("unterminated_quote");
  if (cell !== "" || row.length) {
    endCell();
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Provenance label shared by export and import (import rows must state the same source). */
export function provenance(
  p: { is_demo?: boolean; data_source?: string | null },
  ownerId: string | null,
) {
  if (p.is_demo) return { label: "DEMO", basis: "가상 데이터(실존 인물 아님)" };
  if (ownerId)
    return { label: "본인 등록", basis: "크리에이터 본인 입력·공개 동의" };
  return {
    label: "미인증 수집",
    basis: `공개 출처(${p.data_source ?? "미상"}) · 본인 확인 전`,
  };
}

export const IMPORT_LIMITS = { bytes: 100_000, rows: 500 } as const;
export const IMPORT_HEADER = ["ID", "출처"] as const; // required columns; others (이름 등) are ignored
export type ImportRow = {
  line: number;
  id: string;
  status: "ok" | "exists" | "error";
  message?: string;
};

/** Parse + shape-check (no database). Returns a file-level error or rows with per-row errors. */
export function readImport(
  text: string,
):
  | { error: string }
  | { rows: { line: number; id: string; source: string; error?: string }[] } {
  if (new TextEncoder().encode(text).length > IMPORT_LIMITS.bytes)
    return { error: `파일이 ${IMPORT_LIMITS.bytes / 1000}KB를 넘습니다.` };
  if (text.includes("�"))
    return {
      error: "글자가 깨졌습니다. CSV를 UTF-8로 저장해 다시 올려주세요.",
    };
  let table: string[][];
  try {
    table = parseCsv(text);
  } catch {
    return { error: "따옴표가 닫히지 않은 CSV입니다." };
  }
  const [head, ...body] = table;
  const idx = IMPORT_HEADER.map((h) =>
    (head ?? []).map((x) => x.trim()).indexOf(h),
  );
  if (idx.some((i) => i < 0))
    return {
      error: `첫 줄에 ${IMPORT_HEADER.join(", ")} 열이 있어야 합니다. 템플릿을 내려받아 사용하세요.`,
    };
  if (body.length > IMPORT_LIMITS.rows)
    return { error: `한 번에 ${IMPORT_LIMITS.rows}행까지 가져올 수 있습니다.` };
  const seen = new Set<string>();
  return {
    rows: body.map((r, i) => {
      const id = (r[idx[0]] ?? "").trim(),
        source = (r[idx[1]] ?? "").trim();
      const line = i + 2;
      let error: string | undefined;
      if (!id) error = "ID가 비어 있습니다.";
      else if (/^https?:|^www\./i.test(id))
        error =
          "외부 URL은 가져오지 않습니다(수집하지 않음). AD Me 프로필 ID를 적어주세요.";
      else if (!/^[A-Za-z0-9_-]{1,80}$/.test(id))
        error = "ID 형식이 올바르지 않습니다.";
      else if (!source) error = "출처가 비어 있습니다.";
      else if (seen.has(id)) error = "파일 안에서 중복된 ID입니다.";
      seen.add(id);
      return { line, id: id.slice(0, 80), source, error };
    }),
  };
}

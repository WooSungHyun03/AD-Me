// D079: what is kept, for how long, and how deletions survive a backup restore.
// The SQL job public.run_retention() applies the database periods below; keep the two in sync.
import type { SupabaseClient } from "@supabase/supabase-js";

export type RetentionRule = {
  data: string;
  keep: string;
  then: string;
};
export const RETENTION_RULES: RetentionRule[] = [
  {
    data: "공개 프로필(본인 등록)",
    keep: "본인이 삭제할 때까지",
    then: "즉시 비공개·내용 삭제, 삭제 표시(tombstone) 영구 보관",
  },
  {
    data: "수집 프로필(공개 자료)",
    keep: "삭제 요청 처리 시까지",
    then: "내용 삭제, 재수집 차단 키는 해시로만 보관",
  },
  {
    data: "포트폴리오 파일",
    keep: "본인이 삭제할 때까지",
    then: "즉시 접근 차단, 저장소 원본은 정리 작업에서 1시간 내 제거",
  },
  {
    data: "협업 메시지·제안 내용",
    keep: "종료(거절·취소·완료) 후 3년",
    then: "메시지 삭제, 제안 내용 대체 문구",
  },
  {
    data: "신고·정정·삭제 요청 본문",
    keep: "처리 완료 후 3년",
    then: "본문 삭제, 접수번호·처리일만 유지",
  },
  { data: "알림", keep: "180일", then: "삭제" },
  {
    data: "알림·마케팅 동의 변경 기록(목적·값·고지 버전·시각)",
    keep: "탈퇴할 때까지(동의 증빙)",
    then: "탈퇴 시 삭제",
  },
  {
    data: "이용 통계 이벤트(가명 주체·이벤트명·시각만)",
    keep: "400일, 설정에서 제외 선택 시 즉시",
    then: "삭제",
  },
  { data: "관리 감사 로그(행위·대상 ID만)", keep: "1년", then: "삭제" },
  {
    data: "내 데이터 내보내기 기록",
    keep: "1년 (내려받기 링크는 15분)",
    then: "삭제",
  },
  { data: "연락 제한 기록", keep: "종료 후 1년", then: "삭제" },
  {
    data: "결제·이용권 기록(TEST)",
    keep: "보존 대상(정산 근거)",
    then: "자동 삭제하지 않음",
  },
  {
    data: "데이터베이스 백업",
    keep: "호스팅 백업 보존기간",
    then: "복구 시 삭제 표시를 다시 적용",
  },
];

export const LEDGER_BUCKET = "privacy-ledger";
export const LEDGER_PATH = "tombstones.json";
export type Tombstone = {
  subject_kind: "collected_profile" | "owner_profile" | "upload";
  subject_id: string;
  key_hashes: string[];
  requested_at: string;
};

// The ledger must never carry content: only kinds, ids and hashes.
export function assertLedger(ledger: unknown): asserts ledger is Tombstone[] {
  if (!Array.isArray(ledger)) throw new Error("ledger_invalid");
  for (const t of ledger) {
    const keys = Object.keys(t ?? {})
      .sort()
      .join(",");
    if (keys !== "key_hashes,requested_at,subject_id,subject_kind")
      throw new Error("ledger_invalid");
    if (
      !["collected_profile", "owner_profile", "upload"].includes(t.subject_kind)
    )
      throw new Error("ledger_invalid");
    if (
      typeof t.subject_id !== "string" ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(t.subject_id)
    )
      throw new Error("ledger_invalid");
    if (
      !Array.isArray(t.key_hashes) ||
      t.key_hashes.some(
        (h: unknown) => typeof h !== "string" || !/^h:[0-9a-f]{64}$/.test(h),
      )
    )
      throw new Error("ledger_invalid");
  }
}

// Copy the tombstones out of the database so a restore of an older backup cannot forget a deletion.
// shortcut: the copy lives in the same Supabase project's storage; also keep the downloaded ledger with offsite backups.
export async function snapshotLedger(admin: SupabaseClient) {
  const { data, error } = await admin.rpc("tombstone_ledger");
  if (error) throw new Error("ledger_read_failed");
  assertLedger(data);
  await admin.storage
    .createBucket(LEDGER_BUCKET, { public: false })
    .catch(() => undefined);
  const { error: e } = await admin.storage
    .from(LEDGER_BUCKET)
    .upload(LEDGER_PATH, JSON.stringify(data), {
      upsert: true,
      contentType: "application/json",
    });
  if (e) throw new Error("ledger_write_failed");
  return data.length;
}

// After restoring a backup: merge the stored ledger and re-apply every deletion (safe to retry).
export async function reapplyFromLedger(
  admin: SupabaseClient,
  ledger?: unknown,
) {
  let l = ledger;
  if (l === undefined) {
    const { data, error } = await admin.storage
      .from(LEDGER_BUCKET)
      .download(LEDGER_PATH);
    l = error ? [] : JSON.parse(await data.text());
  }
  assertLedger(l);
  const { data, error } = await admin.rpc("reapply_tombstones", {
    p_ledger: l,
  });
  if (error) throw new Error("reapply_failed");
  return data as Record<string, number>;
}

// Deletion routes call this after success; failure never undoes the deletion (the DB tombstone is already written).
export async function snapshotAfterDeletion(admin: SupabaseClient | null) {
  if (!admin) return;
  await snapshotLedger(admin).catch(() => undefined);
}

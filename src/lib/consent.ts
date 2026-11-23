// D015: notice texts and versions (DB mirror: marketing_notice_version() in migration 20261123100018).
export const MARKETING_VERSION = "marketing-2026-11";
export const PURPOSES = {
  service_email:
    "서비스 알림 메일: 내 제안·지원·메시지에 변화가 있을 때 보내는 메일입니다. 꺼도 사이트 안 알림은 계속 표시됩니다.",
  marketing_email:
    "(선택) 마케팅 메일: 새 기능·이벤트 소식. 동의하지 않아도 모든 기능을 이용할 수 있고 언제든 철회할 수 있습니다. 철회하면 발송 대기 중인 메일도 취소됩니다.",
  interests: "관심 카테고리(최대 5개): 추천과 소식 맞춤에만 쓰입니다.",
} as const;

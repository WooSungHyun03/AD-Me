import Link from "next/link";
import { promotionSlots } from "@/lib/promotions";
// D070: clearly labelled ad slot, rendered apart from organic results. Each render counts one impression.
export async function PromotionSlot() {
  const slots = await promotionSlots(true);
  if (!slots.length) return null;
  const day = (s: string) =>
    new Date(s).toLocaleDateString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "numeric",
      day: "numeric",
    });
  return (
    <aside
      className="panel"
      style={{ marginBottom: 24 }}
      aria-label="광고"
      data-testid="promotion-slot"
    >
      <span className="badge lime">광고 · TEST HOT</span>
      <h3 style={{ marginTop: 15 }}>지금 주목할 크리에이터</h3>
      <p style={{ fontSize: 13 }}>
        크리에이터가 TEST 이용권으로 구매한 별도 광고 영역입니다. 일반 검색·추천
        순위와 점수에는 영향을 주지 않습니다.
      </p>
      <div className="inline">
        {slots.map((s) => (
          <Link
            className="button outline"
            href={`/creators/${s.creator_id}`}
            key={s.creator_id}
            data-slot={s.slot}
          >
            {s.name}
            {s.category ? ` · ${s.category}` : ""} · 광고 ~{day(s.expires_at)} ↗
          </Link>
        ))}
      </div>
    </aside>
  );
}

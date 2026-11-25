import Link from "next/link";
import { campaigns } from "@/lib/catalog";
import { configured, supabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/mode";
export default async function Campaigns() {
  const demo = isDemoMode();
  let records: {
    id: string;
    brief: (typeof campaigns)[number];
    is_demo?: boolean;
    capacity?: number | null;
  }[] = campaigns
    .filter((c) => demo && c.status === "published")
    .map((c) => ({ id: c.seed_id, brief: c, is_demo: true }));
  if (configured()) {
    const db = await supabase();
    let query = db
      .from("campaigns")
      .select("id,brief,is_demo,capacity")
      .eq("status", "published")
      .eq("moderation_status", "allowed");
    if (!demo) query = query.eq("is_demo", false);
    const { data } = await query;
    if (data) records = data;
  }
  return (
    <section className="wrap">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Open opportunities</span>
          <h1 className="page-title">함께 만들 다음 이야기.</h1>
          <p>브랜드의 새로운 캠페인을 만나보세요.</p>
        </div>
        <Link className="button primary" href="/campaigns/new">
          캠페인 만들기 ↗
        </Link>
      </div>
      <h2 className="sr-only">공개 모집 목록</h2>
      {records.map((c) => (
        <Link className="result" key={c.id} href={`/campaigns/${c.id}`}>
          <span>↗</span>
          <div>
            <span className="badge">
              {c.is_demo ? "가상 캠페인 · DEMO" : "공개 모집"}
            </span>
            <h3 style={{ margin: "12px 0 8px" }}>{c.brief.title}</h3>
            <p style={{ margin: 0 }}>
              {c.brief.category} · {c.brief.format} ·{" "}
              {c.brief.vibes.join(" / ")}
            </p>
          </div>
          <div>
            <strong>{(c.brief.budget_krw / 10000).toLocaleString()}만원</strong>
            <p style={{ fontSize: 12 }}>총 예산</p>
            {c.capacity != null && <p>선정 {c.capacity}명</p>}
          </div>
        </Link>
      ))}
      {!records.length && (
        <div className="empty">현재 공개 모집 중인 캠페인이 없습니다.</div>
      )}
    </section>
  );
}

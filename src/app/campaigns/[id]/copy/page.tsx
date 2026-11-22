import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { currentUser, supabase } from "@/lib/supabase";
import { copyCampaignBrief } from "@/lib/campaign-copy";
import { CampaignForm } from "@/components/campaign-form";

export default async function CopyCampaign({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await supabase();
  const [{ data: profile }, { data: source, error }] = await Promise.all([
    db.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    db.from("campaigns").select("brief,owner_id,is_demo").eq("id", id).eq("owner_id", user.id).maybeSingle(),
  ]);
  if (error || !source || profile?.role !== "brand" || source.is_demo) notFound();
  const initial = copyCampaignBrief({ ownerId: source.owner_id, isDemo: source.is_demo, brief: source.brief }, user.id);
  return <section className="wrap">
    <span className="eyebrow">Copy a brief</span>
    <h1 className="page-title">새 캠페인 초안으로 복제</h1>
    <p className="notice">브리프 조건만 복사했습니다. 참여자·메시지·메모·첨부 파일은 복사하지 않습니다. 일정과 사용 범위를 다시 확인하고 저장해주세요. 저장 전에는 새 캠페인이 생성되지 않습니다.</p>
    <CampaignForm initial={initial} />
  </section>;
}

import { notFound, redirect } from "next/navigation";
import { currentUser, supabase } from "@/lib/supabase";
import { CampaignForm } from "@/components/campaign-form";
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const db = await supabase();
  const { data } = await db
    .from("campaigns")
    .select("id,brief,status")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();
  if (!data) notFound();
  return (
    <section className="wrap">
      <span className="eyebrow">Refine your brief</span>
      <h1 className="page-title">다음 협업을 더 구체적으로.</h1>
      <p>공개 상태와 브리프를 변경할 수 있습니다. 제안 이력은 유지됩니다.</p>
      <CampaignForm id={id} initial={{ ...data.brief, status: data.status }} />
    </section>
  );
}

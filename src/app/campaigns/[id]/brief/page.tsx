import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { context } from "@/lib/api";
import { briefFilesPage } from "@/lib/campaign-brief-files";
import { CampaignBriefFiles } from "@/components/campaign-brief-files";
import { z } from "zod";
export default async function BriefFiles({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const c = await context();
  if (!c) redirect("/login");
  if (c.role !== "brand") notFound();
  const parsedId = z.uuid().safeParse((await params).id);
  if (!parsedId.success) notFound();
  const result = await c.db.rpc("campaign_brief_page", {
    p_campaign: parsedId.data,
  });
  if (result.error?.code === "P0002") notFound();
  const page = briefFilesPage.safeParse(result.data);
  return (
    <section className="wrap" style={{ maxWidth: 880 }}>
      <Link href={`/campaigns/${parsedId.data}`}>← 캠페인으로</Link>
      <h1 className="page-title">브리프 첨부와 버전</h1>
      {!result.error && page.success ? (
        <CampaignBriefFiles campaignId={parsedId.data} initial={page.data} />
      ) : (
        <p className="notice" role="alert">
          첨부 이력을 불러오지 못했습니다. 잠시 후 다시 확인해주세요.
        </p>
      )}
    </section>
  );
}

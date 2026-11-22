import { CampaignForm } from "@/components/campaign-form";
export default async function NewCampaign({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string | string[] }>;
}) {
  const { creator } = await searchParams;
  const creatorId =
    typeof creator === "string" && /^user-[a-f0-9-]{36}$/.test(creator)
      ? creator
      : undefined;
  return (
    <section className="wrap">
      <span className="eyebrow">Start a collaboration</span>
      <h1 className="page-title">어떤 이야기를 전하고 싶나요?</h1>
      <p>
        브리프를 구체적으로 작성할수록 추천의 이유가 명확해집니다. 저장에는
        브랜드 로그인이 필요합니다.
      </p>
      <CampaignForm creatorId={creatorId} />
    </section>
  );
}

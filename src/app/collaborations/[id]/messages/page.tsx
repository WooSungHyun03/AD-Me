import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Conversation } from "@/components/conversation";
import { ChatSafety, LiveMessages } from "@/components/live-chat";
import { context } from "@/lib/api";

export default async function Messages({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const session = await context();
  if (!session) redirect("/login");

  const { data: proposal, error } = await session.db
    .from("proposals")
    .select("id,campaign_id,creator_id,brand_id,creator_user_id,kind,status")
    .eq("id", id.data)
    .maybeSingle();
  if (error) throw new Error("Could not load the collaboration room");
  if (
    !proposal ||
    (proposal.brand_id !== session.user.id &&
      proposal.creator_user_id !== session.user.id)
  ) {
    notFound();
  }

  const [campaign, latest, related] = await Promise.all([
    session.db
      .from("campaigns")
      .select("brief")
      .eq("id", proposal.campaign_id)
      .maybeSingle(),
    session.db
      .from("messages")
      .select("id")
      .eq("proposal_id", proposal.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    session.db
      .from("proposals")
      .select("id,kind,created_at")
      .or(`brand_id.eq.${session.user.id},creator_user_id.eq.${session.user.id}`)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  const campaignTitle = campaign.data?.brief?.title ?? "캠페인";
  const sendable = proposal.status !== "rejected";
  return (
    <section className="figma-width figma-room">
      <LiveMessages />
      <div className="section-heading">
        <div>
          <p className="figma-eyebrow">워크스페이스 · 메시지</p>
          <h1 className="page-title">좋은 협업은, 좋은 대화에서.</h1>
        </div>
        <Link className="button outline" href="/dashboard#workspace-collaboration">
          대시보드로
        </Link>
      </div>
      <div className="figma-room-layout">
        <nav className="figma-workspace-panel figma-room-list" aria-label="대화 목록">
          <h2>메시지</h2>
          <ul>
            <li>
              <Link href={`/collaborations/${proposal.id}/messages`} aria-current="page">
                {campaignTitle}
              </Link>
            </li>
            {related.data?.filter((row) => row.id !== proposal.id).map((row) => (
              <li key={row.id}>
                <Link href={`/collaborations/${row.id}/messages`}>
                  {row.kind === "application" ? "캠페인 지원" : "브랜드 제안"}
                  <time dateTime={row.created_at}>
                    {new Date(row.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="figma-workspace-panel">
          <h2>{campaignTitle}</h2>
          <Conversation
            proposalId={proposal.id}
            viewerId={session.user.id}
            refreshVersion={latest.data?.id}
            writable={sendable}
            deliverable={false}
            expanded
          />
          <ChatSafety id={proposal.id} />
        </div>
        <aside className="figma-workspace-panel figma-room-campaign">
          <p className="figma-eyebrow">함께하는 캠페인</p>
          <h2>{campaignTitle}</h2>
          <Link href={`/campaigns/${proposal.campaign_id}`}>캠페인 상세 보기</Link>
          <Link href={`/collaborations/${proposal.id}/deliverables`}>결과물 제출·검토</Link>
        </aside>
      </div>
    </section>
  );
}

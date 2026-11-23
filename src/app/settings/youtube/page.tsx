import Link from "next/link";
import { redirect } from "next/navigation";
import { context } from "@/lib/api";
import { ContactForm } from "./contact-form";
import { ClaimForm } from "./claim-form";
import { getConfig } from "@/lib/config";
export const dynamic = "force-dynamic";

type Claim = {
  channel_id: string;
  challenge: string | null;
  verified: boolean;
  consent: boolean;
  review: string | null;
  job: string | null;
};

export default async function YoutubeSettings() {
  const c = await context();
  if (!c) redirect("/login");
  if (c.role !== "creator")
    return (
      <section className="wrap">
        <h1>크리에이터 계정이 필요합니다.</h1>
      </section>
    );
  const [{ data, error }, contacts] = await Promise.all([
    c.db.rpc("ops_own_channels"),
    c.db
      .from("youtube_channel_contacts")
      .select("channel_id,business_email,business_phone,consent"),
  ]);
  const byChannel = new Map(contacts.data?.map((row) => [row.channel_id, row]));
  const claims = (data ?? []) as Claim[];
  const enabled = getConfig().features.ingestion === "enabled";
  return (
    <section className="wrap">
      <Link href="/settings">계정 설정으로 돌아가기</Link>
      <h1 className="page-title">YouTube 채널 연결</h1>
      <p>
        내 채널을 연결하면 채널 소유권을 확인할 수 있습니다. 공개는 본인 동의,
        공개 프로필, 운영 검토를 모두 마친 뒤 적용됩니다.
      </p>
      {error ? (
        <p role="alert">채널 연결 정보를 불러오지 못했습니다.</p>
      ) : (
        <>
          {enabled ? (
            <ClaimForm action="create" label="채널 추가" />
          ) : (
            <p>
              현재 채널 연결과 확인 요청을 제공하지 않습니다. 기존 연결은 해제할
              수 있습니다.
            </p>
          )}
          {claims.map((claim) => (
            <article key={claim.channel_id} className="ops-section">
              <h2>{claim.channel_id}</h2>
              {claim.verified ? (
                <>
                  <p>
                    소유권 확인 완료 ·{" "}
                    {claim.consent ? "검색 공개 동의함" : "검색 공개 동의 대기"}{" "}
                    ·{" "}
                    {claim.review === "accepted"
                      ? "운영 승인"
                      : "운영 승인 대기"}
                  </p>
                  {contacts.error ? (
                    <p role="alert">연락처 설정을 불러오지 못했습니다.</p>
                  ) : (
                    <ContactForm
                      id={claim.channel_id}
                      email={byChannel.get(claim.channel_id)?.business_email}
                      phone={byChannel.get(claim.channel_id)?.business_phone}
                      consent={byChannel.get(claim.channel_id)?.consent}
                    />
                  )}
                  {claim.consent ? (
                    <ClaimForm
                      action="hide"
                      channel={claim.channel_id}
                      label="검색 공개 동의 철회"
                    />
                  ) : enabled ? (
                    <ClaimForm
                      action="publish"
                      channel={claim.channel_id}
                      label="채널 검색 공개에 동의"
                      confirmation="승인 후 AD Me 검색에 채널 제목, 링크, 구독자 수와 연결된 공개 프로필을 표시할까요?"
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <p>
                    채널 설명에 아래 문자열을 추가하고 소유권 확인을
                    요청해주세요. 확인 이후 해당 문자열을 삭제할 수 있습니다.
                  </p>
                  <p>
                    <code>ADME-{claim.challenge}</code>
                  </p>
                  {claim.job && (
                    <p>
                      {claim.job === "done"
                        ? "채널 설명에서 인증 문자열을 확인하지 못했습니다."
                        : claim.job === "failed"
                          ? "채널 조회를 완료하지 못했습니다."
                          : "확인 대기 중입니다. 잠시 후 새로고침해주세요."}
                    </p>
                  )}
                  {enabled && (
                    <ClaimForm
                      action="check"
                      channel={claim.channel_id}
                      label="소유권 확인 요청"
                    />
                  )}
                </>
              )}
              <ClaimForm
                action="unlink"
                channel={claim.channel_id}
                label="채널 연결 해제"
                confirmation="이 계정의 소유권 확인과 공개 동의를 해제할까요?"
              />
            </article>
          ))}
        </>
      )}
    </section>
  );
}

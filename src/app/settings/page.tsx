import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, supabase } from "@/lib/supabase";
import { AccountForm, PreferencesForm } from "@/components/account-form";
import { categories } from "@/lib/catalog";
import { PURPOSES } from "@/lib/consent";
import { EmailForm } from "@/components/account-auth-forms";
import { ProfileForm } from "@/components/profile-form";
import { PrivacyExport } from "@/components/privacy-panel";
import { PortfolioFiles } from "@/components/portfolio-files";
import { UnblockButton } from "@/components/safety";
const actionText: Record<string, string> = {
  created: "내보내기 요청",
  downloaded: "내려받기 완료",
  expired: "만료된 링크 사용 거부",
  reused: "이미 사용한 링크 재사용 거부",
  denied: "접근 거부",
};
export default async function Settings() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/settings");
  const db = await supabase();
  const { data: profile } = await db
    .from("profiles")
    .select(
      "name,role,analytics_opt_out,service_email,marketing_email,marketing_at,interests",
    )
    .eq("id", user.id)
    .single();
  const { data: creator } = await db
    .from("creators")
    .select("profile,published,moderation_locked")
    .eq("owner_id", user.id)
    .maybeSingle();
  const { data: files } = await db
    .from("uploads")
    .select("id,original_name,mime,size_bytes,created_at")
    .order("created_at", { ascending: false });
  const { data: blocks } = await db.rpc("my_blocks");
  const { data: access } = await db
    .from("privacy_access_log")
    .select("id,action,created_at")
    .eq("user_id", user.id)
    .order("id", { ascending: false })
    .limit(10);
  return (
    <section className="wrap">
      <span className="eyebrow">Account settings</span>
      <h1 className="page-title">나를 보여주는 방식.</h1>
      <p>
        {profile?.name} · {profile?.role} · {user.email}
      </p>
      <AccountForm
        name={profile?.name ?? ""}
        optOut={profile?.analytics_opt_out ?? false}
      />
      <EmailForm />
      <PreferencesForm
        serviceEmail={profile?.service_email ?? true}
        marketingEmail={profile?.marketing_email ?? false}
        marketingAt={profile?.marketing_at ?? null}
        interests={profile?.interests ?? []}
        categories={categories}
        purposes={PURPOSES}
      />
      {creator?.moderation_locked && (
        <p className="notice" role="status">
          운영 검토로 비공개 처리된 프로필입니다. 내용 수정은 가능하지만 공개
          전환은 운영자 검토 후 가능합니다.
        </p>
      )}
      {profile?.role === "creator" ? (
        <>
          <p>
            <Link href="/settings/youtube">YouTube 채널 연결</Link>
          </p>
          <ProfileForm
            initial={
              creator
                ? { ...creator.profile, published: creator.published }
                : undefined
            }
          />
          <PortfolioFiles files={files ?? []} />
        </>
      ) : (
        <p className="notice">
          브랜드 계정입니다. 캠페인에서 브랜드의 상품·목표와 협업 조건을
          관리하세요.
        </p>
      )}
      <h2 id="blocks" style={{ marginTop: 55 }}>
        차단한 상대
      </h2>
      {blocks?.length ? (
        <ul style={{ display: "grid", gap: 12 }}>
          {blocks.map((b: { blocked_id: string; name: string }) => (
            <li
              key={b.blocked_id}
              data-testid="blocked-user"
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span>{b.name}</span>
              <UnblockButton userId={b.blocked_id} />
            </li>
          ))}
        </ul>
      ) : (
        <p>차단한 상대가 없습니다. 협업 화면에서 상대를 차단할 수 있습니다.</p>
      )}
      <h2 id="privacy" style={{ marginTop: 55 }}>
        내 개인정보
      </h2>
      <p>
        계정·프로필·캠페인·제안·내가 보낸 메시지·요청·결제 기록을 JSON 파일로
        내려받습니다. 협업 상대방이 작성한 내용과 보안 값은 포함되지 않으며,
        최근 10분 안에 로그인한 경우에만 받을 수 있습니다. 내보내기는 15분 뒤
        만료되고 한 번만 쓸 수 있습니다.
      </p>
      <PrivacyExport />
      <ul style={{ margin: "28px 0", display: "grid", gap: 10 }}>
        <li>정보 수정: 위 계정·프로필 설정에서 바로 고칠 수 있습니다.</li>
        <li>
          <Link href="/reports">내 요청 처리 상태 보기 →</Link>
        </li>
        <li>
          AD Me가 수집한 프로필에 내 정보가 있다면 해당 프로필 화면의
          &ldquo;자료 정정·이슈 신고&rdquo;에서 &ldquo;삭제 요청&rdquo;을
          선택하세요. 처리 기한은 접수 후 10일이며, 삭제된 프로필은 다시
          수집되지 않습니다.
        </li>
      </ul>
      <h3 style={{ marginTop: 36 }}>개인정보 접근 기록</h3>
      {access?.length ? (
        <ul data-testid="privacy-log">
          {access.map((a) => (
            <li key={a.id}>
              {new Date(a.created_at).toLocaleString("ko-KR")} ·{" "}
              {actionText[a.action] ?? a.action}
            </li>
          ))}
        </ul>
      ) : (
        <p>아직 기록이 없습니다.</p>
      )}
    </section>
  );
}

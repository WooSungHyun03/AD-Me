import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, supabase } from "@/lib/supabase";
import { AccountForm, PreferencesForm } from "@/components/account-form";
import { ProfileForm } from "@/components/profile-form";
import { BrandAccountForm } from "@/components/brand-account-form";
import { ConsentSettings } from "@/components/consent-settings";
import { AccountDeletionForm } from "@/components/account-deletion-form";
import { EmailForm } from "@/components/account-auth-forms";
import { PrivacyExport } from "@/components/privacy-panel";
import { getConfig } from "@/lib/config";
import { PortfolioFiles } from "@/components/portfolio-files";
import { UnblockButton } from "@/components/safety";
// D074: privacy access log labels (restored after merge a5f3326).
const actionText: Record<string, string> = {
  created: "내보내기 요청",
  downloaded: "내려받기 완료",
  expired: "만료된 링크 사용 거부",
  reused: "이미 사용한 링크 재사용 거부",
  denied: "접근 거부",
};
import { categories } from "@/lib/catalog";
import { PURPOSES } from "@/lib/consent";
export const dynamic = "force-dynamic";
export default async function Settings() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = await supabase();
  const intake = await db.rpc("deletion_intake_status");
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
  // D027 private files, D062 blocks, D074 access log — all owner-scoped by RLS/RPC.
  const [{ data: files }, { data: blocks }, { data: access }] =
    await Promise.all([
      db
        .from("uploads")
        .select("id,original_name,mime,size_bytes,created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      db.rpc("my_blocks"),
      db
        .from("privacy_access_log")
        .select("id,action,created_at")
        .eq("user_id", user.id)
        .order("id", { ascending: false })
        .limit(10),
    ]);
  const { data: brand, error: brandError } =
    profile?.role === "brand"
      ? await db.rpc("my_brand_account")
      : { data: null, error: null };
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
      ) : profile?.role === "brand" ? (
        brandError ? (
          <p role="alert">
            브랜드 정보를 불러오지 못했습니다. 기존 정보를 보호하기 위해
            새로고침 후 다시 시도해주세요.
          </p>
        ) : (
          <BrandAccountForm
            name={profile.name}
            brandId={brand?.id}
            initial={
              brand
                ? {
                    brandName: brand.brand_name,
                    industry: brand.industry,
                    introduction: brand.introduction,
                    published: brand.published,
                    contactName: brand.contact_name ?? "",
                    contactEmail: brand.contact_email ?? "",
                    contactVisibility:
                      brand.visibility === "collaborators"
                        ? "collaborators"
                        : "private",
                  }
                : undefined
            }
          />
        )
      ) : null}
      <PreferencesForm
        serviceEmail={profile?.service_email ?? true}
        marketingEmail={profile?.marketing_email ?? false}
        marketingAt={profile?.marketing_at ?? null}
        interests={profile?.interests ?? []}
        categories={categories}
        purposes={PURPOSES}
      />
      <ConsentSettings />
      <h2>이메일 변경</h2>
      <p>
        확인 메일의 안내를 완료하기 전까지 기존 이메일로 로그인할 수 있습니다.
      </p>
      {getConfig().features.mail === "enabled" ? (
        <EmailForm />
      ) : (
        <p role="status">이메일 변경 서비스 연결을 준비 중입니다.</p>
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
      <h2 id="privacy">내 데이터</h2>
      <PrivacyExport />
      <h3 style={{ marginTop: 36 }}>개인정보 접근 기록</h3>
      {access?.length ? (
        <ul data-testid="privacy-log">
          {access.map((a) => (
            <li key={a.id}>
              {new Date(a.created_at).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}{" "}
              · {actionText[a.action] ?? a.action}
            </li>
          ))}
        </ul>
      ) : (
        <p>아직 기록이 없습니다.</p>
      )}
      <AccountDeletionForm enabled={!intake.error && intake.data === true} />
    </section>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, supabase } from "@/lib/supabase";
import { AccountForm } from "@/components/account-form";
import { ProfileForm } from "@/components/profile-form";
import { BrandAccountForm } from "@/components/brand-account-form";
import { ConsentSettings } from "@/components/consent-settings";
export const dynamic = "force-dynamic";
export default async function Settings() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = await supabase();
  const { data: profile } = await db
    .from("profiles")
    .select("name,role")
    .eq("id", user.id)
    .single();
  const { data: creator } = await db
    .from("creators")
    .select("profile,published")
    .eq("owner_id", user.id)
    .maybeSingle();
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
      <AccountForm name={profile?.name ?? ""} />
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
      <ConsentSettings />
    </section>
  );
}

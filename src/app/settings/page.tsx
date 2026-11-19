import { redirect } from "next/navigation";
import { currentUser, supabase } from "@/lib/supabase";
import { AccountForm } from "@/components/account-form";
import { ProfileForm } from "@/components/profile-form";
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
  return (
    <section className="wrap">
      <span className="eyebrow">Account settings</span>
      <h1 className="page-title">나를 보여주는 방식.</h1>
      <p>
        {profile?.name} · {profile?.role} · {user.email}
      </p>
      <AccountForm name={profile?.name ?? ""} />
      {profile?.role === "creator" ? (
        <ProfileForm
          initial={
            creator
              ? { ...creator.profile, published: creator.published }
              : undefined
          }
        />
      ) : (
        <p className="notice">
          브랜드 계정입니다. 캠페인에서 브랜드의 상품·목표와 협업 조건을
          관리하세요.
        </p>
      )}
    </section>
  );
}

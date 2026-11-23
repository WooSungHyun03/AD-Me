// Progress is derived from DB rows only, so re-login resumes exactly where the user stopped
// and nothing here feeds authorization (profiles.role alone decides permissions).
export type OnboardingFacts = {
  role: string | undefined;
  name: string | undefined;
  campaigns: number;
  creatorProfile: { published: boolean } | null;
};
export type Step = { label: string; done: boolean; href: string };
export function onboardingSteps(f: OnboardingFacts): Step[] {
  const named = Boolean(f.name && f.name !== "새 사용자");
  const account = {
    label: "계정 표시 이름 설정",
    done: named,
    href: "/settings",
  };
  if (f.role === "brand")
    return [
      account,
      {
        label: "첫 캠페인 브리프 작성",
        done: f.campaigns > 0,
        href: "/campaigns/new",
      },
    ];
  if (f.role === "creator")
    return [
      account,
      {
        label: "크리에이터 프로필 작성",
        done: Boolean(f.creatorProfile),
        href: "/settings",
      },
      {
        label: "프로필 공개",
        done: Boolean(f.creatorProfile?.published),
        href: "/settings",
      },
    ];
  return []; // admin or unknown role: no self-service onboarding
}

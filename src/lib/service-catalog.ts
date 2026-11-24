export const creatorPlatforms = ["instagram", "youtube", "tiktok"] as const;
// Current marketplace scope; legacy records/filters retain their original values.
export const marketplacePlatforms = ["youtube"] as const;

export const platformLabels = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
} satisfies Record<(typeof creatorPlatforms)[number], string>;

export const matchingFactors = {
  tone: { factor: "이미지·분위기", weight: 28 },
  category: { factor: "콘텐츠 분야", weight: 25 },
  audience: { factor: "타깃 고객", weight: 20 },
  budget: { factor: "예산", weight: 15 },
  format: { factor: "광고 형식", weight: 12 },
} as const;

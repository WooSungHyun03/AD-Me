export const publicTopicOptions = {
  "뷰티·패션": ["Fashion"],
  음식: ["Food"],
  "테크·게임": ["Technology", "Video_game"],
  "건강·운동": ["Physical_fitness", "Health", "Sport"],
  라이프스타일: ["Lifestyle_(sociology)", "Hobby", "Tourism"],
  엔터테인먼트: ["Entertainment", "Film", "Music"],
} as const;

export type PublicTopic = keyof typeof publicTopicOptions;

export function publishedTopicMatch(
  topics: readonly string[],
  choice: PublicTopic,
) {
  const accepted: readonly string[] = publicTopicOptions[choice];
  return topics.some((topic) =>
    accepted.includes(topic.split("/").at(-1) ?? ""),
  );
}

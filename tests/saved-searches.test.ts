import { expect, it } from "vitest";
import { savedSearchInput, savedSearchList } from "@/lib/saved-searches";
import { emptyCreatorFilters } from "@/lib/creator-filters";
const input = {
  id: "ad000000-0000-4000-8000-000000000301",
  expected: 0,
  name: "검색",
  filters: emptyCreatorFilters(),
};
it("requires explicit condition version on reads and disallows client ownership or alert injection", () => {
  expect(
    savedSearchInput.safeParse({ ...input, ownerId: "other" }).success,
  ).toBe(false);
  expect(
    savedSearchInput.safeParse({ ...input, notificationsEnabled: true })
      .success,
  ).toBe(false);
  expect(
    savedSearchList.safeParse([{ ...input, filterVersion: 2, revision: 1 }])
      .success,
  ).toBe(false);
});
it("rejects unsupported/corrupt/contradictory filters before DB access", () => {
  for (const filters of [
    { ...input.filters, gender: "female" },
    { ...input.filters, minFollowers: "100", maxFollowers: "5" },
    { ...input.filters, platforms: ["unknown"] },
  ])
    expect(savedSearchInput.safeParse({ ...input, filters }).success).toBe(
      false,
    );
  expect(savedSearchInput.safeParse({ ...input, expected: -1 }).success).toBe(
    false,
  );
  expect(savedSearchInput.parse(input).filters.minPrice).toBe("");
});
it("D037 alert opt-in is a separate strict call and the list reports it", async () => {
  const { savedSearchAlerts } = await import("@/lib/saved-searches");
  const { id } = input;
  expect(
    savedSearchAlerts.safeParse({ id, expected: 1, notify: true }).success,
  ).toBe(true);
  for (const bad of [
    { id, expected: 1, notify: "yes" },
    { id, expected: 1 },
    { id, expected: 1, notify: true, ownerId: "other" },
    { id, expected: 1, notify: true, filters: input.filters },
  ])
    expect(savedSearchAlerts.safeParse(bad).success).toBe(false);
  expect(savedSearchInput.safeParse({ ...input, notify: true }).success).toBe(
    false,
  );
  const row = { ...input, filterVersion: 1, revision: 1 };
  expect(savedSearchList.safeParse([row]).success).toBe(false);
  expect(savedSearchList.safeParse([{ ...row, notify: false }]).success).toBe(
    false,
  );
  const { expected, ...listed } = row;
  void expected;
  expect(
    savedSearchList.safeParse([{ ...listed, notify: false }]).success,
  ).toBe(true);
});
it("D037 alert text states the count and never claims a proposal", async () => {
  const { notificationText } = await import("@/lib/notifications");
  expect(
    notificationText({ kind: "saved_search", status: null, new_count: 3 }),
  ).toBe("저장 검색 조건에 새로 맞는 크리에이터 3명이 있습니다");
  expect(
    notificationText({ kind: "message", status: null, new_count: null }),
  ).toBe("새 메시지가 도착했습니다");
  expect(
    notificationText({
      kind: "deadline",
      status: "posting",
      new_count: null,
      due_at: "2027-03-01T15:00:00.000Z", // KST midnight crosses the date
    }),
  ).toBe("게시 마감이 24시간 안에 다가옵니다 · 3월 2일 00:00 (KST)");
});

import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creators } from "@/lib/catalog";
import { projectPublicCreator } from "@/lib/creator-public-profile";
import {
  readMySavedCreatorCatalog,
  readCreatorProposalChoices,
  readPublicCreatorCatalog,
} from "@/lib/creator-catalog-read";
const first = projectPublicCreator({
  id: creators[0].seed_id,
  published: true,
  profile: creators[0],
})!;
const second = { ...first, seed_id: "creator-002" };
const client = (rpc: ReturnType<typeof vi.fn>) =>
  ({ rpc }) as unknown as Pick<SupabaseClient, "rpc">;
it("reads bounded pages through the allowlisted RPC while preserving IDs and nullable data", async () => {
  const rpc = vi
    .fn()
    .mockResolvedValueOnce({
      data: { version: 1, items: [first], nextCursor: first.seed_id },
      error: null,
    })
    .mockResolvedValueOnce({
      data: { version: 1, items: [second], nextCursor: null },
      error: null,
    });
  expect(await readPublicCreatorCatalog(client(rpc))).toEqual([first, second]);
  expect(rpc).toHaveBeenNthCalledWith(1, "creator_catalog_page", {
    p_after: "",
    p_limit: 100,
  });
  expect(rpc).toHaveBeenNthCalledWith(2, "creator_catalog_page", {
    p_after: first.seed_id,
    p_limit: 100,
  });
});
it("rejects extra private fields, malformed DTO and private DB failures without fallback", async () => {
  for (const response of [
    {
      data: {
        version: 1,
        items: [{ ...first, owner_id: "PRIVATE_OWNER" }],
        nextCursor: null,
      },
      error: null,
    },
    {
      data: {
        version: 1,
        items: [{ ...first, is_demo: false, followers: 10 }],
        nextCursor: null,
      },
      error: null,
    },
    { data: { private: "PRIVATE_PAYLOAD" }, error: null },
    { data: null, error: { message: "PRIVATE_DB_ERROR" } },
  ])
    await expect(
      readPublicCreatorCatalog(client(vi.fn().mockResolvedValue(response))),
    ).rejects.toThrow("크리에이터 목록을 불러오지 못했습니다.");
});
it("rejects repeated/non-progressing/invalid cursors and never loops without a bound", async () => {
  const rpc = vi.fn().mockResolvedValue({
    data: { version: 1, items: [first], nextCursor: first.seed_id },
    error: null,
  });
  await expect(readPublicCreatorCatalog(client(rpc))).rejects.toThrow("순서");
  expect(rpc).toHaveBeenCalledTimes(2);
  await expect(
    readPublicCreatorCatalog(
      client(
        vi.fn().mockResolvedValue({
          data: { version: 1, items: [], nextCursor: "wrong" },
          error: null,
        }),
      ),
    ),
  ).rejects.toThrow("순서");
});
it("reads only own saved public DTOs and retains hidden favorites without exposing their profile", async () => {
  const rpc = vi.fn().mockResolvedValue({
    data: [
      { creator_id: first.seed_id, creator: first },
      { creator_id: "hidden", creator: null },
    ],
    error: null,
  });
  expect(await readMySavedCreatorCatalog(client(rpc))).toHaveLength(2);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("my_saved_creator_catalog");
  rpc.mockResolvedValue({
    data: [{ creator_id: "different", creator: first }],
    error: null,
  });
  await expect(readMySavedCreatorCatalog(client(rpc))).rejects.toThrow("형식");
});
it("omits an unsupported optional provider link without taking down valid public profiles", async () => {
  const row = {
    ...first,
    social_url: "https://www.instagram.com/accounts/",
    source_url: "https://www.instagram.com/accounts/",
  };
  const rpc = vi.fn().mockResolvedValue({
    data: { version: 1, items: [row], nextCursor: null },
    error: null,
  });
  const [result] = await readPublicCreatorCatalog(client(rpc));
  expect(result.seed_id).toBe(first.seed_id);
  expect(result.source_url).toBeNull();
  expect(result).not.toHaveProperty("social_url");
});
it("validates the campaign chooser allowlist before any client props are produced", async () => {
  const rpc = vi
    .fn()
    .mockResolvedValue({
      data: [{ id: "legacy", name: "공개 이름" }],
      error: null,
    });
  expect(await readCreatorProposalChoices(client(rpc), "campaign")).toEqual([
    { id: "legacy", name: "공개 이름" },
  ]);
  rpc.mockResolvedValue({
    data: [{ id: "legacy", name: "공개 이름", owner_id: "PRIVATE" }],
    error: null,
  });
  await expect(
    readCreatorProposalChoices(client(rpc), "campaign"),
  ).rejects.toThrow("제안할 크리에이터");
});

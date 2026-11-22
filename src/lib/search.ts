import { z } from "zod";
import { connection } from "next/server";
import {
  creators,
  categories,
  vibes,
  platforms,
  type Creator,
} from "./catalog";
import { isDemoMode } from "./mode";
import { configured, supabase } from "./supabase";

export const PAGE_MAX = 48;
const num = z.coerce.number().int().min(0).max(10_000_000_000).optional();
const opt = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), s);
// Cursor = base64url JSON {k: sort key, id}; opaque to the client, validated on the way back in.
const cursor = z
  .string()
  .max(400)
  .transform((s, ctx) => {
    try {
      return z
        .object({ k: z.string().max(200), id: z.string().max(100) })
        .parse(JSON.parse(Buffer.from(s, "base64url").toString()));
    } catch {
      ctx.addIssue({ code: "custom", message: "invalid cursor" });
      return z.NEVER;
    }
  });
export const searchSchema = z.object({
  q: opt(z.string().trim().max(80).optional()),
  category: opt(z.enum(categories as [string, ...string[]]).optional()),
  platform: opt(z.enum(platforms).optional()),
  tag: opt(z.enum(vibes as [string, ...string[]]).optional()),
  budget: opt(num),
  available: z.preprocess(
    (v) => v === "1" || v === "true" || v === true,
    z.boolean(),
  ),
  min_followers: opt(num),
  max_followers: opt(num),
  sort: opt(z.enum(["name", "followers", "price"]).default("name")),
  cursor: opt(cursor.optional()),
  limit: opt(z.coerce.number().int().min(1).max(PAGE_MAX).default(24)),
});
export type SearchInput = z.infer<typeof searchSchema>;
export type SearchPage = {
  items: Creator[];
  nextCursor: string | null;
  total: number | null;
};
const encode = (k: string, id: string) =>
  Buffer.from(JSON.stringify({ k, id })).toString("base64url");

const PRICE_UNKNOWN = 1e12;
const sortKey = (c: Creator, sort: SearchInput["sort"]) =>
  sort === "name"
    ? c.name
    : sort === "followers"
      ? c.followers
      : (c.price_min_krw ?? PRICE_UNKNOWN);

// Keyless TEST demo only: same contract over the bundled fictional fixtures.
function searchFixtures(p: SearchInput): SearchPage {
  const q = p.q?.toLowerCase();
  const all = (creators as Creator[]).filter(
    (c) =>
      c.published &&
      (!q ||
        `${c.name} ${c.handle} ${c.bio} ${c.vibes.join(" ")}`
          .toLowerCase()
          .includes(q)) &&
      (!p.category || c.categories.includes(p.category)) &&
      (!p.platform || c.platforms.includes(p.platform)) &&
      (!p.tag || c.vibes.includes(p.tag)) &&
      (p.budget === undefined ||
        (c.price_min_krw !== null && c.price_min_krw <= p.budget)) &&
      (!p.available || c.is_available === true) &&
      (p.min_followers === undefined || c.followers >= p.min_followers) &&
      (p.max_followers === undefined || c.followers <= p.max_followers),
  );
  const dir = p.sort === "followers" ? -1 : 1;
  const cmp = (a: Creator, b: Creator) => {
    const x = sortKey(a, p.sort),
      y = sortKey(b, p.sort);
    return (
      (x < y ? -dir : x > y ? dir : 0) ||
      (a.seed_id < b.seed_id ? -1 : a.seed_id > b.seed_id ? 1 : 0)
    );
  };
  all.sort(cmp);
  // Fixtures are static, so the cursor id locates the position directly.
  const start = p.cursor
    ? all.findIndex((c) => c.seed_id === p.cursor!.id) + 1
    : 0;
  const items = all.slice(start, start + p.limit);
  const last = items.at(-1);
  const more = start + p.limit < all.length;
  return {
    items: items.map((c) => ({ ...c, owner_id: null })), // fixtures have no consent field
    nextCursor:
      more && last ? encode(String(sortKey(last, p.sort)), last.seed_id) : null,
    total: p.cursor ? null : all.length,
  };
}

export async function searchCreators(p: SearchInput): Promise<SearchPage> {
  const demo = isDemoMode();
  if (!configured()) {
    if (demo) return searchFixtures(p);
    await connection();
    throw new Error("서비스 데이터베이스 연결이 준비되지 않았습니다.");
  }
  const db = await supabase();
  const filters = {
    p_q: p.q ?? null,
    p_category: p.category ?? null,
    p_platform: p.platform ?? null,
    p_tag: p.tag ?? null,
    p_budget: p.budget ?? null,
    p_available: p.available,
    p_min_followers: p.min_followers ?? null,
    p_max_followers: p.max_followers ?? null,
    p_include_demo: demo, // decided by server mode, never by the client
  };
  // Fetch one extra row to know whether another page exists.
  const [page, count] = await Promise.all([
    db.rpc("search_creators", {
      ...filters,
      p_sort: p.sort,
      p_after_key: p.cursor?.k ?? null,
      p_after_id: p.cursor?.id ?? null,
      p_limit: p.limit + 1,
    }),
    p.cursor
      ? Promise.resolve({ data: null, error: null })
      : db.rpc("count_creators", filters),
  ]);
  if (page.error || count.error)
    throw new Error("크리에이터 목록을 불러오지 못했습니다.");
  const rows = (page.data ?? []) as {
    id: string;
    profile: Creator;
    claim_status: string;
    sort_key: string;
  }[];
  const items = rows.slice(0, p.limit);
  const last = items.at(-1);
  return {
    items: items.map((r) => ({
      ...r.profile,
      seed_id: r.id,
      published: true,
      owner_id: null,
      claim_status: r.claim_status,
    })),
    nextCursor:
      rows.length > p.limit && last ? encode(last.sort_key, last.id) : null,
    total: (count.data as number | null) ?? null,
  };
}

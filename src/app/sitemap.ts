import type { MetadataRoute } from "next";
import { isDemoMode } from "@/lib/mode";
import { publicCreators } from "@/lib/data";
import { PUBLIC_PAGES, indexable, siteUrl } from "@/lib/seo";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isDemoMode()) return [];
  const base = siteUrl();
  const creators = await publicCreators().catch(() => []);
  return [
    ...PUBLIC_PAGES.map((p) => ({ url: `${base}${p === "/" ? "" : p}` })),
    ...creators
      .filter(indexable)
      .map((c) => ({
        url: `${base}/creators/${encodeURIComponent(c.seed_id)}`,
      })),
  ];
}

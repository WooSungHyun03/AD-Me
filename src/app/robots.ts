import type { MetadataRoute } from "next";
import { isDemoMode } from "@/lib/mode";
import { PRIVATE_PREFIXES, siteUrl } from "@/lib/seo";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  // The TEST demo environment (fixtures, TEST payments) is never indexed.
  if (isDemoMode()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PREFIXES.map((p) => `${p}/`).concat(PRIVATE_PREFIXES),
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

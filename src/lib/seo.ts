// D083: public indexing boundary. robots/noindex only steer crawlers; every private route is still protected by
// server-side auth/RLS. Only published, owner-verified, non-demo profiles are indexable or listed in the sitemap.
export const PRIVATE_PREFIXES = [
  "/admin",
  "/api",
  "/auth",
  "/billing",
  "/campaigns",
  "/compare",
  "/dashboard",
  "/lists",
  "/login",
  "/matches",
  "/notifications",
  "/reports",
  "/settings",
  "/signup",
  "/tools",
  "/unsubscribe",
];
export const PUBLIC_PAGES = [
  "/",
  "/creators",
  "/about",
  "/help",
  "/pricing",
  "/privacy",
];
export const siteUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
export const indexable = (c: {
  is_demo?: boolean;
  claim_status?: string;
  published?: boolean;
}) => !c.is_demo && c.claim_status === "verified" && c.published === true;

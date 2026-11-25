import type { NextConfig } from "next";
import { youtubeImageHosts } from "./src/lib/youtube-images";
import { PRIVATE_PREFIXES } from "./src/lib/seo";
const isDev = process.env.NODE_ENV === "development";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "";
// Toss Payments v2 (TEST): SDK script, API calls and the payment window frame. Nothing else is third-party.
const toss = "https://*.tosspayments.com";
// shortcut: 'unsafe-inline' scripts/styles keep pages static (Next inline bootstrap + inline style props);
// upgrade to per-request nonces in src/proxy.ts if user-generated HTML is ever rendered.
export const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${toss}${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${youtubeImageHosts.map((host) => "https://" + host).join(" ")}`,
  "font-src 'self'",
  // Supabase REST/Auth/Storage + Realtime websocket, Toss API.
  `connect-src 'self' ${supabase} ${supabase.replace(/^http/, "ws")} ${toss}`,
  // D028: owner-consented YouTube embeds use the privacy-enhanced player host only.
  `frame-src ${toss} https://www.youtube-nocookie.com`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${toss}`,
  "frame-ancestors 'none'",
  // Only when the backend is HTTPS (a local TEST stack over http must keep working).
  ...(supabase.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
]
  .join("; ")
  .replace(/ {2,}/g, " ");
const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/tools", destination: "/creators", permanent: true },
      {
        source: "/tools/local",
        destination: "/campaigns/new",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
          // Payment windows may be popups, so popups keep their opener.
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          ...(isDev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains",
                },
              ]),
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/auth/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        // API responses are data, never pages: no caching of personal data by shared caches.
        source: "/api/(.*)",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      // D083: private/unreviewed routes are never indexed (access control stays server-side).
      ...PRIVATE_PREFIXES.flatMap((p) =>
        [p, `${p}/:path*`].map((source) => ({
          source,
          headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
        })),
      ),
    ];
  },
};
export default config;

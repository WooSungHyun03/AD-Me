# D083 — SEO, sharing and indexing public boundary (DEV-B · P1)

Status: **DONE (local)**. Not deployed (D088 checks robots and sitemap on the production URL).

## Principle
`robots.txt`, `X-Robots-Tag` and `meta robots` only guide crawlers. Access control stays where it was:
- server auth checks (`/dashboard`, `/admin` → login) and RLS;
- the `published` filter in `publicCreators()`.

## Implementation
- `src/lib/seo.ts`
  - `PRIVATE_PREFIXES` / `PUBLIC_PAGES`. A unit test fails if a top-level route under `src/app` is missing from either list.
  - `indexable()` is true only when the profile is not demo, is owner-verified, and is published.
- `src/app/robots.ts`: disallows the private prefixes and points to the sitemap. In **test_demo it returns `Disallow: /`**, so the demo/TEST environment is never indexed.
- `src/app/sitemap.ts`: public pages plus indexable profiles only. Unclaimed collected profiles, demo profiles and unpublished profiles are excluded. Returns an empty list in test_demo.
- `next.config.ts`: `X-Robots-Tag: noindex, nofollow` on every private prefix (pages and API).
- `layout.tsx` `generateMetadata`:
  - `metadataBase` = `NEXT_PUBLIC_APP_URL`;
  - Open Graph site_name, locale and logo image;
  - `robots: noindex` in test_demo.
- Public pages (`/`, `/creators`, `/about`, `/help`, `/pricing`, `/privacy`) get `alternates.canonical`.
- `/creators/[id]`: canonical and per-profile title/description.
  - Non-indexable profiles get `noindex, nofollow` and no OG profile data.
  - Indexable profiles get schema.org `ProfilePage`/`Person` JSON-LD (name and categories only, no numeric metrics), with `<` escaped.

## Known limit
- An unpublished or missing profile URL returns **HTTP 200** with the not-found UI. The root `loading.tsx` starts streaming before `notFound()`, so the status can't change; this is documented Next behaviour and was the same for the Googlebot UA.
  - No content is exposed (the name is absent) and the page carries `noindex`. The E2E asserts this.
  - `shortcut:` for a real 404, move the root `loading.tsx` below a route group. Out of scope here, because that affects all screens.

## Tests (2026-11-23)
- `tests/seo.test.ts` (4)
  - the indexing rule;
  - every route is classified;
  - free_beta: the sitemap has only indexable profiles, robots disallows `/dashboard`, `/admin/`, `/api/`, and the sitemap URL is set;
  - test_demo: sitemap empty, `Disallow: /`.
- `tests/e2e/seo.spec.ts` (desktop + mobile)
  - Private routes return the `X-Robots-Tag` header; public routes don't.
  - Anonymous `/dashboard` and `/admin` → login; `/api/notifications` → 401.
  - An unpublished profile's URL exposes no name and is noindex.
  - `/creators` has canonical, og:site_name and demo noindex.
  - robots is `Disallow: /`; the sitemap has no profiles.
  - A demo profile is noindex with no JSON-LD.
- Full regression: E2E 78/78, vitest 135 (see D070).

# AD Me Brand & UI Design System

## Brand asset
- Use `public/brand/ad-me-logo.png` **original 1254×1254 RGBA** uploaded by user.
- Header-friendly crops (unaltered artwork): `public/brand/ad-me-wordmark.png`, `public/brand/ad-me-logo-trimmed.png`, `public/brand/ad-me-symbol.png`. Keep original image available.
- The wordmark is near-black and icon includes neon lime; place it on off-white, ivory, or high-contrast light surfaces, **not a full black header** where "AD Me" disappears.
- Header: logo lockup in light panel, max-height ~48px, optional small "Creator intelligence" line. Mobile use icon crop via CSS `object-position` if legible; prefer original.
- Do not introduce a new mascot, robot/emoji logo, random stock people. Don't alter original logo or invent attribution.

## Color roles
- `--brand-lime: #D7FF45` (sparingly for CTAs and highlight)
- `--ink: #111412`, `--carbon: #191C19`
- `--canvas: #F6F6F1`, `--surface: #FFFFFF`
- `--muted: #67706A`, `--line: #DCE2D9`
- `--danger: #B8453D`, `--warning: #AA6A21`
- Accessibility contrast test mandatory; do not render small lime text on white.

## Visual direction
- Editorial B2B/SaaS, restrained typographic hierarchy, spacious content, two- or three-column search cards, highly readable filters.
- Hero: short concrete headline + actual product search controls + subtle geometric shape evoking matchmaking; **no generic blue gradients** and no repeated giant rounded cards.
- Creator card: permissioned thumbnail or illustrated placeholder, role/handle, platform, three vibe chips, estimate with source, action.
- Detail: profile + proof-backed ads timeline + review panel + shortlist action.
- Matches: numbered results, reason/uncertainty, score breakdown instead of black-box 'perfect match'.
- Campaigns: friendly wizard, clear progress and accessible validation.
- Deal board: status tabs, not misleading 'contract signed' without actual agreement.
- Billing: highlight test-only state, never mislead actual payment or auto renewal.

## Responsive & content quality
- Desktop 1440, tablet 768, mobile 390 widths, no horizontal overflow.
- Skeleton, no-results, API-down, unauthorized, form-validation, payment failed, empty messages.
- Short natural Korean copy. Avoid exaggerated claims or fabricated audience numbers.
- Motion durations <=200ms and reduced-motion respect; meaningful focus rings.
- Use typography tokens rather than arbitrary per-page styles.
- Add favicon/OG crop derived from original only if practical; external design tooling can prepare variants as separate assets.

# OSS-first Component Selection

| Need | Candidate | Use | Check before GitHub publication |
|---|---|---|---|
| UI primitives | shadcn/ui, Radix UI | accessible components, copy only components used | exact version license and attribution |
| Styling | Tailwind CSS | tokens/responsive layouts | package license |
| Iconography | Lucide | consistent vector icons | license/notice |
| Validation | Zod | request validation and LLM output guard | version license |
| Forms | React Hook Form | complex campaign creation forms | package license |
| Chart | Recharts | verified metrics visualization | package license |
| E2E | Playwright | browser + mobile testing | package license |
| Unit | Vitest | deterministic matching & payment unit tests | package license |
| Data/API | Supabase JS / Supabase SSR | auth + database + storage | service ToS, client licenses |
| CSV | Papa Parse or csv-parse | import/export | exact license |
| Drag/drop | dnd-kit | deal pipeline reorder | optional, package license |
| Tables | TanStack Table | advanced filtering/compare | optional, license |
| Fonts | open-license Korean web fonts (locally hosted) | brand typography | font license, attribution |

**Do not** copy a competitor's source code/data or proprietary iconography. Noncommercial demos and publicly open-sourced repositories still carry OSS copyright/license obligations. Avoid GPL/AGPL code inclusion unless their conditions are understood and satisfied. Check actual dependencies after installation (`npm ls`, software license inventory) rather than assuming all npm packages share the same license.

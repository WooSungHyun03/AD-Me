# D039 · conservative YouTube proposal scope

Default parser scope is explicitly YouTube. Negation/exclusion and alternatives return no applicable evidence rather than reversing intent or combining alternatives. Unsupported Instagram/TikTok requests are refused in the active scope. Explicit legacy mode preserves historical parsing and no saved records are rewritten. Existing size/unit/range validation and explicit preview/confirm/cancel remain.

`npm test`:504 tests/84 files PASS, including6 parser tests. Desktop/mobile scope browser passes2 of the final6 scenarios and a2-test screenshot refresh after adding settled-result assertions. Exclusion, unsupported platform and OR keep URL unchanged and Apply disabled; positive preview/cancel do not apply; confirm sets platform=youtube and maxPrice=1000000. Screenshot capture waits for a numeric catalog result and cleared loading status. Both sizes visually inspected; no horizontal overflow. No real channels/provider response was fabricated; seeded DEMO and explicitly fictional QA profiles are local only.

TESTED is the deterministic local contract/UI scope. Optional provider/LLM integration, B cross-review and hosted acceptance remain outside this receipt. Product-owned extraction is separately tested by PR-001; do not present these deterministic parser tests as provider/model validation.

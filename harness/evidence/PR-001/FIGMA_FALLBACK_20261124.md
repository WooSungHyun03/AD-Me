# PR-001 · Figma home fallback compatibility

Main1710f23 renamed the home destination to#recommendation while the product workbench still linked to#recommend. Update that link and preserve the historical#recommend anchor on the same existing home block. Actual browser reproduction also found direct hash navigation could occur while Next streamed the home loading shell, leaving scroll at0 after the target appeared. On recommendation form mount, honor only these two explicit fragment IDs. No global navigation observer, model call, automatic search or condition confirmation is added.

Desktop/mobile keyless2 scenarios PASS: canonical and historical hash URLs reach the visible form, explicit search accepts fictional input, unavailable data returns its safe error without inventing candidates and form values stay intact. Screenshot each final size inspected. Existing owner-product local browser test now additionally asserts canonical destination and viewport, but its DB-dependent suite was not rerun because Docker startup was rejected. Prior actual SQL/role/retry/confirmation receipts remain historical evidence at their original tested source.

Current batch517unit/43Python/lint/typecheck/build/affected10 browser PASS. U001/B D079/OPERATOR PR-003 actual runtime and hosted DB/app acceptance remain gates. Whole-ticket TESTED scope is preserved; no VERIFIED/DONE claim.

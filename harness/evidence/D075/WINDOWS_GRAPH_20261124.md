# D075 · native path audit correctness

The new static boundary CLI enumerated317 source files on Windows but reported0 direct DB routes. Native backslash paths did not match forward-slash file keys, import aliases or domain/client prefixes, so a clean result did not prove the intended checks had run. Normalize enumeration paths before building the graph; actual output now includes9 known direct Supabase routes, no runtime cycle and no policy violation. Known direct routes are an inventory, not an automatic violation.

Two black-box CLI fixtures PASS on the current Windows host: indirect client→barrel→server-only access, forbidden shared/domain-internal imports, runtime domain cycle and direct API DB route all detect; valid server actions and type-only client references remain allowed. Actual317-file scan succeeds with the expected9 routes. Full517unit shared batch passes.

This is a static source boundary fix, not RLS/Storage/371-function behavior acceptance. Named-list page still joins legacy raw creator profiles and CSV import still reads the raw table; safe opaque-reference lookup/write contract needs B D036/D038 plus live local DB validation. No raw grant or private lookup was enabled to hide that gap. D049 whole workflow, hosted permissions and current DB rerun remain outstanding; D075 remains IN_PROGRESS.

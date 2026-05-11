# ContextEngine-CC Chipotle Follow-On After Merge

## Why this PRD exists

The Chipotle migration worktree completed the main app transition:

- worker-mediated Chipotle runtime
- sponsored Lit authority/capability model cleanup
- browser-side Lit SDK removal from the active client runtime

The original Chipotle migration snapshot did **not** contain the full
`contextEngine-cc` runtime package as tracked git files. In that branch snapshot,
the checked-in `contextEngine-cc/` tree included only a partial slice:

- hooks
- some docs
- shared/question helpers
- a subset of tests

This integration branch does contain the fuller CE-CC runtime, including:

- `contextEngine-cc/server.mjs`
- `contextEngine-cc/package.json`
- `contextEngine-cc/install.sh`
- `contextEngine-cc/uninstall.sh`
- `contextEngine-cc/public/js/sessionSlugs.mjs`

That changes the status from "wait until the full runtime is available" to
"audit and converge the full runtime against the merged Chipotle architecture."

## Goal

Perform the corresponding CE-CC sync so its runtime, docs, and install flow
reflect the new Lit/Chipotle reality now that the complete `contextEngine-cc`
package is present in the integration tree.

## What to verify first

1. Confirm the fuller `contextEngine-cc` checkout still contains the expected runtime/install files:
   - `contextEngine-cc/server.mjs`
   - `contextEngine-cc/package.json`
   - `contextEngine-cc/install.sh`
   - `contextEngine-cc/uninstall.sh`
   - `contextEngine-cc/public/js/sessionSlugs.mjs`
2. Search the full CE-CC runtime for stale Lit/Naga/browser-SDK assumptions.
3. Re-run the full CE-CC suite before making changes so the baseline is explicit.

## Main follow-on tasks

### 1. Remove stale Lit/Naga/browser-SDK assumptions

Audit the fuller CE-CC runtime for any of the following:

- `@lit-protocol/*` browser/package assumptions
- `naga-*` or payer-wallet sponsorship language
- direct browser Lit execution assumptions
- outdated install notes that imply the main client still ships browser-side Lit SDKs

Update CE-CC to match the new app architecture:

- Lit/Chipotle execution stays on the main app's worker-mediated path
- browser-side Lit SDK dependency is no longer part of the supported client runtime
- any CE-CC references to session encryption should describe current worker-mediated behavior accurately

### 2. Verify whether CE-CC has any real Lit runtime integration of its own

If the fuller CE-CC runtime contains code that actually performs Lit operations, classify it:

- only documentation/install drift
- shared utility drift
- real runtime drift

If it is real runtime drift, update it to the new model rather than preserving a parallel legacy Lit path.

### 3. Reconcile install and local-server flows

Make sure the fuller CE-CC package accurately documents and ships:

- install flow
- uninstall flow
- local server start flow
- test flow
- monorepo coupling assumptions

If any README or install note still carries a partial-checkout caveat from the
old branch snapshot, adjust it so it is accurate for the fuller integration
context.

### 4. Re-run CE-CC tests with the full runtime present

At minimum:

- `npm run test:cc`
- any direct `node --test` files inside `contextEngine-cc/`
- install/start/statusline tests now that the runtime files are present

## Nice-to-have cleanup

- Make `scripts/run-contextengine-cc-tests.js` keep its clearer skip message from this worktree
- If the fuller CE-CC package is supposed to always exist, consider tightening CI or repo checks so missing runtime files are caught earlier
- Decide whether `contextEngine-cc` should remain a partial-in-repo slice or become a consistently complete tracked package

## Acceptance criteria

- The full `contextEngine-cc` runtime is audited against the merged Chipotle app architecture
- No stale browser-side Lit SDK assumptions remain in CE-CC code or docs
- If CE-CC contains real Lit runtime logic, it is either migrated to the Chipotle model or explicitly removed
- CE-CC install/start/uninstall/test docs match the actual tracked package contents
- `npm run test:cc` runs meaningfully in the integration context instead of skipping due to missing runtime files

## Notes for the next context

- The main app migration work is already ahead of the CE-CC audit.
- The blocker in the source branch was missing tracked CE-CC runtime files; this
  integration branch has those files, so the remaining work is a concrete audit.
- Treat this as a post-merge convergence task, not as a reason to reopen the main app's Chipotle cut.

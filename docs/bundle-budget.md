# Client Bundle Budget

The client build keeps the HTML entry small and moves the route shell behind a
lazy import. Further shell splitting is intentionally not hidden behind a higher
Vite warning limit.

PDF/canvas exports remain runtime `import()` calls. Vite leaves these packages
and their document-only dependencies out of manual vendor chunks. Every build
checks the emitted manifest's static import graph, including the boot shell
and lazy application routes, against the actual chunk module lists. Eager
PDF/canvas code fails the build even if a vendor chunk is renamed.

## Budget

- App entry JavaScript: <= 250 kB gzip.
- Non-vendor JavaScript chunks: <= 500 kB minified.
- Vite warning limit: 500 kB.

The checked-in policy below is validated directly against
`scripts/client-bundle-budget.json`; edit the machine-readable contract first
and use `node scripts/check-client-bundle-budget.mjs --print-policy` to
regenerate this block rather than maintaining parallel numbers.

<!-- BEGIN GENERATED CLIENT BUNDLE POLICY -->
| Scope | Limit | Classification |
| --- | ---: | --- |
| Application entry | 250,000 bytes gzip | `index.html` and its direct dynamic application entry |
| Non-vendor JavaScript | 500,000 bytes minified | All other non-vendor, non-exception chunks |
| Temporary exception: app-shell-temporary | 525,000 bytes minified | `assets/AppShell-*.js` |
| Duplicate emitted/compatibility images | 0 pairs | 0 explicit allowlist entries |
| Warning threshold | 95% of each byte cap | Warning only; more than 100% fails |
<!-- END GENERATED CLIENT BUNDLE POLICY -->

## How the Checker Works

`npm --prefix client run build` writes `client/build/vite-bundle-manifest.json`.
The checker reads it, measures built bytes directly, and follows the HTML
entry's direct dynamic import so hashed filename changes cannot reclassify the
application entry. It warns at 95% of a cap and fails over the checked-in cap.
The baseline monotonicity gate independently rejects cap, exception, entry,
vendor-prefix, or duplicate-allowlist growth.

## Static Image Deduplication

Vite emits each runtime-owned image once, as a hashed file under `assets/`.
`npm run client:bundle-budget:check` hashes the built images and fails when a
file outside `assets/` is byte-identical to an emitted asset; the allowlist is
empty. README-only images stay at their tracked source paths for GitHub and are
not emitted into the production build.

## Runtime Smoke

Command, against a running app (see [testing.md](testing.md#e2e-workflows)):

```bash
SMOKE_ROUTES=/session/pe4,/about,/docs,/contracts npm run -s test:e2e:smoke
```

The route set checks both the canonical Docs page and the legacy `/contracts`
redirect. A passing run has no page errors, unexpected failed requests,
unexpected console issues, missing text, or layout issues. The broader default
smoke can still expose environment-sensitive session or admin dependencies.

## Temporary AppShell Exception

`AppShell` is lazy-loaded but remains above the non-vendor chunk cap because
the shell/controller layer imports chain, cache, session, and profile runtime
modules synchronously. A broad app-level `manualChunks` split of executable
runtime modules produced browser initialization-order failures, so do not repeat
it. Keep runtime and controller reductions behind real lazy boundaries; narrowly
isolating immutable, side-effect-free fixture data is acceptable only when the
built import graph, bundle gate, and route smoke prove the split safe.

The exception is capped at 525,000 bytes minified. `scripts/client-bundle-budget.json`
is the authority for that number.

This is an accepted temporary exception for the current release line. The
follow-up work is a dedicated AppShell chunk diet: map the current chunk
ownership, move safe route/modal/runtime boundaries one at a time, keep route
behavior tests green, and only then tighten the budget.

Run the enforced build contract from the repository root:

```bash
npm --prefix client run build
npm run client:bundle-budget:check
```

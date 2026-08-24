# Client Bundle Budget

The client build keeps the HTML entry small and moves the route shell behind a
lazy import. Further shell splitting is intentionally not hidden behind a higher
Vite warning limit.

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

## Snapshot: 2026-07-21

Command:

```bash
npm --prefix client run build
```

Key chunks:

| Chunk | Minified | Gzip | Notes |
| --- | ---: | ---: | --- |
| `index-0c54e6dc.js` | 5.92 kB | 2.57 kB | HTML bootstrap entry |
| `index-b21485c9.js` | 673.72 kB | 190.05 kB | Direct dynamic application entry; governed by the entry gzip cap |
| `AppShell-9007e00d.js` | 624.28 kB | 169.08 kB | Lazy route shell; fixed temporary exception at 625,000 bytes |
| `SurveyQuestions-1cab4d79.js` | 496.74 kB | 125.27 kB | Route chunk; 95% warning band |
| `DebateMap-c3346e21.js` | 492.88 kB | 152.13 kB | Route chunk; 95% warning band |
| `vendor-wallet-core-5e1bf322.js` | 80.59 kB | 25.74 kB | Representative vendor chunk |
| `vendor-crypto-zk-poseidon-high-c5739e16.js` | 438.91 kB | 314.50 kB | Vendor chunk |

The checker reads `client/build/vite-bundle-manifest.json`, measures built bytes
directly, and follows the HTML entry's direct dynamic import so hashed filename
changes cannot reclassify the application entry. It warns at 95% and fails over
the checked-in cap. The baseline monotonicity gate independently rejects cap,
exception, entry, vendor-prefix, or duplicate-allowlist growth.

## Static Image Deduplication

The former build plugin copied 23 source images (18,710,631 bytes) into
`build/images` even though Vite already emitted the 21 runtime-owned images as
hashed assets. Those 21 byte-identical pairs totaled 16,618,799 bytes. No local
raw `/images/` consumer exists in source, styles, generated HTML/CSS/JS, or
tracked tests, so the compatibility copy and its unused optimizer script were
removed. README-only images remain tracked at their source paths for GitHub and
are not emitted into the production build.

The current build has no `build/images` directory and zero unapproved
hashed/compatibility image pairs. `npm run client:bundle-budget:check` hashes
built images and fails if a future compatibility path silently duplicates an
emitted asset.

## Runtime Smoke

Command:

```bash
SMOKE_ROUTES=/session/pe4,/about,/docs,/contracts npm run -s test:e2e:smoke
```

The route set checks both the canonical Docs page and the legacy `/contracts`
redirect. A passing run has no page errors, unexpected failed requests,
unexpected console issues, missing text, or layout issues. The broader default
smoke can still expose environment-sensitive session or admin dependencies.

## Temporary AppShell Exception

`AppShell` is now lazy-loaded but remains above the non-vendor chunk cap because
the shell/controller layer imports chain, cache, session, and profile runtime
modules synchronously. A previous broad app-level `manualChunks` split of
executable runtime modules produced browser initialization-order failures. Keep
runtime and controller reductions behind real lazy boundaries; narrowly
isolating immutable, side-effect-free fixture data is acceptable only when the
built import graph, bundle gate, and route smoke prove the split safe.

The August 2026 dead-code cleanup produced a 518,829-byte minified AppShell
chunk on the current development tree, so the temporary exception was tightened
from 625,000 to 525,000 bytes. The dated snapshot above remains the historical
evidence for the former cap; the machine-readable budget is the current
authority.

This is an accepted temporary exception for the current release line. The
follow-up work is a dedicated AppShell chunk diet: map the current chunk
ownership, move safe route/modal/runtime boundaries one at a time, keep route
behavior tests green, and only then tighten the budget snapshot.

Run the enforced build contract from the repository root:

```bash
npm --prefix client run build
npm run client:bundle-budget:check
```

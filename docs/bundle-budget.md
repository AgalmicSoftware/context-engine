# Client Bundle Budget

The client build keeps the app entry small enough for fast boot while route and
feature code load through explicit chunks.

## Budget

- App entry JavaScript: <= 250 kB gzip.
- Non-vendor JavaScript chunks: <= 500 kB minified.
- Vite warning limit: 500 kB, enforced by `build.chunkSizeWarningLimit`.

## Snapshot: 2026-07-07

Command:

```bash
npm --prefix client run build
```

Result:

| Chunk | Minified | Gzip |
| --- | ---: | ---: |
| `index-f3d2db38.js` | 5.05 kB | 1.92 kB |
| `AppShell-5b1be0cb.js` | 101.97 kB | 24.79 kB |
| `app-boot-support-4eea1c12.js` | 46.78 kB | 15.91 kB |
| `app-wallet-runtime-0de568d2.js` | 50.13 kB | 15.55 kB |
| `app-account-wallet-e5a9dddf.js` | 123.22 kB | 33.39 kB |
| `app-shell-chain-db7836b9.js` | 296.35 kB | 75.50 kB |
| `app-shell-session-cache-8dc32b66.js` | 330.97 kB | 98.66 kB |
| `SurveyQuestions-cf38fc62.js` | 499.67 kB | 125.19 kB |
| `DebateMap-5a0a26ba.js` | 492.43 kB | 151.84 kB |

No Vite chunk-size warnings were emitted with the 500 kB limit.

## Source Map Explorer

Snapshot commands:

```bash
npm --prefix client run build -- --sourcemap
npm --prefix client exec source-map-explorer -- client/build/assets/index-f3d2db38.js --json /tmp/ce-g7-entry.json --no-border-checks
npm --prefix client exec source-map-explorer -- client/build/assets/AppShell-5b1be0cb.js --json /tmp/ce-g7-appshell.json --no-border-checks
```

Source-map-explorer output:

| Bundle | Total | Mapped | Unmapped | Largest mapped sources |
| --- | ---: | ---: | ---: | --- |
| `index-f3d2db38.js` | 5,091 bytes | 4,128 bytes | 919 bytes | `App.tsx` 4,021 bytes; `index.js` 107 bytes |
| `AppShell-5b1be0cb.js` | 102,013 bytes | 100,231 bytes | 1,735 bytes | `AppShell.tsx` 81,373 bytes; `OnboardingOverlay.tsx` 3,698 bytes; `groupSlugLookup.ts` 3,878 bytes |

`--no-border-checks` is required because Vite emits single-line production
chunks that source-map-explorer otherwise rejects with a generated-column
border check.

## Notes

`AppShell` is lazy-loaded from `App.tsx`, and Vite manual chunks split boot,
wallet runtime, account, Arweave, chain, crypto/worker, session/cache, and
main-shell runtime code. `poseidon-lite`, PDF generation, and canvas export
remain behind dynamic imports at their usage sites.

The Wagmi/RainbowKit provider still wraps the app at the root, so wallet
connector runtime code remains part of startup. Moving wallet connectors to
connect intent requires a provider-boundary refactor of the account/login
surface and should be handled as a separate design change rather than a bundle
budget ratchet.

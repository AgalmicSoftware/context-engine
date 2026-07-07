# Client Bundle Budget

The client build keeps the HTML entry small and moves the route shell behind a
lazy import. Further shell splitting is intentionally not hidden behind a higher
Vite warning limit.

## Budget

- App entry JavaScript: <= 250 kB gzip.
- Non-vendor JavaScript chunks: <= 500 kB minified.
- Vite warning limit: 500 kB.

## Snapshot: 2026-07-07

Command:

```bash
npm --prefix client run build
```

Key chunks:

| Chunk | Minified | Gzip | Notes |
| --- | ---: | ---: | --- |
| `index-611ae211.js` | 6.08 kB | 2.62 kB | HTML entry |
| `AppShell-973190d6.js` | 1,132.60 kB | 305.35 kB | Lazy route shell; still over non-vendor cap |
| `SurveyQuestions-d440edd8.js` | 499.69 kB | 125.20 kB | Route chunk |
| `DebateMap-646899a0.js` | 492.88 kB | 152.01 kB | Route chunk |
| `vendor-wallet-connectors-fe0e1c7a.js` | 424.23 kB | 127.34 kB | Vendor chunk |
| `vendor-crypto-zk-poseidon-high-c5739e16.js` | 438.91 kB | 314.50 kB | Vendor chunk |

## Runtime Smoke

Command:

```bash
SMOKE_ROUTES=/session/pe4,/about,/contracts npm run -s test:e2e:smoke
```

Result: passed with no page errors, unexpected failed requests, unexpected
console issues, missing text, or layout issues. The broader default smoke still
reports pre-existing probe/environment failures for `/session/demo` text and
external Base RPC CORS on `/admin`.

## Remaining Blocker

`AppShell` is now lazy-loaded but remains above the non-vendor chunk cap because
the shell/controller layer imports chain, cache, session, and profile runtime
modules synchronously. A previous broad app-level `manualChunks` split produced
browser initialization-order failures, so further reduction should be designed as
a controller/provider boundary refactor instead of another manual chunk pass.

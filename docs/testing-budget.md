# Testing Budget

Measurements in this document were taken on 2026-07-06 and 2026-07-07 from
local macOS development worktrees.

## CI Budget

`.github/workflows/ci.yml` gives the client coverage job and the
`wiring-and-release` job a 25-minute timeout each. The tracked public E2E smoke
job has a 10-minute timeout and runs only stable smoke routes. The measured
local wall times below are not CI guarantees, but they are the current sizing
reference for reviewing future test additions.

## Current Measurements

| Command | Result | Wall time |
|---|---:|---:|
| `npm run test:ci` | passed: wiring, type-debt, release, contracts, client coverage, root/worker/cc/node/cache | 522.023s |
| `npm run test:client` | 1,042 suites, 7,602 passed, 0 skipped | 283.960s |
| `cd client && npm test -- --watchAll=false --runInBand --json --outputFile=/tmp/prd655-jest-results.json` | 997 suites, 7,399 passed, 1 skipped | 150.899s |
| `npm run test:node` | 239 passed | 33.279s |
| `BASE_URL=http://127.0.0.1:4173 SMOKE_ROUTES=/session/pe4,/about,/contracts npm run -s test:e2e:smoke` | passed against built Vite preview; 3 routes, no failures | 9.257s |

Against a 25-minute ceiling, the full `test:ci` run leaves about 16m18s of
headroom. The full client coverage run leaves about 20m16s
of headroom inside the client job. The local full client coverage run plus
`test:node` totals about 317.239s, leaving about 19m43s against a single
25-minute budget.

The tracked E2E smoke command leaves about 9m50s of headroom inside its
10-minute job after the client build completes. The default smoke route set is
broader than the CI route set and still includes known environment-sensitive
routes; CI uses `/session/pe4,/about,/contracts` until those routes are stable
enough for required PR checks.

## Slowest Client Suites

The no-coverage JSON pass exposed per-suite start/end timestamps. The ten
slowest suites in that pass were:

| Suite | Tests | Time |
|---|---:|---:|
| `client/src/components/SBTs/SBTsList.session-chip-progress.test.jsx` | 12 | 11.275s |
| `client/src/components/SBTs/SBTsList.refresh-render-timing.test.jsx` | 5 | 6.651s |
| `client/src/components/SBTs/SBTsList.loading-status.progressFlags.test.jsx` | 5 | 5.360s |
| `client/src/utilities/web3/contractScripts.sbt-metadata.test.js` | 18 | 4.114s |
| `client/src/components/Sessions/SessionWizard.pendingSbtFeatured.render.test.jsx` | 7 | 3.384s |
| `client/src/utilities/survey/sessionQuestionCacheController.test.js` | 33 | 1.782s |
| `client/src/components/About/AboutPage.test.tsx` | 17 | 1.773s |
| `client/src/utilities/web3/rpcProviders.session-sponsored.test.js` | 18 | 1.618s |
| `client/src/components/Account/LoginAndSettingsModal.render.test.jsx` | 41 | 1.423s |
| `client/src/components/DemoViews/CorpusViewer.test.tsx` | 23 | 1.383s |

These are report-only observations. Do not optimize them without a failing CI
budget trend or a targeted developer-loop need.

## Coverage Snapshot

The measured global coverage from `npm run test:client` was:

- Statements: 77.13% (76,653 / 99,369)
- Branches: 61.80% (65,206 / 105,509)
- Functions: 78.37% (14,310 / 18,259)
- Lines: 79.90% (71,136 / 89,027)

Selected top-level `client/src` buckets from `client/coverage/lcov.info`:

| Bucket | Files | Lines | Branches | Functions |
|---|---:|---:|---:|---:|
| `src/components` | 662 | 80.55% | 63.37% | 76.54% |
| `src/domains` | 35 | 96.79% | 74.50% | 96.07% |
| `src/utilities` | 231 | 78.04% | 58.11% | 82.70% |
| `src/variables` | 12 | 92.03% | 66.21% | 95.49% |
| `src/wallet` | 13 | 65.23% | 43.59% | 54.32% |

Coverage floors are banked in both `client/jest.config.cjs` and
`scripts/coverage-baseline.json` by rounding the measured global floor down
conservatively. `npm run test:client` emits
`client/coverage/coverage-summary.json`, and `npm run coverage-floor:check`
fails if any measured global percentage falls below the checked-in floor. Floors
should only move upward after large verified lanes.

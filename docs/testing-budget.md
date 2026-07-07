# Testing Budget

Measurements in this document were taken on 2026-07-06 from a local macOS
development worktree.

## CI Budget

`.github/workflows/ci.yml` gives the client coverage job and the
`wiring-and-release` job a 25-minute timeout each. The measured local wall times
below are not CI guarantees, but they are the current sizing reference for
reviewing future test additions.

## Current Measurements

| Command | Result | Wall time |
|---|---:|---:|
| `npm run test:ci` | passed: wiring, type-debt, release, contracts, client coverage, root/worker/cc/node/cache | 522.023s |
| `npm run test:client` | 1,009 suites, 7,434 passed, 1 skipped | 244.954s |
| `cd client && npm test -- --watchAll=false --runInBand --json --outputFile=/tmp/prd655-jest-results.json` | 997 suites, 7,399 passed, 1 skipped | 150.899s |
| `npm run test:node` | 239 passed | 33.279s |

Against a 25-minute ceiling, the full `test:ci` run leaves about 16m18s of
headroom. The full client coverage run leaves about 20m55s
of headroom inside the client job. The local full client coverage run plus
`test:node` totals about 278.233s, leaving about 20m22s against a single
25-minute budget.

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

- Statements: 76.58% (75,454 / 98,519)
- Branches: 61.33% (64,720 / 105,519)
- Functions: 77.81% (13,995 / 17,985)
- Lines: 79.36% (70,002 / 88,200)

Selected top-level `client/src` buckets from `client/coverage/lcov.info`:

| Bucket | Files | Lines | Branches | Functions |
|---|---:|---:|---:|---:|
| `src/components` | 609 | 80.53% | 62.93% | 75.99% |
| `src/domains` | 35 | 96.86% | 74.50% | 96.07% |
| `src/utilities` | 194 | 75.56% | 56.44% | 79.19% |
| `src/variables` | 12 | 93.25% | 64.66% | 95.28% |
| `src/wallet` | 13 | 65.17% | 43.59% | 54.04% |

Coverage floors are banked in both `client/jest.config.cjs` and
`scripts/coverage-baseline.json` by rounding the measured global floor down
conservatively. `npm run test:client` emits
`client/coverage/coverage-summary.json`, and `npm run coverage-floor:check`
fails if any measured global percentage falls below the checked-in floor. Floors
should only move upward after large verified lanes.

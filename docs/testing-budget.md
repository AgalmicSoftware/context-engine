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
| `npm run test:client` | 997 suites, 7,400 passed, 1 skipped | 225.464s |
| `cd client && npm test -- --watchAll=false --runInBand --json --outputFile=/tmp/prd655-jest-results.json` | 997 suites, 7,399 passed, 1 skipped | 150.899s |
| `npm run test:node` | 222 passed | 28.657s |

Against a 25-minute ceiling, the full client coverage run leaves about 21m15s
of headroom inside the client job. The local full client coverage run plus
`test:node` totals about 254.121s, leaving about 20m46s against a single
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

- Statements: 75.72% (74,479 / 98,352)
- Branches: 61.01% (64,319 / 105,422)
- Functions: 77.09% (13,840 / 17,951)
- Lines: 79.12% (69,229 / 87,488)

Selected top-level `client/src` buckets from `client/coverage/lcov.info`:

| Bucket | Files | Lines | Branches | Functions |
|---|---:|---:|---:|---:|
| `src/components` | 609 | 80.53% | 62.93% | 75.99% |
| `src/domains` | 35 | 96.86% | 74.50% | 96.07% |
| `src/utilities` | 194 | 75.56% | 56.44% | 79.19% |
| `src/variables` | 12 | 93.25% | 64.66% | 95.28% |
| `src/wallet` | 13 | 65.17% | 43.59% | 54.04% |

Coverage floors are banked in `client/jest.config.cjs` by rounding the measured
global floor down conservatively. They should only move upward after large
verified lanes.

# Dependency Audit

Last run: 2026-07-07 from `client/` via `npm audit --json` and `npm audit --omit=dev --json`.

## Summary

| Surface | Command | Result |
| --- | --- | --- |
| Client full tree | `npm audit --json` | 42 advisories: 13 low, 10 moderate, 19 high |
| Client production tree | `npm audit --omit=dev --json` | 40 advisories: 12 low, 12 moderate, 16 high |

No advisories were fixed in this slice. The primary remediation path, the wallet-stack upgrade to wagmi 2 / RainbowKit 2 / React Query 5, is blocked by the strict npm resolver conflict below.

## Blocked

| Package family | Highest severity | Disposition |
| --- | --- | --- |
| `@rainbow-me/rainbowkit`, `wagmi`, `@wagmi/core`, `@wagmi/connectors`, `@walletconnect/*`, `@json-rpc-tools/provider`, `axios`, `ws` | High | Blocked by PRD 617 wallet-stack migration. Strict install of `wagmi@2.19.5`, `@rainbow-me/rainbowkit@2.2.11`, and `@tanstack/react-query@5.101.2` failed twice with npm resolving the existing installed `@rainbow-me/rainbowkit@0.8.1` tree against the requested `@rainbow-me/rainbowkit@2.2.11` and its `@tanstack/react-query >=5.0.0` peer. Do not use `--force` or `--legacy-peer-deps`; retry from a clean install plan or an isolated migration branch. |

## Accepted With Reason

| Package family | Highest severity | Reason |
| --- | --- | --- |
| `ethers` / `@ethersproject/*` / `elliptic` | High | The app intentionally remains on ethers v5 compatibility. The audit-reported fix is `ethers@5.8.0`; test it as a narrow security patch before changing the exact `ethers@5.7.2` pin. Do not move to ethers v6 without a separate compatibility migration. |
| `@metamask/eth-sig-util` / `@metamask/utils` / `uuid` | Moderate | The npm suggested fix downgrades direct `@metamask/eth-sig-util@7.0.3` to `7.0.2` and changes transitive MetaMask utility versions. Keep accepted until a signed-message compatibility test covers worker auth and Lit decrypt paths. |
| `dompurify` via document/PDF tooling | Moderate | Transitive path is not on the wallet or worker hot path. Revisit with document/PDF dependency updates and XSS-focused fixture tests. |

## Deferred To PRD 658

| Package family | Highest severity | Reason |
| --- | --- | --- |
| `viem` | High | Semver patch to `2.54.6` is available, but wallet-stack migration was blocked. Batch with dependency automation or a narrow viem-only patch lane that runs wallet, chain, and worker auth smoke tests. |
| `react-router` / `react-router-dom` | Moderate | Semver patch to `6.30.4` is available. Defer to grouped client runtime updates with route smoke coverage. |
| `vite` / `esbuild` | High | Suggested fix is Vite 8, a major dev-tooling migration. Defer to grouped tooling updates with dev-server and production-build checks. |
| `@babel/core` | Low | Semver patch to `7.29.7` is available. Defer to grouped build-tool updates. |
| `form-data`, `js-yaml`, `tmp` | High | Transitive utility findings with available upstream fixes. Defer to grouped lockfile maintenance after the wallet-stack blocker is resolved. |

## Next Checks

Run these after dependency changes:

```bash
npm audit --prefix client --omit=dev
npm run -s test:wiring
npm run -s type-debt:check
npm run -s typecheck:client
npm run verify:release
```

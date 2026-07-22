# Testing

Context Engine testing spans the root repo, the React client, and the E2E workflow suite.

## Runtime Requirements

- Root scripts, CI-style test runs, and client workflows use Node.js
  `^20.19.0` or `>=22.12.0` with npm `^10.0.0`
- Install client dependencies with plain `npm install`; strict peer resolution
  is the normal install contract
- Contract and local-chain test flows require Foundry (`forge` / `anvil`)

## Common Commands

### Root CI Gate

```bash
nvm use 20
npm test
```

This runs the canonical root gate (`npm run test:ci`): wiring and ratchets,
release-surface checks and builds, contract/ABI parity, client coverage,
public-safe root Jest, both public Worker suites, Context Engine CC, the tracked
root Node universe, and the managed-cache guard. The coverage-enabled full
client universe and tracked Node universe each run exactly once. The wiring
lane also verifies that every tracked typed client test/support source is in
the monotonic test-typecheck universe.

`scripts/ci-gates.json` is the explicit command manifest. Local CI consumes
its serial `ci` profile; GitHub Actions consumes the same named gates as split
jobs so slow lanes remain visible. The final hosted `test` job compares all
reported results with the manifest's `hosted` profile and fails for missing,
extra, failed, canceled, or skipped lanes. Event-specific baseline-growth
authorization remains a protected workflow step beside the manifest-backed
gate.

`npm run verify:release` is the standalone `release` profile. It retains the
non-coverage full client and tracked-Node release rehearsal but is no longer
nested inside `test:ci`.

The manifest uses `test:node:tracked` for reproducible CI. The broader
`test:node` alias remains available to operators with ignored private E2E
helpers installed, but it is not a clean-checkout gate.

### Client-Only Tests

```bash
cd client
nvm use 20
npm test -- --watchAll=false
npm run lint
npm run typecheck
```

Use the client workflow when you are working only in `client/` and do not need the full root test gate.
The client test runner is standalone Jest 30 configured by `client/jest.config.cjs`.
Babel-Jest uses explicit Babel presets, and jsdom setup lives under
`client/scripts/jest/`.
Client linting runs ESLint 9 through `client/eslint.config.mjs`. One command
covers every tracked client JS, JSX, TS, and TSX source; specialized blocks
tighten React/Hooks rules for their established surfaces, while catch-all typed
and TSX blocks prevent new files from escaping baseline coverage. Unused disable
directives are errors. `npm run typecheck` runs the production client
TypeScript project with `tsc --noEmit`; Jest/spec helper files remain covered
by lint and Jest, and by the separate `npm run typecheck:client-tests` ratchet.
That ratchet compiles all tracked typed tests and named helpers with Jest 30's
real framework types, permits only the checked-in migration diagnostics, and
fails on any new diagnostic signature or count. The raw test project is not
yet zero-diagnostic, so the ratchet command—not a claim of clean standalone
`tsc` output—is the current contract.

`npm run test:client` performs one instrumented run with
`client/jest.full-universe.config.cjs`. Every tracked executable JS, JSX, TS,
and TSX production file under `client/src` enters the denominator, including
never-imported files. `npm run coverage-floor:check` reuses that run's
`coverage-final.json` to enforce both the fixed legacy imported-file metric and
the separately banked whole-production metric. The two percentages are not
directly comparable.

### Targeted Root Commands

```bash
nvm use 20
npm run test:contracts
npm run test:root:jest
npm run test:worker:session-cors
npm run test:node
npm run test:client
npm run coverage-floor:check
npm run typecheck:client-tests
npm run ci:gate -- workers
```

`npm run test:wiring` also runs `scripts/verify-test-inventory.js` and the
client architecture boundary checker. The boundary checker runs in
fail-on-new-violation mode against `scripts/client-boundaries-baseline.json`, so
existing legacy imports stay visible while new direct violations fail the gate.
The inventory check keeps root tests classified as one of:

- public-safe Node tests run by `npm run test:node`
- public-safe Jest tests run by `npm run test:root:jest`
- local-chain tests maintained in the full development checkout
- package-local tests run by their package's documented command

The Node runner recursively discovers tracked `*.test.{js,cjs,mjs}` files
under `tests/root`, `scripts`, and `workers/shared`, then applies the public
strip contract and explicit Jest/local-chain classifications. A nested eligible
test that is not reachable from a canonical runner fails inventory verification.

Do not add live credentials, private deployment names, or identifying fixtures
to root `package.json` scripts.

Public artifact preparation removes manifest commands whose npm scripts were
stripped, then drops any empty gate from its profiles. This keeps the retained
public `test:ci` graph self-consistent.

### Public Release Checks

```bash
npm run verify:public-release-surface
npm run verify:public-assets
```

The release-surface check rejects retained code that imports a stripped path.
The asset check rejects image files that have no literal owner in source,
documentation, or a public asset manifest. Public artifact preparation also
runs the documentation and all-text checks after private paths and package
commands have been removed; `verify:public-text` is therefore intended for a
prepared public tree rather than the full development checkout.

## E2E Workflows

The published source tree provides a deterministic route and style smoke from
the root:

```bash
nvm use 20
npm run test:e2e
```

Wallet behavior and local contract setup are documented in
[docs/passkey-wallet.md](passkey-wallet.md) and
[docs/local-chain.md](local-chain.md).

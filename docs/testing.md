# Testing

Context Engine testing spans the root repo, the React client, and the E2E workflow suite.

## Runtime Requirements

- Root scripts and CI-style test runs use Node.js 20+
- Client workflows use Node.js 16.14.2 and npm 9.2.0
- Install client dependencies with `npm install`; the `--legacy-peer-deps`
  contract is carried automatically via `client/.npmrc`
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
the monotonic test-typecheck universe. Build-owning gates immediately run the
manifest-backed bundle budget against the bytes they just produced, without a
second build.

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
nvm use 16
npm test -- --watchAll=false
npm run lint
npm run typecheck
```

Use the client workflow when you are working only in `client/` and do not need the full root test gate.
The client test runner is standalone Jest configured by `client/jest.config.cjs`;
it no longer shells through CRA or `react-app-rewired`.

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
npm run verify:public-text:prepared
```

The release-surface check rejects retained code that imports a stripped path.
The asset check rejects image files that have no literal owner in source,
documentation, or a public asset manifest. Public artifact preparation also
runs the documentation and all-text checks after private paths and package
commands have been removed; `verify:public-text` is therefore intended for a
prepared public tree rather than the full development checkout. The
`verify:public-text:prepared` command is the development/hosted-CI entry point:
it builds an isolated temporary artifact with the canonical release script,
relies on that script's strict public-text check, and removes the artifact.

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

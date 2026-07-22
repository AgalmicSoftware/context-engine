# scripts/

JS/Python tooling, build automation, audits, and verification runners live here.

This directory is intentionally separate from the Foundry Solidity script
directory:

- `foundry/script/` = Foundry Solidity deploy scripts
- `scripts/` = Node/Python/shell tooling and workflow automation

Common contents here include:

- public route/style smoke and test runners
- suite wrappers
- worker build, bundle verification, and deploy-helper publish scripts
- release, audit, and maintenance helpers

Contract ABI parity:

```bash
npm run verify:abi-sync
```

This builds the Foundry contracts and compares deterministic ABI extraction
with `client/src/contractsABI/` without rewriting tracked files. If reviewed
contract changes intentionally alter an ABI, run `npm run abi:sync` and inspect
the resulting tracked diff before rerunning the parity command.

Audit entrypoints write their complete report and then resolve the final
non-empty line through `scripts/lib/audit-verdict.sh`. A terminal `PASS` exits
zero; `FAIL`, an unreadable report, or a missing/malformed verdict exits
nonzero. Successful report plumbing alone is never treated as an audit pass.

Type-debt ratchet:

```bash
npm run type-debt:check
```

This counts production `client/src` TS/TSX `@ts-nocheck`, explicit-`any`, and double-cast `as unknown as` markers against `scripts/type-debt-baseline.json`. Tests, test utilities, and `*Harness.ts(x)` files are excluded. Use `node scripts/check-type-debt-ratchet.mjs --write-baseline` only after intentional cleanup or a reviewed baseline change.

Client boundary checker:

```bash
npm run client-boundaries:check
```

This compares conservative client import-boundary rules against `scripts/client-boundaries-baseline.json` and fails for new violations, duplicate baseline entries, or resolved baseline entries that were not pruned in the same change. The checker resolves Vite client aliases, guards production imports from excluded test/harness files, and flags likely low-level pass-through facades outside sanctioned domain/runtime layers. Use `node scripts/check-client-boundaries.mjs --write-baseline` after reviewed boundary cleanup removes or intentionally reclassifies entries.

The published checkout keeps `scripts/vite-navigation-smoke.js` as the maintained
local route/style smoke runner. Run it through `npm run test:e2e`.

Deploy-helper quick command:

```bash
nvm use 20
npm run deploy-helper:deploy -- \
  --worker-name ce-deploy-helper \
  --api-token "$CLOUDFLARE_API_TOKEN"
```

When `--allowed-origins` is omitted, the deploy-helper publish script seeds the stable hosted/local bootstrap origins used by `/new`.
For self-hosted app origins, pass `--allowed-origins` explicitly because the CLI cannot infer the current browser host.

If you are looking for Solidity deployment entry points, use
[`../foundry/script/`](../foundry/script/) instead.
If you are looking for Forge tests, use [`../foundry/test/`](../foundry/test/).
If you are looking for root Node/Jest tests, use [`../tests/root/`](../tests/root/).

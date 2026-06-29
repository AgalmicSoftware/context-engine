# foundry/script/

Foundry deploy scripts (Solidity). The directory keeps Foundry's conventional
singular `script/` name, but it lives under `foundry/` so the repo root can keep
general automation in `scripts/`.

| Script | Purpose |
|--------|---------|
| `DeploySBTFactory.s.sol` | Deploy SBTFactory to testnet/mainnet |
| `DeploySessionRegistry.s.sol` | Deploy SessionRegistry to testnet/mainnet |
| `DeployLocal.s.sol` | Local-chain (Anvil) test harness deploy — writes `client/src/variables/local-contracts.json` |

Path roles:

- `foundry/script/` = Foundry Solidity deploy scripts
- `foundry/test/` = Foundry Solidity test suites
- `scripts/` = JS/Python tooling, E2E runners, audits, and automation
- `tests/root/` = source-of-truth root Node/Jest test files
- `tests/helpers/` = shared root test helpers

For JS/Python tooling, E2E tests, and automation scripts, see
[`../../scripts/`](../../scripts/). For root Node/Jest tests, see
[`../../tests/`](../../tests/).

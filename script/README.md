# script/

Foundry deploy scripts (Solidity). This is the standard Foundry `script/` directory — `forge script` resolves paths here by default.

| Script | Purpose |
|--------|---------|
| `DeploySBTFactory.s.sol` | Deploy SBTFactory to testnet/mainnet |
| `DeploySessionRegistry.s.sol` | Deploy SessionRegistry to testnet/mainnet |
| `DeployLocal.s.sol` | Local-chain (Anvil) test harness deploy — writes `client/src/variables/local-contracts.json` |

Path roles at repo root:

- `script/` = Foundry Solidity deploy scripts
- `scripts/` = JS/Python tooling, E2E runners, audits, and automation
- `test/` = source-of-truth Foundry and root Node test files
- `tests/` = index/symlink view over selected test surfaces

For JS/Python tooling, E2E tests, and automation scripts, see [`../scripts/`](../scripts/).
For the source-of-truth test tree, see [`../test/`](../test/).

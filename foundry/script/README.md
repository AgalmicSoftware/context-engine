# foundry/script/

Foundry deploy scripts (Solidity). The directory keeps Foundry's conventional
singular `script/` name, but it lives under `foundry/` so the repo root can keep
general automation in `scripts/`.

| Script | Purpose |
|--------|---------|
| `DeployAll.s.sol` | Deploy SessionRegistry, Surveys, and SBTFactory to an EVM chain |
| `DeploySBTFactory.s.sol` | Deploy SBTFactory to testnet/mainnet |
| `DeploySessionRegistry.s.sol` | Deploy SessionRegistry to testnet/mainnet |
| `DeployLocal.s.sol` | Local-chain (Anvil) test harness deploy — writes `client/src/variables/local-contracts.json` |

For an explicitly approved EVM target, provide its chain ID, RPC URL, and
deployer key, then run the chain-neutral wrapper:

```bash
EVM_CHAIN_ID=<chain-id> \
EVM_RPC_URL=<rpc-url> \
EVM_PRIVATE_KEY_PATH=<key-file> \
npm run deploy:evm
```

The wrapper verifies the RPC chain ID, previews the three deterministic
addresses, and runs `DeployAll.s.sol`. It does not update the client contract
manifest or make the target chain supported; those require separate deployment
verification and an explicit manifest decision.

Path roles:

- `foundry/script/` = Foundry Solidity deploy scripts
- `foundry/test/` = Foundry Solidity test suites
- `scripts/` = JS/Python tooling, E2E runners, audits, and automation
- `tests/root/` = source-of-truth root Node/Jest test files
- `tests/helpers/` = shared root test helpers

For JS/Python tooling, E2E tests, and automation scripts, see
[`../../scripts/`](../../scripts/). For root Node/Jest tests, see
[`../../tests/`](../../tests/).

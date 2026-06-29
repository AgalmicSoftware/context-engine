# foundry/test/

This is the source-of-truth Foundry test directory.

Path roles:

- `foundry/script/` = Foundry Solidity deploy scripts
- `foundry/test/` = Foundry Solidity test suites
- `scripts/` = JS/Python tooling, E2E runners, audits, and automation
- `tests/root/` = source-of-truth root Node/Jest test files
- `tests/helpers/` = shared root test helpers

Typical contents here:

- Foundry Solidity suites such as `*.t.sol`, `*.fuzz.t.sol`, and `*.invariant.t.sol`
- shared Solidity test helpers such as `TestUtils.sol`

If you want root Node/Jest tests for workers, deploy helpers, and integration
harnesses, see [`../../tests/root/`](../../tests/root/).

# Security Sweeps

Last run: 2026-07-07.

## Full-History Secret Sweep

`trufflehog` was not installed, so the fallback scan was used:

```bash
git log -p dev --no-color --no-ext-diff > /private/tmp/ce-security-sweep/dev-history.patch
```

The patch stream was scanned for:

- key, secret, token, password, private-key, mnemonic, and bearer assignments
- PEM private-key headers
- 64-hex private-key-shaped values
- email addresses

Raw match counts:

| Pattern | Matches | Disposition |
| --- | ---: | --- |
| Secret-like assignments | 261 | Reviewed samples are test fixtures/placeholders, including `sk-open-test`, `sk-ant-test`, `bundle-secret`, `worker-token`, `agent-test-token`, `jwt-session-token`, `lit-secret`, and `account-key`. No live credential was identified in the sampled hits. |
| PEM private-key headers | 2 | Both hits are the intentional failing fixture in `scripts/verify-public-release-pii.test.js`. |
| 64-hex values | 1,341 | Reviewed samples are known constants, fixture keys, public/session keys, private-pack SHA-256 checksums, and generated vendor bundle diffs. Notable known fixtures include Hardhat/Anvil-style private keys and the scanner allowlist values. No unclassified live private key was identified in the sampled hits. |
| Emails | 3,159 | Dominated by git author metadata and public contact/security emails. Public emails are allowed; placeholder examples such as `name@example.com` and `owner@example.test` were also present. |

## Notes

- This was a regex fallback sweep, not a verified-secret scanner run.
- Re-run with `trufflehog git file:///absolute/path/to/context-engine --branch dev` when `trufflehog` is available.
- Public-release pushes still require the tip-level public PII scan: `npm run verify:public-release-pii -- release-public`.

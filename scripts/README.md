# scripts/

JS/Python tooling, automation, audits, seeders, and E2E runners live here.

This directory is intentionally separate from the repo-root `script/` directory:

- `script/` = Foundry Solidity deploy scripts
- `scripts/` = Node/Python/shell tooling and workflow automation

Common contents here include:

- `test-*.js` / `test-*.ui.js` E2E runners
- `run-*.js` suite wrappers
- worker build, bundle verification, and deploy-helper publish scripts
- release, audit, and maintenance helpers

The stripped public checkout keeps `scripts/vite-navigation-smoke.js` as the maintained local route/style smoke runner. Private full-workflow E2E files may be absent in this checkout; see [`../docs/e2e-commands.md`](../docs/e2e-commands.md) for the public smoke command and private-runner notes.

Deploy-helper quick command:

```bash
nvm use 20
npm run deploy-helper:deploy -- \
  --worker-name ce-deploy-helper \
  --api-token "$CLOUDFLARE_API_TOKEN"
```

When `--allowed-origins` is omitted, the deploy-helper publish script seeds the stable hosted/local bootstrap origins used by `/new`.
For self-hosted app origins, pass `--allowed-origins` explicitly because the CLI cannot infer the current browser host.

If you are looking for Solidity deployment entry points, use [`../script/`](../script/) instead.
If you are looking for source-of-truth Foundry or root Node tests, use [`../test/`](../test/) instead.

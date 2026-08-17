# Deployment Packages

`deploy/` contains reviewed, installable deployment packages. It is not the
canonical Worker source tree and it is not the local build-output directory.

The Session Worker has four distinct surfaces:

| Surface | Purpose |
| --- | --- |
| `workers/sessionCorsWorker/` | Canonical editable Worker source, isolated dependencies, and tests |
| `dist/sessionCorsWorker.bundle.js` | Generated, untracked local bundle used for verification and manual upload fallback |
| `deploy/cloudflare/session-worker/` | Checked-in Cloudflare-native deployment package consumed from an immutable public commit |
| GitHub Worker-bundle releases | Immutable CI-built bundles and their provenance manifest; a separately approved promotion moves the `latest` channel |

The Cloudflare deployment package includes more than a release bundle: it also
contains the Wrangler configuration, bindings, package metadata, setup
instructions, and a package manifest. Cloudflare's native deploy flow consumes
that repository directory, while deploy-helper and manual upload flows consume
the GitHub release bundle.

Do not edit the generated `worker.mjs` directly. Change the canonical Worker
source, then rebuild and verify the deployment package from the repository
root:

```bash
npm run worker:cloudflare-template
npm run verify:cloudflare-template
```

See [`cloudflare/session-worker/README.md`](cloudflare/session-worker/README.md)
for deployment instructions and the
[`Session Worker release-bundle documentation`](../docs/session-cors-worker.md#release-bundle)
for immutable publication and stable-channel promotion.

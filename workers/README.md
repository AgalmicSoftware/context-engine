# Worker source tree

`workers/` contains the canonical, human-maintained source for Context Engine's
Cloudflare Worker services. It does not contain GitHub release attachments or
the generated, self-contained template used by the native Deploy to Cloudflare
button.

| Directory | Responsibility |
| --- | --- |
| `sessionCorsWorker/` | Session runtime: authentication, canonical session data, storage, AI/transcription proxies, gates, and related routes. |
| `deploy-helper/` | Optional legacy installer that deploys a Session Worker through the Cloudflare API. It is a separate Worker, not another Session Worker copy. |
| `agentBridgeWorker/` | Agent HTTP and optional Telegram/Mini App bridge. It is deployed separately from a Session Worker. |
| `shared/` | Implementation shared by two or more Worker services. |

Related outputs live outside this source tree:

- `deploy/cloudflare/session-worker/` is a generated, checked-in, isolated
  deployment template. Cloudflare clones that Git subdirectory for the native
  deploy-button flow, so it must remain self-contained and available at an
  immutable public commit.
- `dist/*.bundle.js` contains untracked local build outputs for verification or
  manual upload.
- GitHub Releases contain immutable downloadable bundles for manual deployment
  and the deploy-helper flow.

Make Session Worker implementation changes in `workers/sessionCorsWorker/`,
then regenerate the downstream outputs. Do not hand-edit
`deploy/cloudflare/session-worker/worker.mjs`.

See [the Session Worker documentation](../docs/session-cors-worker.md) for the
full source, template, local-build, and release boundary.

## Licensing

The `workers/` subtree is part of the repo's worker/tooling boundary, not the
main `MPL-2.0` public core surface.

Current status:

- `workers/` project code is `MIT`.
- `workers/sessionCorsWorker/` is `MIT`.
- `workers/deploy-helper/` is `MIT`.
- `workers/agentBridgeWorker/` is `MIT`.
- Third-party worker dependencies and tooling keep their own licenses and should be checked separately from the worker subtree's MIT designation.

See [LICENSE](LICENSE) for the worker subtree's MIT text.
See [../LICENSING.md](../LICENSING.md) for the boundary map and shared-file rules.

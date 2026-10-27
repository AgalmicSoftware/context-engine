# Worker source tree

`workers/` contains the canonical, human-maintained source for Context Engine's
Cloudflare Worker services. It does not contain GitHub release attachments or
the generated, self-contained template used by the native Deploy to Cloudflare
button.

| Directory | Responsibility |
| --- | --- |
| `sessionCorsWorker/` | Session runtime: authentication, canonical session data, storage, AI/transcription proxies, gates, and related routes. |
| `deploy-helper/` | Optional legacy installer that deploys a Session Worker through the Cloudflare API. It is a separate Worker, not another Session Worker copy. |
| `sessionCorsWorker/agent/` | Agent HTTP, scoped credentials, optional registry submission queue, and Session Wrapped within the Session Worker. |
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

All project-authored Worker code uses MPL-2.0, including the Session Worker,
agent modules, deploy helper and shared modules. Third-party dependencies and
tooling keep their own licenses and notices. Earlier releases keep the
licenses they shipped with.

See [LICENSE](LICENSE) and the [project license map](../LICENSING.md).

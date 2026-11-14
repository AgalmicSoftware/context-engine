# MCP releases

`@agalmic/contextengine` is built and tested by canonical CI. The separate
`publish-mcp.yml` workflow runs after successful push CI on public `main`.
It publishes the exact tested tarball; it does not install dependencies,
rebuild the bundle, or run package lifecycle scripts in the publishing job.
Worker bundle publication remains independent.

## Initial setup

1. Merge the workflow and the intended MCP source through the public release
   process. The workflow defaults to verification without publishing while
   repository variable `MCP_NPM_PUBLISH_ENABLED` is absent or differs from `true`.
   Confirm the candidate version and contents; an unpublished version already
   in Git is not by itself a reason to release an older candidate.
2. Let all canonical CI jobs pass. Inspect the `mcp-package-<sha>-<attempt>`
   artifact and the publish workflow's dry-run result. The attempt is the one
   that built the package, which can be earlier than the run's last attempt.
3. In npm, open `@agalmic/contextengine` → Settings → Trusted publishing.
   Add GitHub Actions with owner `AgalmicSoftware`, repository `context-engine`,
   workflow filename `publish-mcp.yml`, and no environment name. Allow direct
   `npm publish`. No stored npm token is needed. Leave existing account 2FA
   protections in place.
4. Once that exact first release is ready, set repository Actions variable
   `MCP_NPM_PUBLISH_ENABLED=true`. Rerun the publication workflow for the
   successful CI run at the current `main` tip, or let the next qualifying CI
   completion trigger it. Setting the variable alone does not start a release.
5. Verify the published version, `latest`, tarball integrity and npm provenance.
   Install the published package and check its MCP initialize/tools response
   before considering initial setup complete.

npm currently requires a newly created Trusted Publisher connection to complete
its first successful publish within two days, so create it when the release is
ready. An expired connection must be recreated. The dedicated publishing runtime
uses Node 24.14.0 and its bundled npm 11.9.0; normal project/client CI remains on
its existing supported toolchain. See [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).

## Subsequent releases

Bump `mcp/package.json` and refresh `mcp/package-lock.json` as part of the reviewed
change. Run `npm run test:mcp` and `npm run test:mcp:pack`. When that version reaches
public `main` and canonical CI succeeds, publication is automatic. This also
applies when the package changes through shared modules or client ABI/crypto
imports outside `mcp/`: the artifact receipt records the actual esbuild inputs.

An identical already-published version is a no-op. Reusing a version with different
tarball contents fails with an instruction to bump it. The publisher refuses PRs,
forks, failed or unrelated workflows, a CI attempt that is not the run's
latest, stale `main` commits, corrupt artifacts and versions that would move
`latest` backward. Releases are serialized, with no cancellation of an
in-progress publish. Registry/network failures stop publication; they are never
interpreted as an absent version.

## Recovery and pause

Set `MCP_NPM_PUBLISH_ENABLED=false` to keep future jobs in dry-run mode. This does
not cancel a publish already in progress. If a publication fails, first inspect
the registry: the upload may have succeeded despite a connection error. The
workflow verifies registry integrity after either outcome and never retries the
upload within the same run. Since npm can take a while to list a new version,
it reads the registry every ten seconds for up to ten minutes before calling
a publish unconfirmed. That error prints the expected integrity: if
`npm view @agalmic/contextengine@<version> dist.integrity` matches it, the
publish succeeded. While `main` is unchanged, a rerun treats identical published
bytes as a no-op.
If `main` or the CI attempt has advanced, use successful CI for the current tip.
Do not unpublish or overwrite a version to repair a release.

**Re-running CI.** "Re-run failed jobs" keeps the package an earlier attempt
built: the CI job that packs and tests it only uploads it when it passes, and
it is re-run only if it failed. The publisher takes the newest
`mcp-package-<sha>-<attempt>` any attempt of that run uploaded, and checks that
its receipt names the same run, commit and attempt. "Re-run all jobs" builds and
uploads a new package under the new attempt. Re-run within 24 hours of the
first attempt: the Worker bundle candidate that CI's final job needs is kept
for one day. If the MCP package has expired (after 30 days), use "Re-run all
jobs"; with nothing failed there is nothing for "Re-run failed jobs" to rebuild.

The default launch command, `npx -y --prefer-online @agalmic/contextengine@latest`,
checks for a newer published version on restart; running servers are unchanged.
Existing users must update their host command once to adopt this behavior.
Exact version pins remain available for reproducible runs and stay fixed.

## Claude Desktop bundle

Claude Desktop installs a `.mcpb` file from a double-click and runs it with the
Node built into the app, so the person needs neither Node nor a config file. To
build one from the bundle the npm package ships:

```sh
npm --prefix mcp run build
node scripts/mcp-mcpb.mjs
```

It writes `dist/context-engine.mcpb`: `mcp/mcpb/manifest.json` at the version in
`mcp/package.json`, the server, and the licence notices. The same input gives the
same file on one Node version. Claude Desktop uses its own Node only when the
manifest's command is `node` with the script first, and only when that Node is
one the manifest admits; a test pins both.

The file holds one MCP version and does not update itself, unlike the `npx`
command, so build it again at every MCP version. No workflow builds or publishes
it: `publish-mcp.yml` and the Worker bundle workflows are unchanged.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PACKAGE, REPOSITORY, TARBALL, publicationDecision, validateRun, verifyArtifact } from './mcp-release-artifacts.mjs';

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const gh = (path) => JSON.parse(execFileSync('gh', ['api', `repos/${REPOSITORY}/${path}`], {
  encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
}));

export async function readRegistry(fetchImpl = fetch) {
  const response = await fetchImpl(`https://registry.npmjs.org/${encodeURIComponent(PACKAGE)}`, {
    redirect: 'error', signal: AbortSignal.timeout(30_000),
    headers: { accept: 'application/json', 'cache-control': 'no-cache' },
  });
  // This package already exists. Even 404 is an error, never permission to publish.
  assert.equal(response.status, 200, `registry unavailable (${response.status})`);
  const text = await response.text();
  assert(text.length < 8 * 1024 * 1024, 'oversized registry response');
  return JSON.parse(text);
}

export async function publishVerified({ receipt, tarball, getRegistry = readRegistry,
  checkSource, publish, dryRun = false }) {
  await checkSource();
  const decision = publicationDecision(receipt, await getRegistry());
  if (decision !== 'publish' || dryRun) return dryRun ? `dry-run:${decision}` : decision;
  // Repeat eligibility immediately before the irreversible registry write.
  await checkSource();
  if (publicationDecision(receipt, await getRegistry()) !== 'publish') return 'already-published';
  let publishError;
  try { await publish(tarball); } catch (error) { publishError = error; }
  const after = await getRegistry();
  const existing = after.versions?.[receipt.version];
  if (!existing) throw new Error('Publish was not confirmed. Inspect the registry before rerunning.', { cause: publishError });
  assert.equal(existing.dist?.integrity, receipt.integrity, 'published package integrity mismatch');
  assert.equal(after['dist-tags']?.latest, receipt.version, 'published version is not latest');
  assert(existing.dist?.attestations?.url, 'published package is missing provenance attestations');
  return publishError ? 'published:verified-after-error' : 'published';
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  assert.equal(process.env.GITHUB_REPOSITORY, REPOSITORY);
  if (command === 'validate-run') {
    const runId = process.env.SELECTED_RUN_ID;
    assert.match(runId || '', /^[1-9][0-9]*$/);
    const run = gh(`actions/runs/${runId}`);
    const expected = validateRun(run, gh('branches/main').commit.sha);
    assert.equal(String(run.id), runId);
    writeFileSync(resolve(process.env.RUNNER_TEMP, 'mcp-ci-run.json'), JSON.stringify(run));
    for (const [key, value] of Object.entries(expected)) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
    return;
  }
  assert.equal(command, 'publish');
  assert(args.length === 1 && ['--dry-run', '--publish'].includes(args[0]));
  const run = readJson(resolve(process.env.RUNNER_TEMP, 'mcp-ci-run.json'));
  const directory = resolve(process.env.RUNNER_TEMP, 'mcp-release');
  const receipt = verifyArtifact({ root: process.cwd(), directory, run });
  const checkSource = () => {
    const freshRun = gh(`actions/runs/${run.id}`);
    const expected = validateRun(freshRun, gh('branches/main').commit.sha);
    assert.equal(expected.runAttempt, receipt.runAttempt, 'CI was rerun; use the newest successful attempt');
    assert.equal(expected.sourceCommit, receipt.sourceCommit);
  };
  const status = await publishVerified({
    receipt, tarball: resolve(directory, TARBALL), checkSource,
    dryRun: args[0] === '--dry-run',
    publish: (tarball) => {
      assert.equal(process.env.MCP_NPM_PUBLISH_ENABLED, 'true', 'npm publication is not enabled');
      const env = { ...process.env };
      delete env.GH_TOKEN; delete env.GITHUB_TOKEN; delete env.NODE_AUTH_TOKEN; delete env.NPM_TOKEN;
      execFileSync('npm', ['publish', tarball, '--ignore-scripts', '--access', 'public', '--provenance',
        '--tag', 'latest', '--registry', 'https://registry.npmjs.org/'], {
        env, stdio: 'inherit', timeout: 120_000,
      });
    },
  });
  const summary = `${PACKAGE}@${receipt.version}: ${status}\nSource: ${receipt.sourceCommit}\nIntegrity: ${receipt.integrity}\n`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}

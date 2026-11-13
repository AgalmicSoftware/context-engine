import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PACKAGE, REPOSITORY, TARBALL, publicationDecision, selectPackageAttempt, validateRun, verifyArtifact }
  from './mcp-release-artifacts.mjs';

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

// npm can take minutes to list a new version (four, once), so after publishing
// the registry is read every ten seconds, for up to ten minutes, until it lists
// this version as latest with provenance. A failed read is tried again.
const CONFIRM_FOR_MS = 600_000;
const CONFIRM_EVERY_MS = 10_000;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function readAfterPublish(receipt, getRegistry, { wait, now }) {
  const deadline = now() + CONFIRM_FOR_MS;
  let after, readError;
  for (;;) {
    try { after = await getRegistry(); readError = undefined; } catch (error) { readError = error; }
    const existing = after?.versions?.[receipt.version];
    // Other contents under this version are a mismatch, not a delay.
    const settled = existing && (existing.dist?.integrity !== receipt.integrity
      || (after['dist-tags']?.latest === receipt.version && existing.dist?.attestations?.url));
    if (settled || now() >= deadline) return { after, readError };
    await wait(CONFIRM_EVERY_MS);
  }
}

export async function publishVerified({ receipt, tarball, getRegistry = readRegistry,
  checkSource, publish, dryRun = false, wait = sleep, now = Date.now }) {
  await checkSource();
  const decision = publicationDecision(receipt, await getRegistry());
  if (decision !== 'publish' || dryRun) return dryRun ? `dry-run:${decision}` : decision;
  // Repeat eligibility immediately before the irreversible registry write.
  await checkSource();
  if (publicationDecision(receipt, await getRegistry()) !== 'publish') return 'already-published';
  let publishError;
  try { await publish(tarball); } catch (error) { publishError = error; }
  const { after, readError } = await readAfterPublish(receipt, getRegistry, { wait, now });
  const existing = after?.versions?.[receipt.version];
  // A last read that failed leaves only an older answer, which confirms nothing.
  if (!existing || readError) {
    const name = `${PACKAGE}@${receipt.version}`;
    throw new Error(`Publish was not confirmed within ten minutes. If \`npm view ${name} dist.integrity\` `
      + `prints ${receipt.integrity}, it was published; while main is unchanged a rerun skips an identical version.`,
    { cause: publishError ?? readError });
  }
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
    expected.packageAttempt = selectPackageAttempt(gh(`actions/runs/${runId}/artifacts?per_page=100`), expected);
    writeFileSync(resolve(process.env.RUNNER_TEMP, 'mcp-ci-run.json'), JSON.stringify(run));
    for (const [key, value] of Object.entries(expected)) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
    return;
  }
  assert.equal(command, 'publish');
  assert(args.length === 1 && ['--dry-run', '--publish'].includes(args[0]));
  const run = readJson(resolve(process.env.RUNNER_TEMP, 'mcp-ci-run.json'));
  const directory = resolve(process.env.RUNNER_TEMP, 'mcp-release');
  const receipt = verifyArtifact({ root: process.cwd(), directory, run, packageAttempt: process.env.MCP_PACKAGE_ATTEMPT });
  const checkSource = () => {
    const freshRun = gh(`actions/runs/${run.id}`);
    const expected = validateRun(freshRun, gh('branches/main').commit.sha);
    assert.equal(expected.runAttempt, String(run.run_attempt), 'CI was rerun; use the newest successful attempt');
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

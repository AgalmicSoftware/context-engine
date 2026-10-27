import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { PACKAGE, REPOSITORY, TARBALL, RECEIPT, collectInputs, inspectPackage,
  integrity, publicationDecision, stagePackage, validateRun, verifyArtifact } from './mcp-release-artifacts.mjs';
import { publishVerified, readRegistry } from './publish-mcp.mjs';

const SHA = 'a'.repeat(40);
const manifest = { name: PACKAGE, version: '0.1.2', publishConfig: { access: 'public', registry: 'https://registry.npmjs.org/' },
  repository: { url: `https://github.com/${REPOSITORY}` }, bin: { contextengine: 'dist/contextengine.mjs' } };
const goodRun = (head = SHA) => ({ name: 'CI', path: '.github/workflows/ci.yml', event: 'push', status: 'completed',
  conclusion: 'success', head_branch: 'main', head_sha: head, id: 123, run_attempt: 2,
  repository: { full_name: REPOSITORY }, head_repository: { full_name: REPOSITORY } });
const registry = { name: PACKAGE, 'dist-tags': { latest: '0.1.0' }, versions: {} };
const receipt = { version: '0.1.2', integrity: 'sha512-fixture' };
const published = { ...registry, 'dist-tags': { latest: '0.1.2' }, versions: {
  '0.1.2': { dist: { integrity: receipt.integrity, attestations: { url: 'https://registry.npmjs.org/attestations/fixture' } } },
} };

function archive(extra = [], patch = {}) {
  const entries = [
    ['package/LICENSE', 'Fixture license'], ['package/README.md', 'Fixture readme'],
    ['package/dist/THIRD_PARTY_LICENSES.txt', 'Fixture dependency licenses'],
    ['package/dist/contextengine.mjs', '#!/usr/bin/env node\nconsole.log("fixture");'],
    ['package/package.json', JSON.stringify({ ...manifest, ...patch })], ...extra,
  ];
  const blocks = [];
  for (const [name, text, type = '0'] of entries) {
    const body = Buffer.from(text), header = Buffer.alloc(512);
    header.write(name, 0, 100); header.write('0000644\0', 100); header.write('0000000\0', 108);
    header.write('0000000\0', 116); header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124);
    header.write('00000000000\0', 136); header.fill(32, 148, 156); header.write(type, 156);
    header.write('ustar\0', 257); header.write('00', 263);
    header.write(`${header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0')}\0 `, 148);
    blocks.push(header, body, Buffer.alloc((512 - body.length % 512) % 512));
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}

test('only successful canonical push CI on the current public main can publish', () => {
  assert.equal(validateRun(goodRun(), SHA).runAttempt, '2');
  for (const patch of [
    { event: 'pull_request' }, { conclusion: 'failure' }, { status: 'in_progress' },
    { head_branch: 'release-staging' }, { head_branch: 'master' }, { name: 'Other CI' },
    { path: '.github/workflows/other.yml' }, { head_repository: { full_name: 'fixture/fork' } },
    { repository: { full_name: 'fixture/fork' } }, { id: '1/../../' }, { run_attempt: 0 },
  ]) assert.throws(() => validateRun({ ...goodRun(), ...patch }, SHA));
  assert.throws(() => validateRun(goodRun(), 'b'.repeat(40)), /stale/);
});

test('package inspection allows only the five regular package files and supported metadata', () => {
  assert.equal(inspectPackage(archive()).manifest.version, '0.1.2');
  for (const extra of [
    [['package/../secret', 'x']], [['package/README.md', 'duplicate']],
    [['package/link', '', '2']], [['package/.env', 'fixture']],
  ]) assert.throws(() => inspectPackage(archive(extra)));
  assert.throws(() => inspectPackage(archive([], { dependencies: { unexpected: '1' } })));
  assert.throws(() => inspectPackage(archive([], { version: '0.1.2-beta.1' })));
  const corrupt = Buffer.from(archive()); corrupt[15] ^= 1;
  assert.throws(() => inspectPackage(corrupt));
});

test('artifact verification binds tarball, version, complete local bundle inputs and CI attempt', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'ce-mcp-artifact-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, value) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), value); };
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  write('mcp/package.json', JSON.stringify(manifest));
  write('mcp/package-lock.json', JSON.stringify({ name: PACKAGE, version: manifest.version, packages: { '': { version: manifest.version } } }));
  for (const path of ['mcp/README.md', 'mcp/LICENSE', 'package-lock.json', 'scripts/mcp-bundle.mjs',
    'mcp/bin/context-engine-mcp.mjs', 'shared/questions/types.mjs', 'client/src/contractsABI/example.json']) write(path, 'fixture');
  const inputs = { 'mcp/bin/context-engine-mcp.mjs': {}, 'shared/questions/types.mjs': {},
    'client/src/contractsABI/example.json': {}, 'mcp/node_modules/ethers/index.js': {} };
  write('dist/mcp.metafile.json', JSON.stringify({ inputs }));
  const hashes = collectInputs(root, { inputs });
  assert(hashes['shared/questions/types.mjs']); assert(hashes['client/src/contractsABI/example.json']);
  assert(!hashes['mcp/node_modules/ethers/index.js']);
  assert.throws(() => collectInputs(root, { inputs: { 'private/fixture.mjs': {} } }), /unsupported/);
  assert.throws(() => collectInputs(root, { inputs: { '../fixture.mjs': {} } }));
  git('init', '-q'); git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@localhost', 'commit', '-qm', 'fixture');
  const commit = git('rev-parse', 'HEAD');
  write('source.tgz', archive());
  const directory = join(root, 'output');
  const staged = stagePackage({ root, tarball: join(root, 'source.tgz'), output: directory, env: {
    GITHUB_SHA: commit, GITHUB_REPOSITORY: REPOSITORY, GITHUB_REF: 'refs/heads/main', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2',
  } });
  const verify = (run = goodRun(commit)) => verifyArtifact({ root, directory, run });
  assert.equal(verify().integrity, integrity(readFileSync(join(root, 'source.tgz'))));
  assert.throws(() => verify({ ...goodRun(commit), run_attempt: 3 }), /runAttempt mismatch/);
  write('shared/questions/types.mjs', 'changed');
  assert.throws(verify, /source input mismatch/); write('shared/questions/types.mjs', 'fixture');
  write(`output/${TARBALL}`, archive([], { version: '0.1.3' }));
  assert.throws(verify); write(`output/${TARBALL}`, archive());
  write(`output/${RECEIPT}`, JSON.stringify({ ...staged, integrity: 'wrong' }));
  assert.throws(verify, /integrity/); write(`output/${RECEIPT}`, JSON.stringify(staged));
  write('mcp/package-lock.json', JSON.stringify({ version: '0.1.3', packages: { '': { version: '0.1.3' } } }));
  assert.throws(verify);
});

test('release decisions are idempotent and never overwrite a version or downgrade latest', () => {
  assert.equal(publicationDecision(receipt, registry), 'publish');
  assert.equal(publicationDecision(receipt, published), 'already-published');
  assert.throws(() => publicationDecision({ ...receipt, integrity: 'different' }, published), /bump the MCP version/);
  assert.throws(() => publicationDecision(receipt, { ...registry, 'dist-tags': { latest: '1.0.0' } }), /backward/);
  assert.throws(() => publicationDecision(receipt, {}));
});

test('registry network/auth/outage failures cannot become an absent-version decision', async () => {
  for (const status of [401, 403, 404, 429, 500, 503]) {
    await assert.rejects(readRegistry(async () => ({ status })), /registry unavailable/);
  }
  await assert.rejects(readRegistry(async () => { throw new Error('offline'); }), /offline/);
  await assert.rejects(readRegistry(async () => ({ status: 200, text: async () => 'broken JSON' })));
});

test('dry runs and duplicate releases never invoke publication', async () => {
  for (const [data, dryRun, expected] of [[registry, true, 'dry-run:publish'], [published, false, 'already-published']]) {
    let calls = 0;
    assert.equal(await publishVerified({ receipt, getRegistry: async () => data, checkSource: () => {},
      dryRun, publish: () => { calls++; } }), expected);
    assert.equal(calls, 0);
  }
});

test('publication rechecks source, uses the supplied tarball and verifies the registry result', async () => {
  let reads = 0, checks = 0, actualTarball;
  assert.equal(await publishVerified({ receipt, tarball: '/fixture/tested.tgz',
    getRegistry: async () => reads++ < 2 ? registry : published,
    checkSource: () => { checks++; }, publish: (path) => { actualTarball = path; } }), 'published');
  assert.equal(checks, 2); assert.equal(actualTarball, '/fixture/tested.tgz');
  checks = 0;
  await assert.rejects(publishVerified({ receipt, getRegistry: async () => registry,
    checkSource: () => { if (++checks === 2) throw new Error('main advanced'); },
    publish: () => assert.fail('must not publish stale source') }), /main advanced/);
});

test('ambiguous publish response is reconciled without retrying the upload', async () => {
  let reads = 0, publishes = 0;
  assert.equal(await publishVerified({ receipt,
    getRegistry: async () => reads++ < 2 ? registry : published, checkSource: () => {},
    publish: () => { publishes++; throw new Error('connection closed'); } }), 'published:verified-after-error');
  assert.equal(publishes, 1);
  await assert.rejects(publishVerified({ receipt, getRegistry: async () => registry, checkSource: () => {},
    publish: () => { throw new Error('offline'); } }), /not confirmed/);
  const noProvenance = structuredClone(published); delete noProvenance.versions['0.1.2'].dist.attestations;
  reads = 0;
  await assert.rejects(publishVerified({ receipt, getRegistry: async () => reads++ < 2 ? registry : noProvenance,
    checkSource: () => {}, publish: () => {} }), /provenance/);
});

test('workflow publishes only the CI artifact, defaults to dry-run and serializes publication', () => {
  const workflow = readFileSync(new URL('../.github/workflows/publish-mcp.yml', import.meta.url), 'utf8');
  const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_run:\s+branches: \[main\]/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /if: vars.MCP_NPM_PUBLISH_ENABLED != 'true'/);
  assert.match(workflow, /if: vars.MCP_NPM_PUBLISH_ENABLED == 'true'/);
  assert.match(workflow, /id-token: write/);
  assert.doesNotMatch(workflow, /contents: write|npm (?:ci|install|pack)|secrets\.|cache:/);
  assert.match(workflow, /run-id: \$\{\{ steps.run.outputs.runId \}\}/);
  assert.match(workflow, /mcp-package-\$\{\{ steps.run.outputs.sourceCommit \}\}-\$\{\{ steps.run.outputs.runAttempt \}\}/);
  assert.match(ci, /MCP_RELEASE_OUTPUT: \$\{\{ runner.temp \}\}\/mcp-release/);
  assert.match(ci, /mcp-package-\$\{\{ github.sha \}\}-\$\{\{ github.run_attempt \}\}/);
});

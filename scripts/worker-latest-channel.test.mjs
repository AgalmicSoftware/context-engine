import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { manageLatestChannel, parseApiResponse, VERIFIED_RELEASE_FILES } from './worker-latest-channel.mjs';
import { WORKER_ARTIFACTS, MANIFEST_FILE } from './worker-release-artifacts.mjs';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const SHA_C = 'c'.repeat(40);
const REPOSITORY = 'example/fixture';
const PREFIX = `repos/${REPOSITORY}`;
const MARKER = 'worker-bundles-latest-manual';
const FILES = ['sessionCorsWorker.bundle.js', 'agentBridgeWorker.bundle.js', 'deployHelper.bundle.js', 'worker-release-manifest.json'];
const tagFor = (sha) => `worker-bundles-${sha}`;
const refFor = (ref, sha) => ({ ref, object: { type: 'commit', sha } });
const releaseFor = (sha, id = 2) => ({ id, tag_name: tagFor(sha), draft: false, prerelease: false });

function fixture(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-worker-latest-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const file of FILES) fs.writeFileSync(path.join(dir, file), `verified ${file}\n`);
  const state = {
    head: SHA_B,
    defaultBranch: 'main',
    marker: '',
    latest: releaseFor(SHA_A, 1),
    release: releaseFor(SHA_B),
    comparison: { status: 'ahead', ahead_by: 1, behind_by: 0 },
    operations: [],
    ...options,
  };
  const fail = (status) => { throw Object.assign(new Error(`GitHub API HTTP ${status}`), { status }); };
  const github = {
    async api(method, endpoint, body) {
      state.operations.push({ method, endpoint, body });
      if (state.failEndpoint === endpoint) fail(403);
      if (endpoint === PREFIX) return { full_name: REPOSITORY, default_branch: state.defaultBranch };
      if (endpoint === `${PREFIX}/git/ref/heads/${state.defaultBranch}`) {
        return refFor(`refs/heads/${state.defaultBranch}`, state.head);
      }
      if (endpoint === `${PREFIX}/git/ref/tags/${tagFor(SHA_B)}`) {
        return refFor(`refs/tags/${tagFor(SHA_B)}`, state.releaseCommit || SHA_B);
      }
      if (endpoint === `${PREFIX}/releases/tags/${tagFor(SHA_B)}`) return state.release;
      if (endpoint === `${PREFIX}/releases/latest`) {
        if (state.failReadback && state.edited) fail(503);
        if (!state.latest) fail(404);
        return state.latest;
      }
      if (endpoint === `${PREFIX}/git/matching-refs/tags/${MARKER}`) {
        return state.marker
          ? [refFor(`refs/tags/${MARKER}`, state.marker)]
          : [refFor(`refs/tags/${MARKER}-backup`, SHA_C)];
      }
      if (endpoint.startsWith(`${PREFIX}/compare/`)) {
        const base = endpoint.slice(`${PREFIX}/compare/`.length).split('...')[0];
        return { ...state.comparison, base_commit: { sha: base }, merge_base_commit: { sha: base } };
      }
      if (method === 'POST' && endpoint === `${PREFIX}/git/refs`) {
        assert.equal(body.ref, `refs/tags/${MARKER}`);
        state.marker = body.sha;
        return refFor(body.ref, body.sha);
      }
      if (method === 'PATCH' && endpoint === `${PREFIX}/git/refs/tags/${MARKER}`) {
        state.marker = body.sha;
        return refFor(`refs/tags/${MARKER}`, body.sha);
      }
      throw new Error(`Unexpected API call: ${method} ${endpoint}`);
    },
    async download(tag, destination) {
      state.operations.push({ download: tag });
      assert.equal(tag, tagFor(SHA_B));
      for (const file of FILES) {
        const corrupt = state.corruptDownload || (state.corruptReadback && state.edited);
        fs.writeFileSync(path.join(destination, file), corrupt ? 'corrupt' : fs.readFileSync(path.join(dir, file)));
      }
    },
    async setLatest(tag) {
      state.operations.push({ latest: tag });
      state.edited = true;
      state.latest = { ...state.release };
    },
  };
  const run = (overrides = {}) => manageLatestChannel({
    mode: 'automatic', repository: REPOSITORY, sourceCommit: SHA_B,
    sourceRef: 'refs/heads/main', verifiedDir: dir, github, ...overrides,
  });
  const writes = () => state.operations.filter((entry) => entry.latest || ['POST', 'PATCH'].includes(entry.method));
  return { state, github, run, writes, dir };
}

test('automatic publication advances only Latest after verifying all public artifact bytes', async (t) => {
  const { state, run, writes } = fixture(t);
  assert.equal((await run()).status, 'updated');
  assert.deepEqual(writes(), [{ latest: tagFor(SHA_B) }]);
  assert.equal(state.operations.filter((entry) => entry.download).length, 2);
  const write = state.operations.findIndex((entry) => entry.latest);
  assert.ok(state.operations.slice(0, write).some((entry) => entry.download));
  assert.ok(state.operations.slice(write + 1).some((entry) => entry.endpoint === `${PREFIX}/releases/latest`));
  assert.ok(state.operations.slice(write + 1).some((entry) => entry.download));
});

test('an existing verified release can recover promotion and repeated success is a no-op', async (t) => {
  const { run, writes } = fixture(t, { latest: null });
  assert.equal((await run()).status, 'updated');
  assert.equal((await run()).status, 'unchanged');
  assert.equal(writes().length, 1);
});

test('delayed CI and non-default canonical branches cannot change Latest', async (t) => {
  for (const options of [{ head: SHA_C }, { defaultBranch: 'master' }]) {
    const { run, writes } = fixture(t, options);
    assert.equal((await run()).status, 'skipped');
    assert.deepEqual(writes(), []);
  }
});

test('an older candidate cannot replace a newer Latest even after a branch rewind', async (t) => {
  const { run, writes } = fixture(t, { comparison: { status: 'behind', ahead_by: 0, behind_by: 1 } });
  assert.equal((await run()).status, 'skipped');
  assert.deepEqual(writes(), []);
});

test('automatic publication preserves a manual rollback through its recorded branch tip', async (t) => {
  for (const options of [
    { marker: SHA_B },
    { marker: SHA_C, comparison: { status: 'behind', ahead_by: 0, behind_by: 1 } },
    { marker: SHA_C, comparison: { status: 'diverged', ahead_by: 1, behind_by: 1 } },
  ]) {
    const { run, writes } = fixture(t, options);
    assert.equal((await run()).status, 'skipped');
    assert.deepEqual(writes(), []);
  }
  const newer = fixture(t, { marker: SHA_A });
  assert.equal((await newer.run()).status, 'updated');
  assert.deepEqual(newer.writes(), [{ latest: tagFor(SHA_B) }]);
});

test('manual promotion records a durable watermark before deliberate historical rollback', async (t) => {
  const { state, run, writes } = fixture(t, { head: SHA_C, latest: releaseFor(SHA_C, 3) });
  assert.equal((await run({ mode: 'record-manual' })).status, 'recorded');
  assert.equal(state.marker, SHA_C);
  assert.equal(state.latest.tag_name, tagFor(SHA_C));
  assert.equal((await run({ mode: 'manual' })).status, 'updated');
  assert.deepEqual(writes(), [
    { method: 'POST', endpoint: `${PREFIX}/git/refs`, body: { ref: `refs/tags/${MARKER}`, sha: SHA_C } },
    { latest: tagFor(SHA_B) },
  ]);
});

test('manual recording failure prevents later channel writes', async (t) => {
  const { run, writes } = fixture(t, { failEndpoint: `${PREFIX}/git/refs` });
  await assert.rejects(run({ mode: 'record-manual' }), /HTTP 403/);
  assert.equal(writes().filter((entry) => entry.latest).length, 0);
});

test('drafts, prereleases, wrong source tags and bad artifact bytes fail before mutation', async (t) => {
  for (const options of [
    { release: { ...releaseFor(SHA_B), draft: true } },
    { release: { ...releaseFor(SHA_B), prerelease: true } },
    { releaseCommit: SHA_A },
    { corruptDownload: true },
    { head: 'null' },
  ]) {
    const { run, writes } = fixture(t, options);
    await assert.rejects(run());
    assert.deepEqual(writes(), []);
  }
});

test('authentication and lookup failures cannot be treated as absent channels', async (t) => {
  for (const endpoint of [PREFIX, `${PREFIX}/releases/latest`, `${PREFIX}/git/ref/heads/main`, `${PREFIX}/git/matching-refs/tags/${MARKER}`]) {
    const { run, writes } = fixture(t, { failEndpoint: endpoint });
    await assert.rejects(run(), /HTTP 403/);
    assert.deepEqual(writes(), []);
  }
});

test('write-success/readback-failure and bad-download failures recover without another write', async (t) => {
  for (const failure of ['failReadback', 'corruptReadback']) {
    const { state, run, writes } = fixture(t, { [failure]: true });
    await assert.rejects(run());
    assert.equal(writes().length, 1);
    state[failure] = false;
    assert.equal((await run()).status, 'unchanged');
    assert.equal(writes().length, 1);
  }
});

test('the default branch tip is checked again immediately before changing Latest', async (t) => {
  const { state, github, run, writes } = fixture(t);
  const api = github.api;
  let heads = 0;
  github.api = async (...args) => {
    if (args[1] === `${PREFIX}/git/ref/heads/main` && ++heads === 2) state.head = SHA_C;
    return api(...args);
  };
  assert.equal((await run()).status, 'skipped');
  assert.deepEqual(writes(), []);
});

test('the trusted helper remains usable from an older checkout without its source files', async (t) => {
  const { dir, github } = fixture(t);
  const historical = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-historical-source-'));
  t.after(() => fs.rmSync(historical, { recursive: true, force: true }));
  const copiedHelper = path.join(historical, 'trusted-helper.mjs');
  fs.copyFileSync(new URL('./worker-latest-channel.mjs', import.meta.url), copiedHelper);
  const copied = await import(pathToFileURL(copiedHelper));
  const result = await copied.manageLatestChannel({
    mode: 'automatic', repository: REPOSITORY, sourceCommit: SHA_B,
    sourceRef: 'refs/heads/main', verifiedDir: dir, github,
  });
  assert.equal(result.status, 'updated');
});

test('GitHub HTTP status parsing distinguishes a missing Latest from authorization errors', () => {
  assert.deepEqual(parseApiResponse('HTTP/2.0 200 OK\r\ncontent-type: application/json\r\n\r\n{"id":1}'), { id: 1 });
  for (const status of [403, 404, 500]) {
    assert.throws(
      () => parseApiResponse(`HTTP/2.0 ${status} Error\ncontent-type: application/json\n\n{"message":"failure"}`),
      (error) => error.status === status,
    );
  }
  assert.throws(() => parseApiResponse('connection failed'), /HTTP/);
});

test('Latest byte comparisons cover the complete canonical Worker release artifact', () => {
  assert.deepEqual([...VERIFIED_RELEASE_FILES].sort(), [...WORKER_ARTIFACTS.map(({ file }) => file), MANIFEST_FILE].sort());
});

test('the standalone CLI handles real gh arguments, missing Latest, stale heads and HTTP failures', (t) => {
  const { dir } = fixture(t);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-latest-cli-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const script = path.join(temp, 'trusted-helper.mjs');
  const stateFile = path.join(temp, 'state.json');
  const callsFile = path.join(temp, 'calls.jsonl');
  fs.copyFileSync(new URL('./worker-latest-channel.mjs', import.meta.url), script);
  fs.writeFileSync(path.join(temp, 'gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.MOCK_CALLS, JSON.stringify(args) + '\\n');
const state = JSON.parse(fs.readFileSync(process.env.MOCK_STATE, 'utf8'));
const reply = (value, status = 200) => {
  process.stdout.write('HTTP/2.0 ' + status + ' Result\\r\\ncontent-type: application/json\\r\\n\\r\\n' + JSON.stringify(value));
  if (status >= 400) process.exit(1);
};
if (args[0] === 'api') {
  if (args[1] !== '--include' || args[2] !== '--method' || args[3] !== 'GET') throw new Error('unexpected API arguments');
  if (process.env.MOCK_HTTP_FAILURE) reply({message: 'forbidden'}, Number(process.env.MOCK_HTTP_FAILURE));
  const endpoint = args[4];
  if (endpoint === 'repos/example/fixture') reply({full_name: 'example/fixture', default_branch: 'main'});
  else if (endpoint.endsWith('/git/ref/heads/main')) reply({ref: 'refs/heads/main', object: {type: 'commit', sha: state.head}});
  else if (endpoint.includes('/releases/tags/')) reply(state.release);
  else if (endpoint.includes('/git/ref/tags/')) reply({ref: 'refs/tags/' + state.release.tag_name, object: {type: 'commit', sha: '${SHA_B}'}});
  else if (endpoint.includes('/git/matching-refs/')) reply([]);
  else if (endpoint.endsWith('/releases/latest')) reply(state.latest || {message: 'Not Found'}, state.latest ? 200 : 404);
  else throw new Error('unexpected endpoint: ' + endpoint);
} else if (args[0] === 'release' && args[1] === 'download') {
  if (args[3] !== '--repo' || args[4] !== 'example/fixture') throw new Error('wrong download repository');
  const output = args[args.indexOf('--dir') + 1];
  for (const file of fs.readdirSync(process.env.MOCK_ARTIFACT_DIR)) fs.copyFileSync(path.join(process.env.MOCK_ARTIFACT_DIR, file), path.join(output, file));
} else if (args[0] === 'release' && args[1] === 'edit') {
  if (!args.includes('--latest') || args[4] !== 'example/fixture') throw new Error('wrong mutation arguments');
  state.latest = state.release;
  fs.writeFileSync(process.env.MOCK_STATE, JSON.stringify(state));
} else throw new Error('unexpected gh invocation');
`, { mode: 0o755 });
  const execute = (head = SHA_B, failure = '') => {
    fs.writeFileSync(stateFile, JSON.stringify({ head, release: releaseFor(SHA_B), latest: null }));
    fs.writeFileSync(callsFile, '');
    const result = spawnSync(process.execPath, [script, '--mode', 'automatic', '--repository', REPOSITORY,
      '--source-commit', SHA_B, '--source-ref', 'refs/heads/main', '--verified-dir', dir], {
      cwd: temp,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${temp}${path.delimiter}${process.env.PATH}`, GH_TOKEN: '', GITHUB_TOKEN: '',
        MOCK_STATE: stateFile, MOCK_CALLS: callsFile, MOCK_ARTIFACT_DIR: dir, MOCK_HTTP_FAILURE: failure },
    });
    const calls = fs.readFileSync(callsFile, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
    return { ...result, writes: calls.filter((args) => args[0] === 'release' && args[1] === 'edit') };
  };
  const current = execute();
  assert.equal(current.status, 0, current.stderr);
  assert.equal(JSON.parse(current.stdout).status, 'updated');
  assert.equal(current.writes.length, 1);
  const stale = execute(SHA_C);
  assert.equal(stale.status, 0, stale.stderr);
  assert.equal(JSON.parse(stale.stdout).status, 'skipped');
  assert.deepEqual(stale.writes, []);
  const forbidden = execute(SHA_B, '403');
  assert.notEqual(forbidden.status, 0);
  assert.match(forbidden.stderr, /HTTP 403/);
  assert.deepEqual(forbidden.writes, []);
});

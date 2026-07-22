import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildCloudflareSessionTemplate,
  verifyCloudflareSessionTemplate,
} from './cloudflare-session-template.mjs';

const TEMPLATE_FILES = {
  'wrangler.jsonc': '{"name":"context-engine-session","vars":{"CE_BUNDLE_SHA256":"replace-me"}}\n',
  'package.json': '{"name":"context-engine-session-deploy"}\n',
  '.dev.vars.example': 'TOKEN_HMAC_SECRET=replace-me\n',
  'README.md': '# Template\n',
  LICENSE: 'MIT\n',
};

const makeFixture = () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'ce-cloudflare-template-'));
  const templateDir = join(rootDir, 'deploy', 'cloudflare', 'session-worker');
  mkdirSync(join(rootDir, 'dist'), { recursive: true });
  mkdirSync(templateDir, { recursive: true });
  Object.entries(TEMPLATE_FILES).forEach(([name, contents]) => {
    writeFileSync(join(templateDir, name), contents);
  });
  return { rootDir, templateDir };
};

test('buildCloudflareSessionTemplate copies exact bundle bytes and records deterministic checksums', async (t) => {
  const { rootDir, templateDir } = makeFixture();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));
  const bundle = [
    'class SessionWriteCoordinator {}',
    'var worker_default = { fetch() {} };',
    'export { SessionWriteCoordinator, worker_default as default };',
    '',
  ].join('\n');
  const buildBundles = async () => {
    writeFileSync(join(rootDir, 'dist', 'sessionCorsWorker.bundle.js'), bundle);
  };

  const manifest = await buildCloudflareSessionTemplate({ rootDir, buildBundles });

  assert.equal(readFileSync(join(templateDir, 'worker.mjs'), 'utf8'), bundle);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.kind, 'context-engine-session-worker-deploy-button');
  assert.equal(manifest.generatedFrom, 'workers/sessionCorsWorker/worker.js');
  assert.equal(manifest.files['worker.mjs'].bytes, Buffer.byteLength(bundle));
  assert.match(manifest.files['worker.mjs'].sha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.packageSha256, /^[a-f0-9]{64}$/);
  const wranglerConfig = JSON.parse(readFileSync(join(templateDir, 'wrangler.jsonc'), 'utf8'));
  assert.equal(wranglerConfig.vars.CE_BUNDLE_SHA256, manifest.files['worker.mjs'].sha256);
  assert.deepEqual(
    JSON.parse(readFileSync(join(templateDir, 'template-manifest.json'), 'utf8')),
    manifest,
  );
  await assert.doesNotReject(() => verifyCloudflareSessionTemplate({ rootDir, buildBundles }));
});

test('verifyCloudflareSessionTemplate rejects source drift without rewriting the package', async (t) => {
  const { rootDir, templateDir } = makeFixture();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));
  let bundle = [
    'class SessionWriteCoordinator {}',
    'var worker_default = { fetch() {} };',
    'export { SessionWriteCoordinator, worker_default as default };',
    '',
  ].join('\n');
  const buildBundles = async () => {
    writeFileSync(join(rootDir, 'dist', 'sessionCorsWorker.bundle.js'), bundle);
  };
  await buildCloudflareSessionTemplate({ rootDir, buildBundles });
  const trackedBundle = readFileSync(join(templateDir, 'worker.mjs'), 'utf8');
  bundle = [
    'class SessionWriteCoordinator {}',
    'var worker_default = { fetch() { return 1; } };',
    'export { SessionWriteCoordinator, worker_default as default };',
    '',
  ].join('\n');

  await assert.rejects(
    () => verifyCloudflareSessionTemplate({ rootDir, buildBundles }),
    /out of sync/i,
  );
  assert.equal(readFileSync(join(templateDir, 'worker.mjs'), 'utf8'), trackedBundle);
});

test('buildCloudflareSessionTemplate rejects a bundle without the required Durable Object export', async (t) => {
  const { rootDir } = makeFixture();
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));
  const buildBundles = async () => {
    writeFileSync(
      join(rootDir, 'dist', 'sessionCorsWorker.bundle.js'),
      'export default { fetch() {} };\n',
    );
  };

  await assert.rejects(
    () => buildCloudflareSessionTemplate({ rootDir, buildBundles }),
    /SessionWriteCoordinator export/i,
  );
});

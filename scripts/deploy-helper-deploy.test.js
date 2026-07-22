'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const loadModule = async () => {
  const moduleUrl = pathToFileURL(path.join(__dirname, 'deploy-helper-deploy.mjs')).href;
  return import(moduleUrl);
};

const cfSuccess = (result = {}) => new Response(JSON.stringify({
  success: true,
  result,
}), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

const makeFetchSequence = (responses = []) => {
  const queue = [...responses];
  const calls = [];
  const fetchMock = async (...args) => {
    calls.push(args);
    const next = queue.shift();
    if (typeof next === 'function') {
      return next(...args);
    }
    return next;
  };
  fetchMock.calls = calls;
  return fetchMock;
};

test('parseArgs accepts required deploy-helper flags and boolean switches', async () => {
  const { parseArgs } = await loadModule();
  assert.deepEqual(parseArgs([
    '--worker-name', 'ce-helper',
    '--api-token', 'cf-token',
    '--allowed-origins', 'https://app.example.test,http://localhost:3000',
    '--skip-build',
  ]), {
    'worker-name': 'ce-helper',
    'api-token': 'cf-token',
    'allowed-origins': 'https://app.example.test,http://localhost:3000',
    'skip-build': true,
  });
});

test('resolveDeployHelperDeployConfig falls back to the stable hosted/local bootstrap origins', async () => {
  const {
    DEFAULT_DEPLOY_HELPER_ALLOWED_ORIGINS,
    resolveDeployHelperDeployConfig,
  } = await loadModule();
  const config = resolveDeployHelperDeployConfig({
    flags: {
      'worker-name': 'ce-helper',
      'api-token': 'cf-token',
    },
    env: {},
  });

  assert.deepEqual(config.allowedOrigins, DEFAULT_DEPLOY_HELPER_ALLOWED_ORIGINS);
  assert.deepEqual(config.allowedOrigins, [
    'https://contextengine.sh', // canonical production hosted app origin
    'https://www.contextengine.sh', // canonical production hosted app origin
    'https://contextengine.xyz', // redirect compatibility origin
    'https://www.contextengine.xyz', // redirect compatibility origin
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:7391',
    'http://127.0.0.1:7391',
  ]);
});

test('resolveDeployHelperDeployConfig bootstrap defaults do not infer arbitrary self-hosted app origins', async () => {
  const { resolveDeployHelperDeployConfig } = await loadModule();
  const config = resolveDeployHelperDeployConfig({
    flags: {
      'worker-name': 'ce-helper',
      'api-token': 'cf-token',
    },
    env: {},
  });

  assert.equal(config.allowedOrigins.includes('https://app.example.test'), false);
});

test('resolveDeployHelperDeployConfig normalizes explicit env allowlist values', async () => {
  const {
    DEFAULT_DEPLOY_HELPER_BUNDLE_PATH,
    DEFAULT_SESSION_WORKER_BUNDLE_URL,
    DEFAULT_SESSION_WORKER_BUNDLE_MANIFEST_URL,
    resolveDeployHelperDeployConfig,
  } = await loadModule();

  const config = resolveDeployHelperDeployConfig({
    flags: {},
    env: {
      CLOUDFLARE_API_TOKEN: 'cf-token',
      DEPLOY_HELPER_WORKER_NAME: 'ce-helper',
      ALLOWED_ORIGINS: 'https://app.example.test\nlocalhost:3000',
    },
    rootDir: '/tmp/context-engine',
  });

  assert.equal(config.apiToken, 'cf-token');
  assert.equal(config.workerName, 'ce-helper');
  assert.deepEqual(config.allowedOrigins, [
    'https://app.example.test',
    'http://localhost:3000',
  ]);
  assert.equal(config.workerBundleUrl, DEFAULT_SESSION_WORKER_BUNDLE_URL);
  assert.equal(config.workerBundleManifestUrl, DEFAULT_SESSION_WORKER_BUNDLE_MANIFEST_URL);
  assert.equal(
    config.bundlePath,
    path.resolve('/tmp/context-engine', DEFAULT_DEPLOY_HELPER_BUNDLE_PATH)
  );
});

test('buildDeployHelperUploadMetadata writes the expected bindings', async () => {
  const { buildDeployHelperUploadMetadata } = await loadModule();
  const metadata = buildDeployHelperUploadMetadata({
    kvNamespaceId: 'kv-123',
    allowedOrigins: ['https://app.example.test', 'http://localhost:3000'],
    workerBundleUrl: 'https://assets.example.test/sessionCorsWorker.bundle.js',
    workerBundleManifestUrl: 'https://assets.example.test/worker-release-manifest.json',
    compatibilityDate: '2025-01-01',
    workerCompatibilityDate: '2025-02-02',
    defaultSessionSlug: 'alpha',
  });

  assert.equal(metadata.main_module, 'worker.mjs');
  assert.deepEqual(metadata.bindings, [
    { name: 'DEPLOY_HELPER_KV', type: 'kv_namespace', namespace_id: 'kv-123' },
    {
      name: 'CE_SESSION_COORDINATOR',
      type: 'durable_object_namespace',
      class_name: 'SessionWriteCoordinator',
    },
    { name: 'ALLOWED_ORIGINS', type: 'plain_text', text: 'https://app.example.test,http://localhost:3000' },
    { name: 'WORKER_BUNDLE_URL', type: 'plain_text', text: 'https://assets.example.test/sessionCorsWorker.bundle.js' },
    { name: 'WORKER_BUNDLE_MANIFEST_URL', type: 'plain_text', text: 'https://assets.example.test/worker-release-manifest.json' },
    { name: 'WORKER_COMPATIBILITY_DATE', type: 'plain_text', text: '2025-02-02' },
    { name: 'DEFAULT_SESSION_SLUG', type: 'plain_text', text: 'alpha' },
  ]);
  assert.deepEqual(metadata.migrations, {
    old_tag: '',
    new_tag: 'ce-session-write-coordinator-v1',
    new_sqlite_classes: ['SessionWriteCoordinator'],
  });
  assert.equal(metadata.compatibility_date, '2025-01-01');
});

test('deployDeployHelperWorker retries an already-applied coordinator migration without dropping its binding', async () => {
  const { deployDeployHelperWorker } = await loadModule();
  const migrationFailure = new Response(JSON.stringify({
    success: false,
    errors: [{ message: 'Migration tag precondition failed: tag already applied.' }],
  }), {
    status: 412,
    headers: { 'Content-Type': 'application/json' },
  });
  const fetchMock = makeFetchSequence([
    cfSuccess([{ id: 'account-123', name: 'Test Account' }]),
    cfSuccess([{ id: 'kv-123', title: 'ContextEngineDeployHelper:ce-helper' }]),
    migrationFailure,
    cfSuccess({ id: 'worker-uploaded' }),
    cfSuccess({}),
    cfSuccess({ subdomain: 'tenant-subdomain', status: 'active' }),
    cfSuccess({ enabled: true }),
  ]);

  const result = await deployDeployHelperWorker({
    apiToken: 'cf-token',
    workerName: 'ce-helper',
    bundleSource: 'export default { async fetch() { return new Response("ok"); } };',
    fetchImpl: fetchMock,
    adminSecret: 'top-secret',
  });

  assert.equal(result.ok, true);
  const uploadCalls = fetchMock.calls.filter(([url, init]) => (
    String(url).endsWith('/workers/scripts/ce-helper') && init?.method === 'PUT'
  ));
  assert.equal(uploadCalls.length, 2);
  const firstMetadata = JSON.parse(await new Response(uploadCalls[0][1].body.get('metadata')).text());
  const retryMetadata = JSON.parse(await new Response(uploadCalls[1][1].body.get('metadata')).text());
  assert.deepEqual(firstMetadata.migrations, {
    old_tag: '',
    new_tag: 'ce-session-write-coordinator-v1',
    new_sqlite_classes: ['SessionWriteCoordinator'],
  });
  assert.equal(Object.hasOwn(retryMetadata, 'migrations'), false);
  assert.deepEqual(retryMetadata.bindings.find(({ name }) => name === 'CE_SESSION_COORDINATOR'), {
    name: 'CE_SESSION_COORDINATOR',
    type: 'durable_object_namespace',
    class_name: 'SessionWriteCoordinator',
  });
});

test('deployDeployHelperWorker does not mask an unrelated upload precondition failure', async () => {
  const { deployDeployHelperWorker } = await loadModule();
  const uploadFailure = new Response(JSON.stringify({
    success: false,
    errors: [{ message: 'Worker binding precondition failed.' }],
  }), {
    status: 412,
    headers: { 'Content-Type': 'application/json' },
  });
  const fetchMock = makeFetchSequence([
    cfSuccess([{ id: 'account-123', name: 'Test Account' }]),
    cfSuccess([{ id: 'kv-123', title: 'ContextEngineDeployHelper:ce-helper' }]),
    uploadFailure,
  ]);

  await assert.rejects(
    deployDeployHelperWorker({
      apiToken: 'cf-token',
      workerName: 'ce-helper',
      bundleSource: 'export default { async fetch() { return new Response("ok"); } };',
      fetchImpl: fetchMock,
      adminSecret: 'top-secret',
    }),
    /worker binding precondition failed/i,
  );
  assert.equal(fetchMock.calls.length, 3);
});

test('deployDeployHelperWorker generates an ADMIN_SECRET when one is not provided', async () => {
  const { deployDeployHelperWorker } = await loadModule();
  const fetchMock = makeFetchSequence([
    cfSuccess([{ id: 'account-123', name: 'Test Account' }]),
    cfSuccess([{ id: 'kv-123', title: 'ContextEngineDeployHelper:ce-helper' }]),
    cfSuccess({ id: 'worker-uploaded' }),
    cfSuccess({}),
    cfSuccess({ subdomain: 'tenant-subdomain', status: 'active' }),
    cfSuccess({ enabled: true }),
  ]);

  const result = await deployDeployHelperWorker({
    apiToken: 'cf-token',
    workerName: 'ce-helper',
    bundleSource: 'export default { async fetch() { return new Response("ok"); } };',
    fetchImpl: fetchMock,
  });

  assert.equal(result.ok, true);
  assert.equal(result.generatedAdminSecret, true);
  assert.match(result.adminSecret, /^[0-9a-f]{64}$/);

  const secretWrite = fetchMock.calls[3];
  assert.deepEqual(JSON.parse(secretWrite[1].body), {
    name: 'ADMIN_SECRET',
    type: 'secret_text',
    text: result.adminSecret,
  });
});

test('deployDeployHelperWorker uploads the bundled helper, reuses matching KV, and enables worker subdomain', async () => {
  const { deployDeployHelperWorker } = await loadModule();
  const fetchMock = makeFetchSequence([
    cfSuccess([{ id: 'account-123', name: 'Test Account' }]),
    cfSuccess([{ id: 'kv-123', title: 'ContextEngineDeployHelper:ce-helper' }]),
    cfSuccess({ id: 'worker-uploaded' }),
    cfSuccess({}),
    cfSuccess({ subdomain: 'tenant-subdomain', status: 'active' }),
    cfSuccess({ enabled: true }),
  ]);

  const result = await deployDeployHelperWorker({
    apiToken: 'cf-token',
    workerName: 'ce-helper',
    bundleSource: 'export default { async fetch() { return new Response("ok"); } };',
    allowedOrigins: ['https://app.example.test', 'http://localhost:3000'],
    fetchImpl: fetchMock,
    adminSecret: 'top-secret',
  });

  assert.equal(result.ok, true);
  assert.equal(result.accountId, 'account-123');
  assert.equal(result.kvNamespaceId, 'kv-123');
  assert.equal(result.reusedKvNamespace, true);
  assert.equal(result.workerUrl, 'https://ce-helper.tenant-subdomain.workers.dev/'); // intentional: real URL — tests worker URL construction
  assert.equal(result.generatedAdminSecret, false);

  const scriptUpload = fetchMock.calls[2];
  const uploadForm = scriptUpload[1].body;
  const metadataText = await new Response(uploadForm.get('metadata')).text();
  const metadata = JSON.parse(metadataText);
  assert.equal(metadata.main_module, 'worker.mjs');
  assert.deepEqual(metadata.bindings[0], {
    name: 'DEPLOY_HELPER_KV',
    type: 'kv_namespace',
    namespace_id: 'kv-123',
  });
  assert.deepEqual(metadata.bindings.find(({ name }) => name === 'CE_SESSION_COORDINATOR'), {
    name: 'CE_SESSION_COORDINATOR',
    type: 'durable_object_namespace',
    class_name: 'SessionWriteCoordinator',
  });
  assert.equal(metadata.bindings.some(({ name }) => name === 'ALLOWED_ORIGINS'), true);
  assert.deepEqual(metadata.migrations, {
    old_tag: '',
    new_tag: 'ce-session-write-coordinator-v1',
    new_sqlite_classes: ['SessionWriteCoordinator'],
  });

  const secretWrite = fetchMock.calls[3];
  assert.match(String(secretWrite[0]), /\/workers\/scripts\/ce-helper\/secrets$/);
  assert.deepEqual(JSON.parse(secretWrite[1].body), {
    name: 'ADMIN_SECRET',
    type: 'secret_text',
    text: 'top-secret',
  });
});

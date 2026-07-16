import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAdminRequest } from './adminRequestDispatch.js';
import { SessionWriteCoordinator } from './sessionWriteCoordinator.js';
import {
  decryptPayloadWithStorageEnvelope,
  encryptPayloadWithStorageEnvelope,
  rotateStorageEnvelopeKeys,
} from './storageEnvelopeEncryption.js';
import { storageRoute } from './storageRouteExecution.js';

const DEPLOYMENT_KEK = 'storage-atomicity-test-deployment-kek';
const ADMIN_ADDRESS = '0x0000000000000000000000000000000000000abc';
const FIXED_NOW = Date.parse('2026-07-15T12:00:00.000Z');

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...headers, 'Content-Type': 'application/json' },
});

const readJson = async (response) => JSON.parse(await response.text());

const cloneValue = (value) => (
  value === undefined ? undefined : structuredClone(value)
);

const createSequenceRandomBytes = (initial = 1) => {
  let seed = initial;
  return (length) => Uint8Array.from({ length }, () => {
    const value = seed % 251;
    seed += 1;
    return value;
  });
};

const createMemoryDurableStorage = () => {
  const values = new Map();
  let tail = Promise.resolve();
  const enqueue = (operation) => {
    const run = tail.then(operation);
    tail = run.catch(() => undefined);
    return run;
  };
  const cloneMap = (source) => new Map(
    [...source].map(([key, value]) => [key, cloneValue(value)]),
  );
  const view = (target) => ({
    get: async (key) => cloneValue(target.get(key)),
    put: async (key, value) => { target.set(key, cloneValue(value)); },
    delete: async (key) => target.delete(key),
    deleteAll: async () => { target.clear(); },
    list: async ({ prefix = '' } = {}) => new Map(
      [...target]
        .filter(([key]) => String(key).startsWith(prefix))
        .map(([key, value]) => [key, cloneValue(value)]),
    ),
  });
  const storage = {
    get: (key) => enqueue(() => view(values).get(key)),
    put: (key, value) => enqueue(() => view(values).put(key, value)),
    delete: (key) => enqueue(() => view(values).delete(key)),
    deleteAll: () => enqueue(() => view(values).deleteAll()),
    list: (options) => enqueue(() => view(values).list(options)),
    transaction: (callback) => enqueue(async () => {
      const staged = cloneMap(values);
      const result = await callback(view(staged));
      values.clear();
      for (const [key, value] of staged) values.set(key, value);
      return result;
    }),
  };
  return {
    storage,
    snapshot: () => enqueue(() => cloneMap(values)),
  };
};

const createCoordinatedEnv = (bindings = {}, { coordinatorDeps = {} } = {}) => {
  const env = { ...bindings };
  const objects = new Map();
  env.CE_SESSION_COORDINATOR = {
    idFromName: (name) => `memory-coordinator:${name}`,
    get: (id) => {
      if (!objects.has(id)) {
        const memory = createMemoryDurableStorage();
        const deps = typeof coordinatorDeps === 'function'
          ? coordinatorDeps(id)
          : coordinatorDeps;
        const instance = new SessionWriteCoordinator({ storage: memory.storage }, env, {
          ...deps,
          putSessionConfig: deps.putSessionConfig || ((...args) => {
            if (typeof env.__testProjectSessionConfig !== 'function') {
              throw new Error('Test session config projection is unavailable.');
            }
            return env.__testProjectSessionConfig(...args);
          }),
        });
        objects.set(id, {
          fetch: (input, init) => instance.fetch(
            input instanceof Request ? input : new Request(input, init),
          ),
        });
      }
      return objects.get(id);
    },
  };
  return env;
};

const bindConfigProjection = (env, project) => {
  env.__testProjectSessionConfig = async (_env, _slug, nextConfig) => project(nextConfig);
};

const classifyStorageKey = (key) => {
  const normalized = String(key);
  if (normalized.startsWith('sessions/')) return 'object';
  if (normalized.startsWith('ce-storage-payload:')) return 'payload';
  if (normalized.startsWith('ce-storage:')) return 'index';
  return 'other';
};

const storageIdFromKey = (key) => String(key).split(/[/:]/).at(-1);

const createFaultablePersistence = ({ topology, fault = null }) => {
  const r2Store = new Map();
  const kvStore = new Map();
  const attempts = [];
  let activeFault = fault;
  let faultFired = false;
  const maybeFail = ({ binding, key, phase }) => {
    const keyKind = classifyStorageKey(key);
    attempts.push({ binding, key: String(key), keyKind, phase });
    if (
      !faultFired &&
      activeFault?.binding === binding &&
      activeFault?.keyKind === keyKind &&
      activeFault?.phase === phase
    ) {
      faultFired = true;
      throw new Error(`injected ${binding} ${keyKind} ${phase} failure`);
    }
  };
  const r2 = {
    async put(key, value, options = {}) {
      maybeFail({ binding: 'r2', key, phase: 'before' });
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      r2Store.set(key, {
        bytes: new Uint8Array(bytes),
        httpMetadata: options.httpMetadata || {},
        customMetadata: options.customMetadata || {},
        async arrayBuffer() {
          return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        },
      });
      maybeFail({ binding: 'r2', key, phase: 'after' });
    },
    async get(key) {
      return r2Store.get(key) || null;
    },
  };
  const kv = {
    async put(key, value) {
      maybeFail({ binding: 'kv', key, phase: 'before' });
      kvStore.set(key, value);
      maybeFail({ binding: 'kv', key, phase: 'after' });
    },
    async get(key) {
      return kvStore.get(key) || null;
    },
    async list({ prefix = '' } = {}) {
      return {
        keys: [...kvStore.keys()]
          .filter((key) => key.startsWith(prefix))
          .sort()
          .map((name) => ({ name })),
        list_complete: true,
      };
    },
  };
  const bindings = topology === 'kv-only'
    ? { CE_STORAGE_INDEX_KV: kv }
    : topology === 'r2-only'
      ? { CE_STORAGE_R2: r2 }
      : { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
  return {
    attempts,
    bindings,
    kvStore,
    r2Store,
    get faultFired() { return faultFired; },
    armFault(nextFault) {
      activeFault = nextFault;
      faultFired = false;
    },
    firstTargetId() {
      const target = attempts.find((attempt) => (
        attempt.binding === activeFault?.binding &&
        attempt.keyKind === activeFault?.keyKind
      ));
      return target ? storageIdFromKey(target.key) : '';
    },
  };
};

const createCloudflareConfig = ({ encryption = 'none' } = {}) => ({
  slug: 'session-a',
  adminAddress: ADMIN_ADDRESS,
  storageProfile: {
    backend: 'cloudflare',
    payloadAccessControl: {
      gate: 'none',
      encryption,
    },
  },
});

const createUploadRequest = ({
  data = 'atomic payload',
  resource = 'docsContext',
  idempotencyKey = 'upload-attempt-a',
} = {}) => new Request('https://worker.example/storage/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data,
    contentType: 'text/plain',
    resource,
    idempotencyKey,
  }),
});

const upload = ({ env, config, request, randomBytes, putSessionConfig }) => {
  if (putSessionConfig) {
    bindConfigProjection(env, (nextConfig) => putSessionConfig(env, 'session-a', nextConfig));
  }
  return storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request,
    env,
    config,
    slug: 'session-a',
    uploaderAddress: ADMIN_ADDRESS,
    baseHeaders: {},
    deps: {
      json,
      randomBytes,
      now: () => FIXED_NOW,
    },
  });
};

const attemptUpload = async (options) => {
  try {
    return await upload(options);
  } catch {
    return null;
  }
};

const readStoredPayload = ({ env, config, id, suffix = '' }) => storageRoute({
  path: '/storage/read',
  method: 'GET',
  request: new Request(`https://worker.example/storage/read?id=${id}`),
  env,
  config,
  slug: 'session-a',
  uploaderAddress: ADMIN_ADDRESS,
  baseHeaders: {},
  deps: { json, randomUUID: () => `atomic-read${suffix}` },
});

const adminConfigWriters = [
  {
    name: 'set-config',
    action: 'set-config',
    body: { config: { sessionName: 'Atomic admin update' } },
    expected: 'Atomic admin update',
    read: (config) => config?.sessionName,
  },
  {
    name: 'set-limits',
    action: 'set-limits',
    body: { limits: { perIpPerHour: 8 } },
    expected: 8,
    read: (config) => config?.limits?.perIpPerHour,
  },
  {
    name: 'Lit credential merge',
    action: 'lit-chipotle-bootstrap-session',
    body: {},
    expected: 'bafy-atomic-lit-action',
    read: (config) => config?.litCredentials?.litActionCid,
  },
];

const dispatchAdminConfigWriter = async ({ writer, env, snapshot, persist }) => (
  bindConfigProjection(env, persist),
  dispatchAdminRequest({
    request: { json: async () => writer.body },
    env,
    baseHeaders: {},
    slug: 'session-a',
    action: writer.action,
    deps: {
      json,
      resolveAdminRequestAuthority: async () => ({
        ok: true,
        address: ADMIN_ADDRESS,
        existingConfig: snapshot,
        headers: {},
        targetSlug: 'session-a',
      }),
      getSessionSecrets: async () => ({}),
      putSessionSecrets: async () => undefined,
      bootstrapLitChipotleSession: async () => ({
        ok: true,
        litCredentials: { litActionCid: 'bafy-atomic-lit-action' },
        secretOutputs: {},
      }),
    },
  })
);

const decryptOutcome = async ({ env, config, payloadId, encrypted }) => {
  try {
    const plaintext = await decryptPayloadWithStorageEnvelope({
      env,
      config,
      slug: 'session-a',
      payloadId,
      ciphertextBytes: encrypted.ciphertextBytes,
      envelope: encrypted.envelope,
    });
    return new TextDecoder().decode(plaintext);
  } catch {
    return '<unreadable>';
  }
};

const minimalLegacySessionConfig = (config) => ({
  ...createCloudflareConfig({ encryption: 'worker_envelope' }),
  storageEnvelope: {
    sessionKey: {
      iv: config.storageEnvelope.sessionKey.iv,
      wrappedKey: config.storageEnvelope.sessionKey.wrappedKey,
    },
  },
});

const minimalLegacyPayloadEnvelope = (envelope) => ({
  encryption: 'worker_envelope',
  payloadIv: envelope.payloadIv,
  dek: {
    iv: envelope.dek.iv,
    wrappedKey: envelope.dek.wrappedKey,
  },
});

test('fault harness distinguishes durability phases and rolls back failed transactions', async () => {
  for (const phase of ['before', 'after']) {
    const persistence = createFaultablePersistence({
      topology: 'kv-only',
      fault: { binding: 'kv', keyKind: 'payload', phase },
    });
    const key = `ce-storage-payload:session-a:harness-${phase}`;
    await assert.rejects(
      persistence.bindings.CE_STORAGE_INDEX_KV.put(key, 'first'),
      new RegExp(`${phase} failure`),
    );
    assert.equal(persistence.kvStore.has(key), phase === 'after');
  }

  const memory = createMemoryDurableStorage();
  await memory.storage.put('candidate', { version: 1, wrappedKey: 'wrapped-candidate-a' });
  await assert.rejects(memory.storage.transaction(async (transaction) => {
    await transaction.put('candidate', { version: 1, wrappedKey: 'wrapped-candidate-b' });
    throw new Error('rollback');
  }), /rollback/);
  await memory.storage.put('counter', 0);
  await Promise.all([0, 1].map(() => memory.storage.transaction(async (transaction) => {
    const current = await transaction.get('counter');
    await transaction.put('counter', current + 1);
  })));
  assert.deepEqual(
    Object.fromEntries(await memory.snapshot()),
    {
      candidate: { version: 1, wrappedKey: 'wrapped-candidate-a' },
      counter: 2,
    },
  );
});

test('concurrent first worker-envelope uploads remain readable through the production route', async () => {
  const persistence = createFaultablePersistence({ topology: 'kv-only' });
  const env = createCoordinatedEnv({
    ...persistence.bindings,
    CE_STORAGE_ENVELOPE_KEK: DEPLOYMENT_KEK,
  });
  const initialConfig = createCloudflareConfig({ encryption: 'worker_envelope' });
  let durableConfig = initialConfig;
  const putSessionConfig = async (_env, _slug, nextConfig) => {
    durableConfig = nextConfig;
  };

  // Both requests receive one keyless snapshot. There is deliberately no
  // two-writer barrier: a correct get-or-create may project only the winner.
  const responses = await Promise.all([
    upload({
      env,
      config: initialConfig,
      request: createUploadRequest({ data: 'route alpha', idempotencyKey: 'route-alpha' }),
      randomBytes: createSequenceRandomBytes(41),
      putSessionConfig,
    }),
    upload({
      env,
      config: initialConfig,
      request: createUploadRequest({ data: 'route beta', idempotencyKey: 'route-beta' }),
      randomBytes: createSequenceRandomBytes(141),
      putSessionConfig,
    }),
  ]);
  const bodies = await Promise.all(responses.map(readJson));
  const reads = await Promise.all(bodies.map((body, index) => (
    readStoredPayload({ env, config: durableConfig, id: body.id, suffix: `-${index}` })
  )));

  assert.deepEqual({
    uploadStatuses: responses.map((response) => response.status),
    idsAreDistinct: bodies[0].id !== bodies[1].id,
    readStatuses: reads.map((response) => response.status),
    plaintexts: await Promise.all(reads.map(async (response) => (
      response.status === 200 ? response.text() : '<unreadable>'
    ))),
  }, {
    uploadStatuses: [200, 200],
    idsAreDistinct: true,
    readStatuses: [200, 200],
    plaintexts: ['route alpha', 'route beta'],
  });
});

test('same-key replay is idempotent and a different key creates a new payload', async () => {
  const persistence = createFaultablePersistence({ topology: 'r2-and-kv' });
  const env = createCoordinatedEnv(persistence.bindings);
  const config = createCloudflareConfig();
  const randomBytes = createSequenceRandomBytes(11);

  const firstResponse = await upload({
    env,
    config,
    request: createUploadRequest({ resource: 'questions' }),
    randomBytes,
  });
  const firstBody = await readJson(firstResponse);
  const replayResponse = await upload({
    env,
    config,
    request: createUploadRequest({ resource: 'questions' }),
    randomBytes,
  });
  const replayBody = await readJson(replayResponse);
  const differentResponse = await upload({
    env,
    config,
    request: createUploadRequest({
      resource: 'questions',
      idempotencyKey: 'upload-attempt-b',
    }),
    randomBytes,
  });
  const differentBody = await readJson(differentResponse);
  const indexKeys = [...persistence.kvStore.keys()].filter((key) => (
    key.startsWith('ce-storage:session-a:questions:')
  ));

  assert.deepEqual({
    statuses: [firstResponse.status, replayResponse.status, differentResponse.status],
    replayId: replayBody.id,
    firstId: firstBody.id,
    differentKeyIsDistinct: differentBody.id !== firstBody.id,
    objectCount: persistence.r2Store.size,
    indexCount: indexKeys.length,
  }, {
    statuses: [200, 200, 200],
    replayId: firstBody.id,
    firstId: firstBody.id,
    differentKeyIsDistinct: true,
    objectCount: 2,
    indexCount: 2,
  });
});

const supportedUploadFaultScenarios = [
  ...['before', 'after'].map((phase) => ({
    topology: 'kv-only',
    binding: 'kv',
    keyKind: 'payload',
    phase,
  })),
  ...['before', 'after'].map((phase) => ({
    topology: 'kv-only',
    binding: 'kv',
    keyKind: 'index',
    phase,
  })),
  ...['before', 'after'].map((phase) => ({
    topology: 'r2-and-kv',
    binding: 'r2',
    keyKind: 'object',
    phase,
  })),
  ...['before', 'after'].map((phase) => ({
    topology: 'r2-and-kv',
    binding: 'kv',
    keyKind: 'index',
    phase,
  })),
];

for (const scenario of supportedUploadFaultScenarios) {
  const label = `${scenario.topology} ${scenario.keyKind} ${scenario.phase}`;
  test(`same-key retry repairs ${label}-write failure`, async () => {
    const persistence = createFaultablePersistence({
      topology: scenario.topology,
      fault: scenario,
    });
    const env = createCoordinatedEnv(persistence.bindings);
    const config = createCloudflareConfig();
    const randomBytes = createSequenceRandomBytes(61);

    await attemptUpload({
      env,
      config,
      request: createUploadRequest({ resource: 'questions' }),
      randomBytes,
    });
    const firstId = persistence.firstTargetId();
    assert.equal(persistence.faultFired, true);
    assert.match(firstId, /^[A-Za-z0-9_-]{43}$/);

    const retryResponse = await upload({
      env,
      config,
      request: createUploadRequest({ resource: 'questions' }),
      randomBytes,
    });
    const retryBody = await readJson(retryResponse);
    const objectKeys = [...persistence.r2Store.keys()].filter((key) => key.startsWith('sessions/'));
    const payloadKeys = [...persistence.kvStore.keys()].filter((key) => (
      key.startsWith('ce-storage-payload:')
    ));
    const indexKeys = [...persistence.kvStore.keys()].filter((key) => (
      key.startsWith('ce-storage:')
    ));
    const physicalIds = new Set(
      [...objectKeys, ...payloadKeys, ...indexKeys].map(storageIdFromKey),
    );
    const readResponse = await readStoredPayload({ env, config, id: firstId });
    const listResponse = await storageRoute({
      path: '/storage/list',
      method: 'GET',
      request: new Request('https://worker.example/storage/list?resource=questions'),
      env,
      config,
      slug: 'session-a',
      uploaderAddress: ADMIN_ADDRESS,
      baseHeaders: {},
      deps: { json },
    });
    const listed = await readJson(listResponse);

    assert.deepEqual({
      retryStatus: retryResponse.status,
      returnedId: retryBody.id,
      physicalIds: [...physicalIds],
      payloadCount: scenario.topology === 'kv-only' ? payloadKeys.length : objectKeys.length,
      indexCount: indexKeys.length,
      readStatus: readResponse.status,
      plaintext: readResponse.status === 200 ? await readResponse.text() : '<unreadable>',
      listedIds: listed.items?.map((item) => item.storageRef?.id),
    }, {
      retryStatus: 200,
      returnedId: firstId,
      physicalIds: [firstId],
      payloadCount: 1,
      indexCount: 1,
      readStatus: 200,
      plaintext: 'atomic payload',
      listedIds: [firstId],
    });
  });
}

test('worker-envelope retry repairs an R2 index failure at the original readable ID', async () => {
  const scenario = {
    topology: 'r2-and-kv',
    binding: 'kv',
    keyKind: 'index',
    phase: 'before',
  };
  const persistence = createFaultablePersistence({
    topology: scenario.topology,
    fault: scenario,
  });
  const env = createCoordinatedEnv({
    ...persistence.bindings,
    CE_STORAGE_ENVELOPE_KEK: DEPLOYMENT_KEK,
  });
  let durableConfig = createCloudflareConfig({ encryption: 'worker_envelope' });
  bindConfigProjection(env, (nextConfig) => { durableConfig = nextConfig; });
  await encryptPayloadWithStorageEnvelope({
    env,
    config: durableConfig,
    slug: 'session-a',
    payloadId: 'key-primer',
    plaintextBytes: new TextEncoder().encode('key primer'),
    contentType: 'text/plain',
    deps: {
      randomBytes: createSequenceRandomBytes(221),
      putSessionConfig: async (_env, _slug, nextConfig) => { durableConfig = nextConfig; },
    },
  });
  const randomBytes = createSequenceRandomBytes(231);
  await attemptUpload({
    env,
    config: durableConfig,
    request: createUploadRequest({ data: 'encrypted recovery' }),
    randomBytes,
    putSessionConfig: async (_env, _slug, nextConfig) => { durableConfig = nextConfig; },
  });
  const firstId = persistence.firstTargetId();
  const retryResponse = await upload({
    env,
    config: durableConfig,
    request: createUploadRequest({ data: 'encrypted recovery' }),
    randomBytes,
    putSessionConfig: async (_env, _slug, nextConfig) => { durableConfig = nextConfig; },
  });
  const retryBody = await readJson(retryResponse);
  const readResponse = await readStoredPayload({
    env,
    config: durableConfig,
    id: firstId,
    suffix: '-encrypted',
  });

  assert.deepEqual({
    retryStatus: retryResponse.status,
    returnedId: retryBody.id,
    objectCount: persistence.r2Store.size,
    indexCount: [...persistence.kvStore.keys()]
      .filter((key) => key.startsWith('ce-storage:')).length,
    readStatus: readResponse.status,
    plaintext: readResponse.status === 200 ? await readResponse.text() : '<unreadable>',
  }, {
    retryStatus: 200,
    returnedId: firstId,
    objectCount: 1,
    indexCount: 1,
    readStatus: 200,
    plaintext: 'encrypted recovery',
  });
});

test('R2-only worker-envelope upload fails closed without creating an object', async () => {
  const persistence = createFaultablePersistence({ topology: 'r2-only' });
  const env = createCoordinatedEnv({
    ...persistence.bindings,
    CE_STORAGE_ENVELOPE_KEK: DEPLOYMENT_KEK,
  });
  let configProjectionCount = 0;
  const response = await upload({
    env,
    config: createCloudflareConfig({ encryption: 'worker_envelope' }),
    request: createUploadRequest(),
    randomBytes: createSequenceRandomBytes(81),
    putSessionConfig: async () => { configProjectionCount += 1; },
  });

  assert.deepEqual({
    failedClosed: response.status >= 500,
    configProjectionCount,
    objectCount: persistence.r2Store.size,
    persistenceWriteAttempts: persistence.attempts.length,
  }, {
    failedClosed: true,
    configProjectionCount: 0,
    objectCount: 0,
    persistenceWriteAttempts: 0,
  });
});

test('first-use config projection failure leaves a readable retry', async () => {
  const persistence = createFaultablePersistence({ topology: 'kv-only' });
  const env = createCoordinatedEnv({
    ...persistence.bindings,
    CE_STORAGE_ENVELOPE_KEK: DEPLOYMENT_KEK,
  });
  const initialConfig = createCloudflareConfig({ encryption: 'worker_envelope' });
  let durableConfig = initialConfig;
  let faultFired = false;
  const putSessionConfig = async (_env, _slug, nextConfig) => {
    if (!faultFired) {
      faultFired = true;
      throw new Error('injected config projection failure');
    }
    durableConfig = nextConfig;
  };

  const failedResponse = await attemptUpload({
    env,
    config: initialConfig,
    request: createUploadRequest(),
    randomBytes: createSequenceRandomBytes(101),
    putSessionConfig,
  });
  const retryResponse = await upload({
    env,
    config: durableConfig,
    request: createUploadRequest(),
    randomBytes: createSequenceRandomBytes(121),
    putSessionConfig,
  });
  const retryBody = await readJson(retryResponse);
  const readResponse = await readStoredPayload({
    env,
    config: durableConfig,
    id: retryBody.id,
    suffix: '-config',
  });

  assert.deepEqual({
    faultFired,
    firstFailed: failedResponse === null || failedResponse.status >= 500,
    retryStatus: retryResponse.status,
    payloadCount: [...persistence.kvStore.keys()]
      .filter((key) => key.startsWith('ce-storage-payload:')).length,
    indexCount: [...persistence.kvStore.keys()]
      .filter((key) => key.startsWith('ce-storage:')).length,
    readStatus: readResponse.status,
    plaintext: readResponse.status === 200 ? await readResponse.text() : '<unreadable>',
  }, {
    faultFired: true,
    firstFailed: true,
    retryStatus: 200,
    payloadCount: 1,
    indexCount: 1,
    readStatus: 200,
    plaintext: 'atomic payload',
  });
});

test('interrupted rotation preserves readability and succeeds on retry', async () => {
  const persistence = createFaultablePersistence({ topology: 'kv-only' });
  const env = createCoordinatedEnv({
    ...persistence.bindings,
    CE_STORAGE_ENVELOPE_KEK: DEPLOYMENT_KEK,
  });
  let durableConfig = createCloudflareConfig({ encryption: 'worker_envelope' });
  const uploadResponse = await upload({
    env,
    config: durableConfig,
    request: createUploadRequest({ data: 'rotation payload' }),
    randomBytes: createSequenceRandomBytes(241),
    putSessionConfig: async (_env, _slug, nextConfig) => { durableConfig = nextConfig; },
  });
  const uploadBody = await readJson(uploadResponse);
  let configFaultFired = false;
  bindConfigProjection(env, (nextConfig) => {
    if (!configFaultFired) {
      configFaultFired = true;
      throw new Error('injected config before-write failure');
    }
    durableConfig = nextConfig;
  });
  try {
    await rotateStorageEnvelopeKeys({
      env,
      slug: 'session-a',
      config: durableConfig,
      deps: {
        randomBytes: createSequenceRandomBytes(201),
        now: () => Date.parse('2026-07-15T13:00:00.000Z'),
      },
    });
  } catch {
    // The durable invariant below is the contract, independent of error shape.
  }
  const immediate = await readStoredPayload({
    env,
    config: durableConfig,
    id: uploadBody.id,
    suffix: '-interrupted',
  });
  let retrySucceeded = true;
  try {
    await rotateStorageEnvelopeKeys({
      env,
      slug: 'session-a',
      config: durableConfig,
      deps: {
        randomBytes: createSequenceRandomBytes(221),
        now: () => Date.parse('2026-07-15T14:00:00.000Z'),
      },
    });
  } catch {
    retrySucceeded = false;
  }
  const recovered = await readStoredPayload({
    env,
    config: durableConfig,
    id: uploadBody.id,
    suffix: '-recovered',
  });

  assert.deepEqual({
    configFaultFired,
    immediateStatus: immediate.status,
    immediatePlaintext: immediate.status === 200 ? await immediate.text() : '<unreadable>',
    retrySucceeded,
    recoveredStatus: recovered.status,
    recoveredPlaintext: recovered.status === 200 ? await recovered.text() : '<unreadable>',
  }, {
    configFaultFired: true,
    immediateStatus: 200,
    immediatePlaintext: 'rotation payload',
    retrySucceeded: true,
    recoveredStatus: 200,
    recoveredPlaintext: 'rotation payload',
  });
});

test('whole-config writers preserve first-use envelope keys and their own updates', async () => {
  const outcomes = [];
  for (const [index, writer] of adminConfigWriters.entries()) {
    const initialConfig = createCloudflareConfig({ encryption: 'worker_envelope' });

    const afterEnv = createCoordinatedEnv({ CE_STORAGE_ENVELOPE_KEK: DEPLOYMENT_KEK });
    let afterConfig = initialConfig;
    bindConfigProjection(afterEnv, (nextConfig) => { afterConfig = nextConfig; });
    const afterPayloadId = `admin-after-first-use-${index}`;
    const afterEncrypted = await encryptPayloadWithStorageEnvelope({
      env: afterEnv,
      config: initialConfig,
      slug: 'session-a',
      payloadId: afterPayloadId,
      plaintextBytes: new TextEncoder().encode('admin after first use'),
      contentType: 'text/plain',
      deps: {
        randomBytes: createSequenceRandomBytes(131 + (index * 10)),
        putSessionConfig: async (_env, _slug, nextConfig) => { afterConfig = nextConfig; },
      },
    });
    const afterResponse = await dispatchAdminConfigWriter({
      writer,
      env: afterEnv,
      snapshot: structuredClone(initialConfig),
      persist: (nextConfig) => { afterConfig = nextConfig; },
    });

    const beforeEnv = createCoordinatedEnv({ CE_STORAGE_ENVELOPE_KEK: DEPLOYMENT_KEK });
    let beforeConfig = initialConfig;
    const beforeResponse = await dispatchAdminConfigWriter({
      writer,
      env: beforeEnv,
      snapshot: initialConfig,
      persist: (nextConfig) => { beforeConfig = nextConfig; },
    });
    const beforePayloadId = `first-use-after-admin-${index}`;
    const beforeEncrypted = await encryptPayloadWithStorageEnvelope({
      env: beforeEnv,
      config: initialConfig,
      slug: 'session-a',
      payloadId: beforePayloadId,
      plaintextBytes: new TextEncoder().encode('first use after admin'),
      contentType: 'text/plain',
      deps: {
        randomBytes: createSequenceRandomBytes(171 + (index * 10)),
        putSessionConfig: async (_env, _slug, nextConfig) => { beforeConfig = nextConfig; },
      },
    });

    outcomes.push({
      writer: writer.name,
      after: {
        status: afterResponse.status,
        adminValue: writer.read(afterConfig),
        hasEnvelopeKey: !!afterConfig.storageEnvelope?.sessionKey,
        plaintext: await decryptOutcome({
          env: afterEnv,
          config: afterConfig,
          payloadId: afterPayloadId,
          encrypted: afterEncrypted,
        }),
      },
      before: {
        status: beforeResponse.status,
        adminValue: writer.read(beforeConfig),
        hasEnvelopeKey: !!beforeConfig.storageEnvelope?.sessionKey,
        plaintext: await decryptOutcome({
          env: beforeEnv,
          config: beforeConfig,
          payloadId: beforePayloadId,
          encrypted: beforeEncrypted,
        }),
      },
    });
  }

  assert.deepEqual(outcomes, adminConfigWriters.map((writer) => ({
    writer: writer.name,
    after: {
      status: 200,
      adminValue: writer.expected,
      hasEnvelopeKey: true,
      plaintext: 'admin after first use',
    },
    before: {
      status: 200,
      adminValue: writer.expected,
      hasEnvelopeKey: true,
      plaintext: 'first use after admin',
    },
  })));
});

test('minimal legacy envelope records remain readable through the previous deployment KEK', async () => {
  const oldKek = 'storage-atomicity-test-legacy-old-kek';
  const encryptEnv = createCoordinatedEnv({ CE_STORAGE_ENVELOPE_KEK: oldKek });
  const initialConfig = createCloudflareConfig({ encryption: 'worker_envelope' });
  let persistedConfig = initialConfig;
  bindConfigProjection(encryptEnv, (nextConfig) => { persistedConfig = nextConfig; });
  const encrypted = await encryptPayloadWithStorageEnvelope({
    env: encryptEnv,
    config: initialConfig,
    slug: 'session-a',
    payloadId: 'legacy-payload',
    plaintextBytes: new TextEncoder().encode('legacy readable payload'),
    contentType: 'text/plain',
    deps: {
      randomBytes: createSequenceRandomBytes(211),
      now: () => Date.parse('2025-01-01T00:00:00.000Z'),
      putSessionConfig: async (_env, _slug, nextConfig) => { persistedConfig = nextConfig; },
    },
  });
  const decryptEnv = createCoordinatedEnv({
    CE_STORAGE_ENVELOPE_KEK: 'storage-atomicity-test-legacy-new-kek',
    CE_STORAGE_ENVELOPE_PREVIOUS_KEK: oldKek,
  });
  const plaintext = await decryptPayloadWithStorageEnvelope({
    env: decryptEnv,
    config: minimalLegacySessionConfig(persistedConfig),
    slug: 'session-a',
    payloadId: 'legacy-payload',
    ciphertextBytes: encrypted.ciphertextBytes,
    envelope: minimalLegacyPayloadEnvelope(encrypted.envelope),
  });

  assert.equal(new TextDecoder().decode(plaintext), 'legacy readable payload');
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAdminRequest } from './adminRequestDispatch.js';
import { SessionWriteCoordinator } from './sessionWriteCoordinator.js';
import {
  decryptPayloadWithStorageEnvelope,
  encryptPayloadWithStorageEnvelope,
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
} = {}) => new Request('https://worker.example/storage/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data,
    contentType: 'text/plain',
    resource: 'docsContext',
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
      request: createUploadRequest({ data: 'route alpha' }),
      randomBytes: createSequenceRandomBytes(41),
      putSessionConfig,
    }),
    upload({
      env,
      config: initialConfig,
      request: createUploadRequest({ data: 'route beta' }),
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

const atLeastOnceFaultScenarios = [
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
    encryption: 'worker_envelope',
  })),
];

for (const scenario of atLeastOnceFaultScenarios) {
  const label = `${scenario.topology} ${scenario.keyKind} ${scenario.phase}`;
  test(`at-least-once retry is readable after ${label}-write failure`, async () => {
    const persistence = createFaultablePersistence({
      topology: scenario.topology,
      fault: scenario,
    });
    const env = createCoordinatedEnv({
      ...persistence.bindings,
      ...(scenario.encryption === 'worker_envelope'
        ? { CE_STORAGE_ENVELOPE_KEK: DEPLOYMENT_KEK }
        : {}),
    });
    const initialConfig = createCloudflareConfig({ encryption: scenario.encryption || 'none' });
    let durableConfig = initialConfig;
    const putSessionConfig = async (_env, _slug, nextConfig) => {
      durableConfig = nextConfig;
    };
    const randomBytes = createSequenceRandomBytes(61);

    await assert.rejects(upload({
      env,
      config: durableConfig,
      request: createUploadRequest(),
      randomBytes,
      ...(scenario.encryption === 'worker_envelope' ? { putSessionConfig } : {}),
    }), /injected .* failure/);
    assert.equal(persistence.faultFired, true);

    const retryResponse = await upload({
      env,
      config: durableConfig,
      request: createUploadRequest(),
      randomBytes,
      ...(scenario.encryption === 'worker_envelope' ? { putSessionConfig } : {}),
    });
    const retryBody = await readJson(retryResponse);
    const visibleRows = [...persistence.kvStore]
      .filter(([key]) => classifyStorageKey(key) === 'index')
      .map(([, value]) => JSON.parse(value));
    const visibleReads = await Promise.all(visibleRows.map((row, index) => readStoredPayload({
      env,
      config: durableConfig,
      id: row.id,
      suffix: `-${scenario.keyKind}-${scenario.phase}-${index}`,
    })));
    const plaintexts = await Promise.all(visibleReads.map(async (response) => (
      response.status === 200 ? response.text() : '<unreadable>'
    )));
    const physicalPayloadCount = scenario.topology === 'kv-only'
      ? [...persistence.kvStore.keys()].filter((key) => classifyStorageKey(key) === 'payload').length
      : persistence.r2Store.size;
    const firstPayloadWasDurable = !['payload', 'object'].includes(scenario.keyKind) ||
      scenario.phase === 'after';
    const expectedPhysicalPayloadCount = firstPayloadWasDurable ? 2 : 1;
    const expectedVisibleCount = scenario.keyKind === 'index' && scenario.phase === 'after' ? 2 : 1;

    assert.deepEqual({
      retryStatus: retryResponse.status,
      retryIsVisible: visibleRows.some((row) => row.id === retryBody.id),
      visibleCount: visibleRows.length,
      readableCount: visibleReads.filter((response) => response.status === 200).length,
      plaintexts,
      physicalPayloadCount,
      orphanCount: physicalPayloadCount - visibleRows.length,
    }, {
      retryStatus: 200,
      retryIsVisible: true,
      visibleCount: expectedVisibleCount,
      readableCount: expectedVisibleCount,
      plaintexts: Array(expectedVisibleCount).fill('atomic payload'),
      physicalPayloadCount: expectedPhysicalPayloadCount,
      orphanCount: expectedPhysicalPayloadCount - expectedVisibleCount,
    });
  });
}

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

test('previous deployment KEK preserves wrapped key bytes across new legacy-envelope writes', async () => {
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
  const legacyConfig = minimalLegacySessionConfig(persistedConfig);
  const fallbackEnv = createCoordinatedEnv({
    CE_STORAGE_ENVELOPE_KEK: 'storage-atomicity-test-legacy-new-kek',
    CE_STORAGE_ENVELOPE_PREVIOUS_KEK: oldKek,
  });
  let projectedConfig = null;
  bindConfigProjection(fallbackEnv, (nextConfig) => { projectedConfig = nextConfig; });
  const laterEncrypted = await encryptPayloadWithStorageEnvelope({
    env: fallbackEnv,
    config: legacyConfig,
    slug: 'session-a',
    payloadId: 'later-legacy-payload',
    plaintextBytes: new TextEncoder().encode('later legacy payload'),
    contentType: 'text/plain',
    deps: {
      randomBytes: createSequenceRandomBytes(231),
      now: () => Date.parse('2025-01-02T00:00:00.000Z'),
    },
  });
  assert.equal(
    laterEncrypted.config.storageEnvelope.sessionKey.iv,
    legacyConfig.storageEnvelope.sessionKey.iv,
  );
  assert.equal(
    laterEncrypted.config.storageEnvelope.sessionKey.wrappedKey,
    legacyConfig.storageEnvelope.sessionKey.wrappedKey,
  );
  assert.deepEqual(projectedConfig, laterEncrypted.config);

  const restoredEnv = createCoordinatedEnv({ CE_STORAGE_ENVELOPE_KEK: oldKek });
  const plaintext = await decryptPayloadWithStorageEnvelope({
    env: restoredEnv,
    config: laterEncrypted.config,
    slug: 'session-a',
    payloadId: 'legacy-payload',
    ciphertextBytes: encrypted.ciphertextBytes,
    envelope: minimalLegacyPayloadEnvelope(encrypted.envelope),
  });
  const laterPlaintext = await decryptPayloadWithStorageEnvelope({
    env: restoredEnv,
    config: laterEncrypted.config,
    slug: 'session-a',
    payloadId: 'later-legacy-payload',
    ciphertextBytes: laterEncrypted.ciphertextBytes,
    envelope: minimalLegacyPayloadEnvelope(laterEncrypted.envelope),
  });

  assert.equal(new TextDecoder().decode(plaintext), 'legacy readable payload');
  assert.equal(new TextDecoder().decode(laterPlaintext), 'later legacy payload');
});

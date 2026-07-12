import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTelegramResponseExportArchive,
  deriveTelegramResponseExportAccount,
  resolveResponseExportScope,
} from './telegramResponseExport.mjs';

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const createActionKv = (entries = {}) => {
  const store = new Map(Object.entries(entries));
  return {
    async list({ prefix = '' } = {}) {
      return {
        keys: [...store.keys()]
          .filter((name) => name.startsWith(prefix))
          .map((name) => ({ name })),
      };
    },
    async get(key) { return store.get(key) || null; },
  };
};

test('resolveResponseExportScope reads compiled session profile export scope', () => {
  assert.equal(resolveResponseExportScope({
    sessionModeProfile: {
      export: { scope: 'encrypted_envelopes_only' },
    },
  }), 'encrypted_envelopes_only');
  assert.equal(resolveResponseExportScope({}), 'all_session');
});

test('buildTelegramResponseExportArchive exports envelopes without decrypting Telegram payloads', async () => {
  const createdAt = '2026-01-02T03:04:05.000Z';
  const normalized = {
    user: {
      telegramUserId: '10001',
      username: 'tester',
    },
  };
  const env = {
    AGENT_ACTION_KV: createActionKv({
      'telegram:submit-request-by-session:v1:alpha:req-1': JSON.stringify({
        type: 'telegram_submit_record',
        requestId: 'req-1',
        action: 'submit_response',
        status: 'direct_submitted',
        lane: 'telegram',
        telegramUserId: '10001',
        chatId: '20002',
        sessionSlug: 'alpha',
        questionId: 'question-1',
        questionIdShort: 'Q1',
        answer: {
          text: 'plaintext answer should not export',
        },
        onChain: {
          ok: true,
          storageId: 'response-1',
          storageRef: { backend: 'cloudflare', id: 'response-1', resource: 'responses' },
          responseHash: '0xhash',
          chainId: 11155420,
        },
        createdAt,
      }),
    }),
    AGENT_BRIDGE_DEPLOYMENT_ID: 'test-bridge',
    DEMO_SIGNER_ROOT_SECRET: 'test bridge root secret',
  };
  const account = await deriveTelegramResponseExportAccount({ env, normalized, createdAt });
  const session = {
    sessionSlug: 'alpha',
    sessionName: 'Alpha',
    sessionWorkerUrl: 'https://worker.example',
    workerLoginOrigin: 'https://contextengine.example',
    responseExportAllowedAddresses: [account.accountAddress],
    sessionModeProfile: {
      export: { scope: 'encrypted_envelopes_only' },
    },
  };
  const fetchCalls = [];
  const fetchImpl = async (url) => {
    fetchCalls.push(String(url));
    if (String(url).endsWith('/auth/nonce')) {
      return jsonResponse({ nonce: 'abcdef123456' });
    }
    if (String(url).endsWith('/auth/login')) {
      return jsonResponse({ token: 'worker-token' });
    }
    if (String(url).endsWith('/storage/export-envelopes?resource=responses')) {
      return jsonResponse({
        ok: true,
        manifest: {
          type: 'ce_storage_encrypted_envelopes_export',
          exportScope: 'encrypted_envelopes_only',
          storageBackend: 'cloudflare',
          encryptedPayloadCount: 1,
          exportedPayloadCount: 1,
          partial: false,
          readErrors: [],
          wrappedKeysIncluded: true,
          keyProvider: 'worker_secret',
          rewrapRequiredForNewDeployment: true,
        },
        payloads: [{
          storageRef: { backend: 'cloudflare', id: 'response-1', resource: 'responses' },
          metadata: {
            id: 'response-1',
            resource: 'responses',
            payloadAccessControl: { gate: 'none', encryption: 'worker_envelope' },
          },
          envelope: {
            encryption: 'worker_envelope',
            dek: { wrappedKey: 'wrapped-dek' },
          },
          ciphertextBase64url: 'Y2lwaGVydGV4dA',
          keyProvider: 'worker_secret',
          wrappedKeysIncluded: true,
        }],
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const archive = await buildTelegramResponseExportArchive({
    env,
    normalized,
    session,
    createdAt,
    fetchImpl,
  });

  assert.equal(archive.ok, true);
  assert.equal(archive.exportedPayloadCount, 1);
  assert.equal(fetchCalls.some((url) => url.includes('/storage/export-envelopes?resource=responses')), true);
  assert.equal(fetchCalls.some((url) => url.includes('/storage/read')), false);
  assert.equal(fetchCalls.some((url) => url.includes('/storage/list')), false);
  assert.doesNotMatch(
    new TextDecoder().decode(archive.document.bytes),
    /plaintext answer should not export/
  );
});

test('buildTelegramResponseExportArchive fails closed when encrypted envelope export is unavailable', async () => {
  const createdAt = '2026-01-02T03:04:05.000Z';
  const normalized = {
    user: {
      telegramUserId: '10001',
      username: 'tester',
    },
  };
  const env = {
    AGENT_ACTION_KV: createActionKv({
      'telegram:submit-request-by-session:v1:alpha:req-1': JSON.stringify({
        type: 'telegram_submit_record',
        requestId: 'req-1',
        status: 'direct_submitted',
        sessionSlug: 'alpha',
        questionId: 'question-1',
        answer: { text: 'plaintext fallback must not export' },
        onChain: { ok: true, storageId: 'response-1' },
        createdAt,
      }),
    }),
    AGENT_BRIDGE_DEPLOYMENT_ID: 'test-bridge',
    DEMO_SIGNER_ROOT_SECRET: 'test bridge root secret',
  };
  const account = await deriveTelegramResponseExportAccount({ env, normalized, createdAt });
  const session = {
    sessionSlug: 'alpha',
    sessionName: 'Alpha',
    sessionWorkerUrl: 'https://worker.example',
    workerLoginOrigin: 'https://contextengine.example',
    responseExportAllowedAddresses: [account.accountAddress],
    exportScope: 'encrypted_envelopes_only',
  };
  const fetchCalls = [];
  const fetchImpl = async (url) => {
    fetchCalls.push(String(url));
    if (String(url).endsWith('/auth/nonce')) return jsonResponse({ nonce: 'abcdef123456' });
    if (String(url).endsWith('/auth/login')) return jsonResponse({ token: 'worker-token' });
    if (String(url).endsWith('/storage/export-envelopes?resource=responses')) {
      return jsonResponse({ error: 'export unavailable' }, 503);
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const archive = await buildTelegramResponseExportArchive({
    env,
    normalized,
    session,
    createdAt,
    fetchImpl,
  });

  assert.equal(archive.ok, false);
  assert.equal(archive.exportScope, 'encrypted_envelopes_only');
  assert.equal(archive.reason, 'export unavailable');
  assert.equal(Object.hasOwn(archive, 'document'), false);
  assert.equal(fetchCalls.some((url) => url.includes('/storage/read')), false);
  assert.equal(fetchCalls.some((url) => url.includes('/storage/list')), false);
});

test('buildTelegramResponseExportArchive does not synthesize plaintext for empty envelope exports', async () => {
  const createdAt = '2026-01-02T03:04:05.000Z';
  const normalized = { user: { telegramUserId: '10001' } };
  const env = {
    AGENT_ACTION_KV: createActionKv({
      'telegram:submit-request-by-session:v1:alpha:req-1': JSON.stringify({
        requestId: 'req-1',
        status: 'direct_submitted',
        sessionSlug: 'alpha',
        answer: { text: 'plaintext empty export must not synthesize' },
        createdAt,
      }),
    }),
    AGENT_BRIDGE_DEPLOYMENT_ID: 'test-bridge',
    DEMO_SIGNER_ROOT_SECRET: 'test bridge root secret',
  };
  const account = await deriveTelegramResponseExportAccount({ env, normalized, createdAt });
  const session = {
    sessionSlug: 'alpha',
    sessionWorkerUrl: 'https://worker.example',
    workerLoginOrigin: 'https://contextengine.example',
    responseExportAllowedAddresses: [account.accountAddress],
    exportScope: 'encrypted_envelopes_only',
  };
  const fetchImpl = async (url) => {
    if (String(url).endsWith('/auth/nonce')) return jsonResponse({ nonce: 'abcdef123456' });
    if (String(url).endsWith('/auth/login')) return jsonResponse({ token: 'worker-token' });
    if (String(url).endsWith('/storage/export-envelopes?resource=responses')) {
      return jsonResponse({
        ok: true,
        manifest: {
          exportScope: 'encrypted_envelopes_only',
          encryptedPayloadCount: 0,
          exportedPayloadCount: 0,
          partial: false,
          readErrors: [],
          wrappedKeysIncluded: false,
          keyProvider: 'worker_secret',
          rewrapRequiredForNewDeployment: true,
        },
        payloads: [],
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const archive = await buildTelegramResponseExportArchive({ env, normalized, session, createdAt, fetchImpl });

  assert.equal(archive.ok, true);
  assert.equal(archive.exportedPayloadCount, 0);
  assert.doesNotMatch(
    new TextDecoder().decode(archive.document.bytes),
    /plaintext empty export must not synthesize/
  );
});

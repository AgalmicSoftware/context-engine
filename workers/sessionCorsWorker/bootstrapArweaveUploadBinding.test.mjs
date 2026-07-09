import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchBootstrapArweaveUploadWithWorkerDeps } from './bootstrapArweaveUploadBinding.js';

test('dispatchBootstrapArweaveUploadWithWorkerDeps preserves bootstrap request logging and env-bound upload wiring', async () => {
  const request = new Request('https://worker.example/arweave/upload', {
    method: 'POST',
    headers: {
      Origin: 'https://allowed.example',
      'content-type': 'application/json',
      'CF-Ray': 'ray-123',
      'User-Agent': 'ce-test',
    },
  });
  const env = { GROUP_KV: { id: 'kv' } };
  const logs = [];
  const response = new Response('ok');

  const result = await dispatchBootstrapArweaveUploadWithWorkerDeps({
    request,
    env,
    hasAuthorization: false,
    deps: {
      dispatchBootstrapArweaveUpload: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.hasAuthorization, false);
        assert.equal(value.deps.corsHeaders, 'corsHeaders');
        assert.equal(value.deps.readArweaveBootstrapUploadPayload, 'readArweaveBootstrapUploadPayload');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.MISSING_SLUG_ERROR, 'Missing sessionSlug.');
        assert.equal(
          value.deps.BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR,
          'Session config not found. Provide arweaveJwk for bootstrap uploads or register session config first.',
        );
        assert.equal(value.deps.getCorsContext, 'getCorsContext');
        assert.equal(typeof value.deps.arweaveUpload, 'function');
        const uploadResult = await value.deps.arweaveUpload({ requestId: 'upload-1' });
        assert.equal(uploadResult, 'arweaveUploadResult');

        const slugContext = value.deps.resolveWorkerBodySlugContext({
          body: { sessionSlug: 'session-a' },
        });
        assert.deepEqual(slugContext, { ok: true, targetSlug: 'session-a' });

        const config = await value.deps.getSessionConfig('session-a');
        assert.equal(config, 'configResult');

        const adminCheck = await value.deps.verifyAdminSignature({
          slugHint: 'session-a',
          body: {},
          config: null,
          allowBootstrapWithoutConfig: true,
        });
        assert.equal(adminCheck, 'adminCheckResult');

        const secrets = await value.deps.getSessionSecrets('session-a');
        assert.equal(secrets, 'secretsResult');

        value.deps.logBootstrapPayload({
          requestId: 'bootstrap-1',
          body: {
            address: '0xabc',
            message: 'message',
            signature: 'sig',
            sessionSlug: 'session-a',
            groupSlug: 'legacy-a',
          },
        });
        value.deps.logBootstrapConfigMissing({
          targetSlug: 'session-a',
          requestId: 'bootstrap-2',
        });
        value.deps.logBootstrapCorsReject({
          requestId: 'bootstrap-3',
          targetSlug: 'session-a',
          allowOrigins: ['https://allowed.example'],
        });

        return response;
      },
      log: (...args) => {
        logs.push(args);
      },
      corsHeaders: 'corsHeaders',
      readArweaveBootstrapUploadPayload: 'readArweaveBootstrapUploadPayload',
      resolveWorkerBodySlugContext: ({ body, env: receivedEnv }) => {
        assert.equal(receivedEnv, env);
        return {
          ok: true,
          targetSlug: body.sessionSlug,
        };
      },
      json: 'json',
      getSessionConfig: async (receivedEnv, slug) => {
        assert.equal(receivedEnv, env);
        assert.equal(slug, 'session-a');
        return 'configResult';
      },
      getCorsContext: 'getCorsContext',
      verifyAdminSignature: async (value) => {
        assert.equal(value.env, env);
        return 'adminCheckResult';
      },
      getSessionSecrets: async (receivedEnv, slug) => {
        assert.equal(receivedEnv, env);
        assert.equal(slug, 'session-a');
        return 'secretsResult';
      },
      arweaveUpload: async (value) => {
        assert.deepEqual(value, { requestId: 'upload-1', env });
        return 'arweaveUploadResult';
      },
    },
    constants: {
      missingSlugError: 'Missing sessionSlug.',
      bootstrapSessionConfigRequiredError:
        'Session config not found. Provide arweaveJwk for bootstrap uploads or register session config first.',
    },
  });

  assert.equal(result, response);
  assert.deepEqual(logs, [
    ['[arweave] request', {
      url: 'https://worker.example/arweave/upload',
      hasAuthHeader: false,
      origin: 'https://allowed.example',
      contentType: 'application/json',
      cfRay: 'ray-123',
      ua: 'ce-test',
    }],
    ['[arweave] bootstrap payload', {
      requestId: 'bootstrap-1',
      hasAddress: true,
      hasMessage: true,
      hasSignature: true,
      sessionSlug: 'session-a',
      groupSlug: 'legacy-a',
    }],
    ['[arweave] bootstrap config missing', {
      targetSlug: 'session-a',
      requestId: 'bootstrap-2',
    }],
    ['[arweave] cors reject', {
      requestId: 'bootstrap-3',
      origin: 'https://allowed.example',
      targetSlug: 'session-a',
      allowOrigins: ['https://allowed.example'],
    }],
  ]);
});

test('dispatchBootstrapArweaveUploadWithWorkerDeps preserves arweave request logging for authenticated uploads', async () => {
  const request = new Request('https://worker.example/arweave/upload', {
    method: 'POST',
    headers: {
      Origin: 'https://allowed.example',
      'content-type': 'application/json',
    },
  });
  const logs = [];

  const result = await dispatchBootstrapArweaveUploadWithWorkerDeps({
    request,
    env: { GROUP_KV: {} },
    hasAuthorization: true,
    deps: {
      dispatchBootstrapArweaveUpload: async (value) => {
        assert.equal(value.hasAuthorization, true);
        return { handled: false };
      },
      log: (...args) => {
        logs.push(args);
      },
    },
  });

  assert.deepEqual(result, { handled: false });
  assert.deepEqual(logs, [[
    '[arweave] request',
    {
      url: 'https://worker.example/arweave/upload',
      hasAuthHeader: true,
      origin: 'https://allowed.example',
      contentType: 'application/json',
      cfRay: '',
      ua: '',
    },
  ]]);
});

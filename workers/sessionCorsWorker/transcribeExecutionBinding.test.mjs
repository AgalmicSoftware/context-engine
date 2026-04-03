import test from 'node:test';
import assert from 'node:assert/strict';

import { createTranscribeWithWorkerDeps } from './transcribeExecutionBinding.js';

test('createTranscribeWithWorkerDeps preserves the worker-specific transcribe deps bundle', async () => {
  const request = new Request('https://worker.example/transcribe', {
    method: 'POST',
  });
  const secrets = { openaiKey: 'sk-openai' };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const transcribeRequest = {
    ok: true,
    payload: {
      provider: 'openai',
      requestApiKey: '',
      requestRpcUrl: '',
      upstreamFormData: new FormData(),
    },
  };
  const response = new Response('ok');

  const transcribe = createTranscribeWithWorkerDeps({
    deps: {
      transcribe: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.secrets, secrets);
        assert.equal(value.baseHeaders, baseHeaders);
        assert.equal(value.transcribeRequest, transcribeRequest);
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.toStr, 'toStr');
        assert.equal(value.deps.readTranscribeRequestPayload, 'readTranscribeRequestPayload');
        assert.equal(value.deps.isBlockedOutboundUrl, 'isBlockedOutboundUrl');
        assert.equal(value.deps.safeFetch, 'safeFetch');
        assert.equal(value.constants.openAiTranscribeUrl, 'https://api.openai.example/v1/audio/transcriptions');
        return response;
      },
      json: 'json',
      toStr: 'toStr',
      readTranscribeRequestPayload: 'readTranscribeRequestPayload',
      isBlockedOutboundUrl: 'isBlockedOutboundUrl',
      safeFetch: 'safeFetch',
    },
    constants: {
      openAiTranscribeUrl: 'https://api.openai.example/v1/audio/transcriptions',
    },
  });

  const result = await transcribe({
    request,
    secrets,
    baseHeaders,
    transcribeRequest,
  });

  assert.equal(result, response);
});

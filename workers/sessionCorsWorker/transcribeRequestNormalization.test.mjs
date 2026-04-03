import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MISSING_TRANSCRIBE_FILE_ERROR,
  MISSING_TRANSCRIBE_RPC_URL_ERROR,
  normalizeTranscribeRequestPayload,
  readTranscribeRequestPayload,
} from './transcribeRequestNormalization.js';

test('normalizeTranscribeRequestPayload trims model/apiKey/rpcUrl and accepts the audio field alias', () => {
  const formData = new FormData();
  formData.append('audio', new File(['audio'], 'clip.mp3', { type: 'audio/mpeg' }));
  formData.append('model', ' whisper-1 ');
  formData.append('provider', ' custom ');
  formData.append('apiKey', ' sk-local ');
  formData.append('rpcUrl', ' https://rpc.example/transcribe ');

  const normalized = normalizeTranscribeRequestPayload({ formData });

  assert.equal(normalized.ok, true);
  assert.equal(normalized.payload.provider, 'custom');
  assert.equal(normalized.payload.model, 'whisper-1');
  assert.equal(normalized.payload.requestApiKey, 'sk-local');
  assert.equal(normalized.payload.requestRpcUrl, 'https://rpc.example/transcribe');
  assert.equal(normalized.payload.upstreamFormData.get('model'), 'whisper-1');
  assert.equal(normalized.payload.upstreamFormData.get('response_format'), 'json');
  assert.equal(normalized.payload.upstreamFormData.get('file')?.name, 'clip.mp3');
});

test('normalizeTranscribeRequestPayload preserves missing-file, unsupported-provider, and missing-rpcUrl failures', () => {
  assert.deepEqual(
    normalizeTranscribeRequestPayload({ formData: new FormData() }),
    {
      ok: false,
      status: 400,
      error: MISSING_TRANSCRIBE_FILE_ERROR,
      payload: null,
    }
  );

  const unsupported = new FormData();
  unsupported.append('file', new File(['audio'], 'clip.mp3', { type: 'audio/mpeg' }));
  unsupported.append('provider', 'anthropic');
  assert.deepEqual(
    normalizeTranscribeRequestPayload({ formData: unsupported }),
    {
      ok: false,
      status: 400,
      error: 'Unsupported transcription provider: anthropic',
      payload: null,
    }
  );

  const missingRpc = new FormData();
  missingRpc.append('file', new File(['audio'], 'clip.mp3', { type: 'audio/mpeg' }));
  missingRpc.append('provider', 'custom');
  assert.deepEqual(
    normalizeTranscribeRequestPayload({ formData: missingRpc }),
    {
      ok: false,
      status: 400,
      error: MISSING_TRANSCRIBE_RPC_URL_ERROR,
      payload: null,
    }
  );
});

test('readTranscribeRequestPayload preserves multipart parse failures', async () => {
  const request = {
    formData: async () => {
      throw new Error('bad multipart');
    },
  };

  assert.deepEqual(
    await readTranscribeRequestPayload({ request }),
    {
      ok: false,
      status: 400,
      error: 'Expected multipart/form-data.',
      payload: null,
    }
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_OPENAI_TRANSCRIBE_URL,
  OPENAI_TRANSCRIBE_URL_ENV,
  resolveOpenAiTranscribeUrl,
} from './endpointConfig.js';

test('resolveOpenAiTranscribeUrl uses the default endpoint when unset', () => {
  assert.equal(resolveOpenAiTranscribeUrl(), DEFAULT_OPENAI_TRANSCRIBE_URL);
});

test('resolveOpenAiTranscribeUrl accepts an env override', () => {
  assert.equal(
    resolveOpenAiTranscribeUrl({
      env: {
        [OPENAI_TRANSCRIBE_URL_ENV]: ' https://transcribe.example.test/v1/audio/transcriptions ',
      },
    }),
    'https://transcribe.example.test/v1/audio/transcriptions'
  );
});

test('resolveOpenAiTranscribeUrl prefers explicit constants over env', () => {
  assert.equal(
    resolveOpenAiTranscribeUrl({
      constants: {
        openAiTranscribeUrl: ' https://constant.example.test/transcribe ',
      },
      env: {
        [OPENAI_TRANSCRIBE_URL_ENV]: 'https://env.example.test/transcribe',
      },
    }),
    'https://constant.example.test/transcribe'
  );
});

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

const wavDataUrl = (bytes = 64) => {
  const wav = new Uint8Array(44 + bytes);
  wav.set(new TextEncoder().encode('RIFF'), 0);
  wav.set(new TextEncoder().encode('WAVEfmt '), 8);
  return `data:audio/wav;base64,${Buffer.from(wav).toString('base64')}`;
};
const groupForm = (speakers, { labels = true } = {}) => {
  const formData = new FormData();
  formData.append('file', new File(['audio'], 'room.webm', { type: 'audio/webm' }));
  formData.append('model', 'gpt-4o-transcribe-diarize');
  if (labels) {
    formData.append('purpose', 'group-conversation');
    formData.append('labelSpeakers', 'true');
  }
  for (const [name] of speakers) formData.append('known_speaker_names[]', name);
  for (const [, reference] of speakers) formData.append('known_speaker_references[]', reference);
  return formData;
};
const forwarded = (formData) => {
  const upstream = normalizeTranscribeRequestPayload({ formData }).payload.upstreamFormData;
  return {
    names: upstream.getAll('known_speaker_names[]'),
    references: upstream.getAll('known_speaker_references[]'),
  };
};

test('group labels forward known speaker samples in order', () => {
  const samples = [['Person 1', wavDataUrl()], [' Person 2 ', wavDataUrl(80)]];
  assert.deepEqual(forwarded(groupForm(samples)), {
    names: ['Person 1', 'Person 2'],
    references: [samples[0][1], samples[1][1]],
  });
  // Plain transcription never sends them on.
  assert.deepEqual(forwarded(groupForm(samples, { labels: false })), { names: [], references: [] });
});

test('known speakers drop invalid pairs instead of failing the chunk', () => {
  const sample = wavDataUrl();
  const notWav = `data:audio/wav;base64,${Buffer.from('OggS'.padEnd(48, 'x')).toString('base64')}`;
  const { names, references } = forwarded(
    groupForm([
      ['', sample],
      ['Person 1', sample],
      ['person 1', wavDataUrl(4)],
      ['A'.repeat(33), sample],
      ['Person\u00002', sample],
      ['<b>Person</b>', sample],
      ['Person 3', 'https://example.com/clip.wav'],
      ['Person 4', 'data:audio/mpeg;base64,AAAA'],
      ['Person 5', `${sample}!`],
      ['Person 6', notWav],
      ['Person 7', wavDataUrl(460 * 1024)],
      ['María 8', wavDataUrl(8)],
    ]),
  );
  assert.deepEqual(names, ['Person 1', 'María 8']);
  assert.equal(references.length, 2);
  assert.equal(normalizeTranscribeRequestPayload({ formData: groupForm([['Person 1', 'not a sample']]) }).ok, true);
});

test('known speakers keep at most four pairs of samples under 450 KB', () => {
  const five = Array.from({ length: 5 }, (_, index) => [`Person ${index + 1}`, wavDataUrl(index)]);
  assert.deepEqual(forwarded(groupForm(five)).names, ['Person 1', 'Person 2', 'Person 3', 'Person 4']);
  // A sample URL may use up to 450 KB, so four stay under 2 MB in all.
  const largest = wavDataUrl(345_538);
  const tooLarge = wavDataUrl(345_541);
  assert.equal(largest.length, 460_798);
  assert.equal(tooLarge.length, 460_802);
  const sized = forwarded(groupForm([['Person 1', tooLarge], ['Person 2', largest]]));
  assert.deepEqual(sized.names, ['Person 2']);
  // Unpaired names or samples are ignored.
  const unpaired = groupForm([['Person 1', wavDataUrl()]]);
  unpaired.append('known_speaker_names[]', 'Person 2');
  assert.deepEqual(forwarded(unpaired).names, ['Person 1']);
});

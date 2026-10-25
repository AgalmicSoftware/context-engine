import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __test__interviewQuestionCatalog as helpers,
  loadPublicInterviewQuestions,
} from './interviewQuestionCatalog.js';
import { buildIndexKey, buildPayloadKey, storageRoute } from './storageRouteExecution.js';

test('interview question normalization omits masked prompts and deduplicates IDs', () => {
  assert.deepEqual(
    helpers.dedupeQuestions([
      { id: 'Q1', prompt: 'Public?', type: 'binary' },
      { id: 'q1', prompt: 'Duplicate?' },
      { id: 'q2', prompt: 'Connect to decrypt encrypted prompt.' },
      { id: 'q3', prompt: 'Fallback plaintext', promptEncrypted: { ciphertext: 'sealed' } },
      { id: 'q4', prompt: 'Gated plaintext', visibility: 'sbt_gated' },
    ]),
    [{ id: 'q1', prompt: 'Public?', type: 'binary', options: ['Agree', 'Unsure', 'Disagree'] }],
  );
});

test('rating catalog questions retain exact scale metadata for interview prefill', () => {
  assert.deepEqual(
    helpers.dedupeQuestions([
      {
        id: 'rating-q1',
        prompt: 'Rate support',
        type: 'rating',
        scale: { min: 1, max: 10, minLabel: 'Strongly oppose', maxLabel: 'Strongly support' },
      },
      {
        id: 'rating-q2',
        prompt: 'Rate confidence',
        type: 'rating',
        scale: {},
        ratingScale: { lowLabel: 'Not confident', highLabel: 'Very confident' },
      },
      {
        id: 'rating-q3',
        prompt: 'Rate invalid',
        type: 'rating',
        scale: { min: 10, max: 1, minLabel: 'High', maxLabel: 'Low' },
      },
    ]),
    [
      {
        id: 'rating-q1',
        prompt: 'Rate support',
        type: 'rating',
        options: [],
        scale: { min: 1, max: 10, minLabel: 'Strongly oppose', maxLabel: 'Strongly support' },
      },
      {
        id: 'rating-q2',
        prompt: 'Rate confidence',
        type: 'rating',
        options: [],
        scale: { min: 0, max: 10, minLabel: 'Not confident', maxLabel: 'Very confident' },
      },
      {
        id: 'rating-q3',
        prompt: 'Rate invalid',
        type: 'rating',
        options: [],
        scale: { min: 0, max: 10, minLabel: '0', maxLabel: '10' },
      },
    ],
  );
});

test('bytes32 pointers preserve all 32 bytes and payloads remain session-scoped', () => {
  const hex = `0x01${'00'.repeat(31)}`;
  assert.equal(helpers.base64urlFromHex(hex), Buffer.from(hex.slice(2), 'hex').toString('base64url'));
  assert.equal(helpers.base64urlFromHex(hex).length, 43);
  assert.equal(helpers.payloadSessionSlug({ session: { slug: 'Demo-One' } }), 'demo-one');
  assert.equal(helpers.payloadSessionSlug({}), '');
});

test('question event data decoder reads the first dynamic bytes32 array', () => {
  const qid = `0x${'11'.repeat(32)}`;
  const data = `0x${(32n).toString(16).padStart(64, '0')}${(1n).toString(16).padStart(64, '0')}${qid.slice(2)}`;
  assert.deepEqual(helpers.decodeQuestionIds(data), [qid]);
});

test('on-chain question discovery accepts the canonical nested session RPC shape', () => {
  assert.deepEqual(
    helpers.pickRpcUrls({
      networkChainId: 11155420,
      rpc: {
        providers: {
          path: {
            rpcUrl: 'https://rpc-one.example',
            rpcUrlsByChainId: { 11155420: ['https://rpc-two.example'] },
          },
        },
      },
    }),
    ['https://rpc-two.example', 'https://rpc-one.example'],
  );
});

test('on-chain question discovery fails closed on payloads from another session', async () => {
  const qid = `0x${'11'.repeat(32)}`;
  const eventData = `0x${(32n).toString(16).padStart(64, '0')}${(1n).toString(16).padStart(64, '0')}${qid.slice(2)}`;
  const pointerBytes = Buffer.alloc(32, 1);
  const pointer = pointerBytes.toString('base64url');
  const questions = await loadPublicInterviewQuestions({
    slug: 'demo',
    config: {
      contracts: { surveys: '0x1111111111111111111111111111111111111111' },
      rpcUrl: 'https://rpc.example',
      blockLimits: { start: 1, end: 1 },
    },
    fetch: async (url, init) => {
      if (String(url) === 'https://rpc.example') {
        const body = JSON.parse(String(init?.body || '{}'));
        const result = body.method === 'eth_blockNumber'
          ? '0x1'
          : body.method === 'eth_getLogs'
            ? [{ data: eventData }]
            : `0x${pointerBytes.toString('hex')}`;
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), {
          headers: { 'content-type': 'application/json' },
        });
      }
      assert.equal(String(url), `https://ar-io.dev/${pointer}`);
      return new Response(JSON.stringify({ id: qid, sessionSlug: 'another', prompt: 'Wrong session' }), {
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.deepEqual(questions, []);
});


test('quadratic catalog questions retain ordered options and the configured or default credit budget', () => {
  const questions = helpers.dedupeQuestions([
    { id: 'q1', type: 'quadratic', prompt: 'Allocate support', options: ['Parks', 'Transit'], voiceCredits: 25 },
    { id: 'q2', type: 'quadratic', prompt: 'Allocate elsewhere', options: ['A', 'B'] },
  ]);
  assert.deepEqual(questions[0].options, ['Parks', 'Transit']);
  assert.equal(questions[0].voiceCredits, 25);
  assert.equal(questions[1].voiceCredits, 99);
});


test('choice catalogs retain canonical and legacy single-select settings and default to multi-select', () => {
  const questions = [{}, { singleSelect: false }, { singleSelect: true }, { oneSelectionOnly: true }, { singleChoice: true }]
    .map((settings, index) => ({ id: `q${index}`, prompt: 'Pick topics', type: 'multichoice', options: ['Parks', 'Transit'], ...settings }));
  assert.deepEqual(helpers.dedupeQuestions(questions).map((question) => question.singleSelect), [false, false, true, true, true]);
});

test('Cloudflare catalog keeps the first or admin version of each question and skips hidden ids', async () => {
  const store = new Map();
  const kv = {
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
    async list({ prefix = '', limit = 1000, cursor = '' } = {}) {
      const names = [...store.keys()].filter((key) => key.startsWith(prefix)).sort();
      const offset = Number(cursor) || 0;
      const keys = names.slice(offset, offset + limit).map((name) => ({ name }));
      const done = offset + keys.length >= names.length;
      return { keys, list_complete: done, cursor: done ? '' : String(offset + keys.length) };
    },
  };
  const admin = '0x00000000000000000000000000000000000000aa';
  const author = '0x00000000000000000000000000000000000000bb';
  const attacker = '0x00000000000000000000000000000000000000cc';
  const config = {
    adminAddress: admin,
    storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
  };
  const put = async (id, createdAt, metadata, payload) => {
    const fullMetadata = { id, resource: 'questions', backend: 'cloudflare', contentType: 'application/json', createdAt, ...metadata };
    await kv.put(buildIndexKey({ slug: 'session-a', resource: 'questions', id }), JSON.stringify(fullMetadata));
    await kv.put(buildPayloadKey({ slug: 'session-a', id }), JSON.stringify({
      metadata: fullMetadata,
      payloadBase64url: Buffer.from(JSON.stringify(payload)).toString('base64url'),
    }));
  };
  const question = (id, prompt) => ({ id, prompt, type: 'binary' });
  // Storage ids sort the attacker re-upload ahead of the official question.
  await put('aa-attacker-q1', '2026-10-02T00:00:00.000Z', { uploader: attacker, resourceId: 'q1' }, question('q1', 'ATTACKER prompt'));
  await put('zz-official-q1', '2026-10-01T00:00:00.000Z', { uploader: author, resourceId: 'q1' }, question('q1', 'Official prompt'));
  await put('mm-draft-q2', '2026-10-01T00:00:00.000Z', {}, question('q2', 'Participant draft'));
  await put('nn-admin-q2', '2026-10-03T00:00:00.000Z', { uploader: admin, resourceId: 'q2' }, question('q2', 'Admin correction'));
  await put('hh-hidden-q3', '2026-10-01T00:00:00.000Z', { uploader: author, resourceId: 'q3', hidden: true }, question('q3', 'Hidden'));
  await put('ii-copy-q3', '2026-10-04T00:00:00.000Z', {}, question('q3', 'Unmarked copy of hidden'));
  // Filler rows push the canonical q2 version past the first list page.
  for (let index = 0; index < 120; index += 1) {
    await put(`nm-filler-${String(index).padStart(3, '0')}`, '2026-10-05T00:00:00.000Z', {}, question(`filler-${index}`, `Filler ${index}?`));
  }

  const questions = await loadPublicInterviewQuestions({
    env: { CE_STORAGE_INDEX_KV: kv },
    config,
    slug: 'session-a',
    storageRoute,
  });
  const byId = new Map(questions.map((entry) => [entry.id, entry.prompt]));
  assert.equal(byId.get('q1'), 'Official prompt');
  assert.equal(byId.get('q2'), 'Participant draft');
  assert.equal(byId.has('q3'), false);
  for (const adminAddress of ['', attacker, author]) {
    const ordinary = await loadPublicInterviewQuestions({ env: { CE_STORAGE_INDEX_KV: kv }, config: { ...config, adminAddress }, slug: 'session-a', storageRoute });
    assert.equal(ordinary.find((entry) => entry.id === 'q1').prompt, 'Official prompt');
    assert.equal(ordinary.find((entry) => entry.id === 'q2').prompt, 'Participant draft');
  }
  // Only a server-recorded admin stamp grants correction precedence.
  await put('nn-admin-q2', '2026-10-03T00:00:00.000Z', { uploader: admin, resourceId: 'q2', uploadAuthority: 'admin' }, question('q2', 'Admin correction'));
  for (const adminAddress of ['', attacker]) {
    const rotated = await loadPublicInterviewQuestions({ env: { CE_STORAGE_INDEX_KV: kv }, config: { ...config, adminAddress }, slug: 'session-a', storageRoute });
    assert.equal(rotated.find((entry) => entry.id === 'q2').prompt, 'Admin correction');
  }

});

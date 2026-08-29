import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __test__interviewQuestionCatalog as helpers,
  loadPublicInterviewQuestions,
} from './interviewQuestionCatalog.js';

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

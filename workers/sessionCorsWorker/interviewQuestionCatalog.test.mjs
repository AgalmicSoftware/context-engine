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
      {
        id: 'rating-q4',
        prompt: 'Rate in fives',
        type: 'rating',
        scale: { min: 0, max: 100, step: 5 },
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
      {
        id: 'rating-q4',
        prompt: 'Rate in fives',
        type: 'rating',
        options: [],
        scale: { min: 0, max: 100, minLabel: '0', maxLabel: '100', step: 5 },
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
  const { questions } = await loadPublicInterviewQuestions({
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


test('on-chain question discovery leaves out questions on the session blocklist', async () => {
  const blocked = `0x${'11'.repeat(32)}`;
  const allowed = `0x${'22'.repeat(32)}`;
  const word = (value) => value.toString(16).padStart(64, '0');
  const eventData = `0x${word(32n)}${word(2n)}${blocked.slice(2)}${allowed.slice(2)}`;
  const pointerBytes = Buffer.alloc(32, 1);
  const pointerReads = [];
  const load = (BLOCKED_QUESTION_IDS) => loadPublicInterviewQuestions({
    slug: 'demo',
    config: {
      BLOCKED_QUESTION_IDS,
      contracts: { surveys: '0x1111111111111111111111111111111111111111' },
      rpcUrl: 'https://rpc.example',
      blockLimits: { start: 1, end: 1 },
    },
    fetch: async (url, init) => {
      if (String(url) === 'https://rpc.example') {
        const body = JSON.parse(String(init?.body || '{}'));
        if (body.method === 'eth_call') pointerReads.push(`0x${body.params[0].data.slice(10)}`);
        const result = body.method === 'eth_blockNumber'
          ? '0x1'
          : body.method === 'eth_getLogs'
            ? [{ data: eventData }]
            : `0x${pointerBytes.toString('hex')}`;
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }));
      }
      return new Response(JSON.stringify({ sessionSlug: 'demo', prompt: 'A question' }));
    },
  });
  assert.deepEqual((await load([])).questions.map(({ id }) => id), [blocked, allowed]);
  pointerReads.length = 0;
  assert.deepEqual((await load([blocked.toUpperCase().replace('0X', '0x')])).questions.map(({ id }) => id), [allowed]);
  assert.deepEqual(pointerReads, [allowed]);
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

const admin = '0x00000000000000000000000000000000000000aa';
const author = '0x00000000000000000000000000000000000000bb';
const attacker = '0x00000000000000000000000000000000000000cc';
const config = {
  adminAddress: admin,
  storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
};
const question = (id, prompt) => ({ id, prompt, type: 'binary' });
const prompts = (questions) => questions.map(({ id, prompt }) => ({ id, prompt }));

// Questions in memory KV, served through the real storage route.
const createQuestionStore = () => {
  const store = new Map();
  const kv = {
    async get(key) {
      if (Array.isArray(key)) return new Map(key.map((name) => [name, store.get(name) ?? null]));
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) { store.set(key, value); },
    async list({ prefix = '', limit = 1000, cursor = '' } = {}) {
      const names = [...store.keys()].filter((key) => key.startsWith(prefix)).sort();
      const offset = Number(cursor) || 0;
      const keys = names.slice(offset, offset + limit).map((name) => ({ name }));
      const done = offset + keys.length >= names.length;
      return { keys, list_complete: done, cursor: done ? '' : String(offset + keys.length) };
    },
  };
  const put = async (id, createdAt, metadata, payload) => {
    const fullMetadata = { id, resource: 'questions', backend: 'cloudflare', contentType: 'application/json', createdAt, ...metadata };
    await kv.put(buildIndexKey({ slug: 'session-a', resource: 'questions', id }), JSON.stringify(fullMetadata));
    await kv.put(buildPayloadKey({ slug: 'session-a', id }), JSON.stringify({
      metadata: fullMetadata,
      payloadBase64url: Buffer.from(JSON.stringify(payload)).toString('base64url'),
    }));
  };
  // Payload ids read, one at a time or in a batch; `sequential` refuses the
  // batch route, so every payload is read on its own as before batching.
  const reads = [];
  const batches = [];
  const loadFull = (sessionConfig = config, { sequential = false, reader } = {}) => loadPublicInterviewQuestions({
    env: { CE_STORAGE_INDEX_KV: kv },
    config: sessionConfig,
    slug: 'session-a',
    ...(reader ? { reader } : {}),
    storageRoute: async (args) => {
      if (args.path === '/storage/read') reads.push(new URL(args.request.url).searchParams.get('id'));
      if (args.path === '/storage/read-batch') {
        if (sequential) return new Response('', { status: 404 });
        const response = await storageRoute(args);
        batches.push((await response.clone().json()).items);
        return response;
      }
      return storageRoute(args);
    },
  });
  const load = (sessionConfig = config) => loadFull(sessionConfig).then(result => result.questions);
  return { kv, put, load, loadFull, reads, batches };
};

test('Cloudflare catalog keeps the first or admin version of each question and skips hidden ids', async () => {
  const { put, load } = createQuestionStore();
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

  const questions = await load();
  const byId = new Map(questions.map((entry) => [entry.id, entry.prompt]));
  assert.equal(byId.get('q1'), 'Official prompt');
  assert.equal(byId.get('q2'), 'Participant draft');
  assert.equal(byId.has('q3'), false);
  for (const adminAddress of ['', attacker, author]) {
    const ordinary = await load({ ...config, adminAddress });
    assert.equal(ordinary.find((entry) => entry.id === 'q1').prompt, 'Official prompt');
    assert.equal(ordinary.find((entry) => entry.id === 'q2').prompt, 'Participant draft');
  }
  // Only a server-recorded admin stamp grants correction precedence.
  await put('nn-admin-q2', '2026-10-03T00:00:00.000Z', { uploader: admin, resourceId: 'q2', uploadAuthority: 'admin' }, question('q2', 'Admin correction'));
  for (const adminAddress of ['', attacker]) {
    const rotated = await load({ ...config, adminAddress });
    assert.equal(rotated.find((entry) => entry.id === 'q2').prompt, 'Admin correction');
  }

});

test('Cloudflare catalog leaves out questions on the session blocklist before reading them', async () => {
  const { put, load, reads } = createQuestionStore();
  await put('aa-blocked', '2026-10-01T00:00:00.000Z', { uploader: author, resourceId: 'q1' }, question('q1', 'Blocked prompt'));
  await put('bb-allowed', '2026-10-01T00:00:00.000Z', { uploader: author, resourceId: 'q2' }, question('q2', 'Allowed prompt'));
  assert.deepEqual((await load()).map((entry) => entry.id).sort(), ['q1', 'q2']);
  reads.length = 0;
  assert.deepEqual((await load({ ...config, BLOCKED_QUESTION_IDS: [' Q1 '] })).map((entry) => entry.id), ['q2']);
  assert.equal(reads.includes('aa-blocked'), false);
});

test('Cloudflare catalog chooses from every list page and reads only the chosen payload', async () => {
  const { put, load, reads, batches } = createQuestionStore();
  // 201 revisions of one question; the admin correction lists last, on page three.
  for (let index = 0; index < 200; index += 1) {
    const createdAt = new Date(Date.UTC(2026, 9, 1, 0, 0, index)).toISOString();
    await put(`rev-${String(index).padStart(3, '0')}`, createdAt, { uploader: author, resourceId: 'q1' }, question('q1', index ? `Revision ${index}` : 'Original prompt'));
  }
  await put('rev-zzz-admin', '2026-10-02T00:00:00.000Z', { uploader: admin, resourceId: 'q1', uploadAuthority: 'admin' }, question('q1', 'Admin correction'));

  assert.deepEqual(prompts(await load()), [{ id: 'q1', prompt: 'Admin correction' }]);
  assert.deepEqual(batches.flat().map((item) => item.id), ['rev-zzz-admin']);
  assert.deepEqual(reads, []);
});

// A bank a signed-out visitor may read only part of, as the storage route judges each row.
const adminsOnly = { match: 'any', conditions: [{ kind: 'worker_role', role: 'admin' }] };
const putMixedBank = async (put) => {
  await put('row-open-q1', '2026-10-01T00:00:00.000Z', { uploader: author, resourceId: 'q1' }, question('q1', 'Open question'));
  await put('row-group-q2', '2026-10-01T00:00:00.000Z', { uploader: author, resourceId: 'q2', groupIds: ['group-1'] }, question('q2', 'SECRET group question'));
  await put('row-admins-q3', '2026-10-01T00:00:00.000Z', { uploader: author, resourceId: 'q3', accessConditions: adminsOnly }, question('q3', 'SECRET admins question'));
  await put('row-sealed-q4', '2026-10-01T00:00:00.000Z', { uploader: author, resourceId: 'q4', accessConditions: adminsOnly, payloadAccessControl: { gate: 'none', encryption: 'worker_envelope' } }, question('q4', 'SECRET encrypted question'));
  await put('row-sealed-q5', '2026-10-01T00:00:00.000Z', { uploader: author, resourceId: 'q5', payloadAccessControl: { gate: 'none', encryption: 'worker_envelope' } }, question('q5', 'SECRET unreadable envelope'));
  await put('row-hidden-q6', '2026-10-01T00:00:00.000Z', { uploader: author, resourceId: 'q6', hidden: true }, question('q6', 'SECRET hidden question'));
  await put('row-blocked-q7', '2026-10-01T00:00:00.000Z', { uploader: author, resourceId: 'q7' }, question('q7', 'SECRET blocked question'));
  await put('row-legacy-q8', '2026-09-01T00:00:00.000Z', {}, question('q8', 'Legacy open question'));
  await put('row-legacy-q9', '2026-09-02T00:00:00.000Z', { groupIds: ['group-1'] }, question('q9', 'SECRET legacy group question'));
};
const blocked = { ...config, BLOCKED_QUESTION_IDS: ['q7'] };

test('Cloudflare catalog reads in a batch, and the storage route still refuses each restricted row', async () => {
  const { kv, put, loadFull, reads, batches } = createQuestionStore();
  await putMixedBank(put);
  const open = [{ id: 'q1', prompt: 'Open question' }, { id: 'q8', prompt: 'Legacy open question' }];
  const sorted = (questions) => prompts(questions).sort((a, b) => a.id.localeCompare(b.id));
  const result = await loadFull(blocked);
  assert.deepEqual(sorted(result.questions), open);
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
  // The listing refuses most restricted rows first; the rest come in two
  // batches (legacy rows, then chosen versions), none read one at a time,
  // and the read refuses an envelope it cannot open.
  assert.deepEqual(reads, []);
  assert.deepEqual(batches.map((items) => items.map((item) => [item.id, item.status]).sort()), [
    [['row-legacy-q8', 200]],
    [['row-open-q1', 200], ['row-sealed-q5', 403]],
  ]);
  assert.equal(result.incomplete, false);

  // Had the listing named every row, the batch refuses each restricted one itself.
  const listed = ['row-open-q1', 'row-group-q2', 'row-admins-q3', 'row-sealed-q4', 'row-sealed-q5', 'row-blocked-q7', 'row-legacy-q8', 'row-legacy-q9']
    .map((id) => ({ storageRef: { id }, metadata: { resourceId: { 'row-legacy-q8': '', 'row-legacy-q9': '' }[id] ?? `q${id.at(-1)}` } }));
  const items = [];
  const direct = await loadPublicInterviewQuestions({
    env: { CE_STORAGE_INDEX_KV: kv },
    config: blocked,
    slug: 'session-a',
    storageRoute: async (args) => {
      if (args.path === '/storage/list') return Response.json({ items: listed, listComplete: true });
      assert.equal(args.path, '/storage/read-batch');
      const response = await storageRoute(args);
      items.push(...(await response.clone().json()).items);
      return response;
    },
  });
  assert.deepEqual(sorted(direct.questions), open);
  assert.equal(JSON.stringify(direct).includes('SECRET'), false);
  assert.deepEqual(Object.fromEntries(items.map((item) => [item.id, item.status])), {
    'row-legacy-q8': 200, 'row-legacy-q9': 403,
    'row-open-q1': 200, 'row-group-q2': 403, 'row-admins-q3': 403, 'row-sealed-q4': 403, 'row-sealed-q5': 403,
  });
  // A blocked question is left out before any read.
  assert.equal(items.some((item) => item.id === 'row-blocked-q7'), false);
});

test('Cloudflare catalog read in batches is the one read one at a time, for a mixed bank of more than a batch', async () => {
  const { put, loadFull, reads, batches } = createQuestionStore();
  await putMixedBank(put);
  await put('aa-attacker-q10', '2026-10-02T00:00:00.000Z', { uploader: attacker, resourceId: 'q10' }, question('q10', 'ATTACKER prompt'));
  await put('zz-official-q10', '2026-10-01T00:00:00.000Z', { uploader: author, resourceId: 'q10' }, question('q10', 'Official prompt'));
  await put('nn-admin-q11', '2026-10-03T00:00:00.000Z', { uploader: admin, resourceId: 'q11', uploadAuthority: 'admin' }, question('q11', 'Admin correction'));
  await put('mm-draft-q11', '2026-10-01T00:00:00.000Z', {}, question('q11', 'Participant draft'));
  await put('bb-listed-q12', '2026-08-01T00:00:00.000Z', { uploader: attacker, resourceId: 'q12' }, question('q13', 'Mismatched payload'));
  await put('cc-not-a-question', '2026-10-01T00:00:00.000Z', { uploader: author, resourceId: 'q14' }, { note: 'no prompt' });
  // More chosen versions than one batch, and than the catalog holds.
  for (let index = 0; index < 150; index += 1) {
    const id = `f-${String(index).padStart(3, '0')}`;
    await put(`row-${id}`, new Date(Date.UTC(2026, 9, 6, 0, 0, index)).toISOString(), { uploader: author, resourceId: id }, question(id, `Filler ${index}?`));
  }
  for (const sessionConfig of [blocked, { ...blocked, adminAddress: '' }]) {
    reads.length = 0;
    batches.length = 0;
    const batched = await loadFull(sessionConfig);
    assert.deepEqual(reads, []);
    assert.ok(batches.length >= 3, `${batches.length} batches`);
    const sequential = await loadFull(sessionConfig, { sequential: true });
    assert.ok(reads.length > 100);
    assert.deepEqual(batched, sequential);
    assert.equal(batched.questions.length, 100);
    assert.equal(JSON.stringify(batched).includes('SECRET'), false);
  }
});

test('Cloudflare catalog batches what a ticket reader may see, and only that', async () => {
  const { put, loadFull, reads } = createQuestionStore();
  await putMixedBank(put);
  const reader = { address: admin, scopes: ['read'] };
  const batched = await loadFull(blocked, { reader });
  assert.deepEqual(reads, []);
  assert.deepEqual(batched, await loadFull(blocked, { reader, sequential: true }));
  const ids = batched.questions.map((entry) => entry.id).sort();
  // The admin reads the admins-only question a signed-out visitor may not.
  assert.ok(ids.includes('q3') && ids.includes('q1') && ids.includes('q8'), ids.join());
  for (const id of ['q6', 'q7']) assert.equal(ids.includes(id), false, id);
});

test('Cloudflare catalog reads nothing past its last question, so a later failure leaves it complete', async () => {
  const rows = Array.from({ length: 150 }, (_, index) => ({ storageRef: { id: `ref-${String(index).padStart(3, '0')}` }, metadata: { resourceId: `q-${String(index).padStart(3, '0')}` } }));
  for (const [failAt, incomplete, requestedCount] of [[105, true, 111], [120, false, 110]]) {
    const requested = [];
    const result = await loadPublicInterviewQuestions({
      slug: 'fixture',
      config,
      storageRoute: async ({ path, request }) => {
        if (path === '/storage/list') return Response.json({ items: rows, listComplete: true });
        assert.equal(path, '/storage/read-batch');
        const { ids } = await request.json();
        // Ten refusals in the first batch put the catalog's 100th question in a later one.
        return Response.json({ items: ids.map((id) => {
          const position = requested.push(id) - 1;
          if (position < 10) return { id, status: 403 };
          if (position === failAt) return { id, status: 503 };
          return { id, status: 200, text: JSON.stringify(question(`q-${id.slice(4)}`, `Question ${id}?`)) };
        }) });
      },
      fetch: () => assert.fail('A Worker-only fixture must not call RPC'),
    });
    assert.equal(result.questions.length, 100);
    assert.equal(requested.length, requestedCount, `failAt ${failAt}`);
    assert.equal(result.incomplete, incomplete, `failAt ${failAt}`);
  }
});

test('Cloudflare catalog reads on its own what a batch could not carry, and counts only reads it used', async () => {
  const row = (id) => ({ storageRef: { id: `ref-${id}` }, metadata: { resourceId: id } });
  for (const [batchReply, expected] of [
    // A failed batch: each read on its own, as before.
    [() => new Response('', { status: 503 }), { ids: ['q1', 'q2'], incomplete: false, single: 2 }],
    // An item over the batch's size or not text: read on its own.
    [(ids) => Response.json({ items: ids.map((id) => (id === 'ref-q2' ? { id, status: 413 } : { id, status: 200, text: JSON.stringify(question(id.slice(4), 'From batch')) })) }), { ids: ['q1', 'q2'], incomplete: false, single: 1 }],
    // A temporary failure of one item marks the catalog incomplete; a refusal does not.
    [(ids) => Response.json({ items: ids.map((id) => (id === 'ref-q2' ? { id, status: 503 } : { id, status: 403 })) }), { ids: [], incomplete: true, single: 0 }],
  ]) {
    let single = 0;
    const result = await loadPublicInterviewQuestions({
      slug: 'fixture',
      config,
      storageRoute: async ({ path, request }) => {
        if (path === '/storage/list') return Response.json({ items: [row('q1'), row('q2')], listComplete: true });
        if (path === '/storage/read-batch') return batchReply((await request.json()).ids);
        single += 1;
        const id = new URL(request.url).searchParams.get('id').slice(4);
        return Response.json(question(id, 'Read alone'));
      },
      fetch: () => assert.fail('A Worker-only fixture must not call RPC'),
    });
    assert.deepEqual(result.questions.map((entry) => entry.id), expected.ids);
    assert.equal(result.incomplete, expected.incomplete);
    assert.equal(single, expected.single);
  }
  // An id the batch would refuse is read on its own; the rest still go in one batch.
  const batched = [];
  let single = 0;
  const odd = await loadPublicInterviewQuestions({
    slug: 'fixture',
    config,
    storageRoute: async ({ path, request }) => {
      if (path === '/storage/list') return Response.json({ items: [row('q1'), { storageRef: { id: 'not a/safe id' }, metadata: { resourceId: 'q2' } }, row('q3')], listComplete: true });
      if (path === '/storage/read-batch') {
        const { ids } = await request.json();
        batched.push(ids);
        return Response.json({ items: ids.map((id) => ({ id, status: 200, text: JSON.stringify(question(id.slice(4), 'From batch')) })) });
      }
      single += 1;
      return Response.json({ error: 'Invalid storage id.' }, { status: 400 });
    },
    fetch: () => assert.fail('A Worker-only fixture must not call RPC'),
  });
  assert.deepEqual(batched, [['ref-q1', 'ref-q3']]);
  assert.equal(single, 1);
  assert.deepEqual(odd.questions.map((entry) => entry.id).sort(), ['q1', 'q3']);
  assert.equal(odd.incomplete, false);
});

test('Cloudflare catalog continues past a list page that filtering left empty', async () => {
  const { kv, put, load } = createQuestionStore();
  // Unreadable index rows fill page one, which then lists no items but a cursor.
  for (let index = 0; index < 100; index += 1) {
    await kv.put(buildIndexKey({ slug: 'session-a', resource: 'questions', id: `aa-broken-${String(index).padStart(3, '0')}` }), 'not json');
  }
  await put('zz-after-empty', '2026-10-01T00:00:00.000Z', { uploader: author, resourceId: 'q-late' }, question('q-late', 'Listed on page two'));

  assert.deepEqual(prompts(await load()), [{ id: 'q-late', prompt: 'Listed on page two' }]);
});

test('Cloudflare catalog folds legacy rows into the choice and never serves a payload under another id', async () => {
  const { put, load } = createQuestionStore();
  // Stored before resourceId was recorded, the original still wins over a later re-upload.
  await put('zz-legacy-q1', '2026-10-01T00:00:00.000Z', {}, question('q1', 'Legacy original'));
  await put('aa-reupload-q1', '2026-10-05T00:00:00.000Z', { uploader: attacker, resourceId: 'q1' }, question('q1', 'Later re-upload'));
  // The earliest row is listed as q3 but carries a q2 payload.
  await put('bb-listed-q3', '2026-09-01T00:00:00.000Z', { uploader: attacker, resourceId: 'q3' }, question('q2', 'Mismatched q2'));
  await put('cc-official-q2', '2026-10-02T00:00:00.000Z', { uploader: author, resourceId: 'q2' }, question('q2', 'Official q2'));

  assert.deepEqual(prompts(await load()), [
    { id: 'q1', prompt: 'Legacy original' },
    { id: 'q2', prompt: 'Official q2' },
  ]);
});

test('Cloudflare catalog still chooses among the rows it listed when it cannot finish the walk', async () => {
  const listed = { storageRef: { id: 'row-q1' }, metadata: { resourceId: 'q1' } };
  const page = (body, status = 200) => new Response(JSON.stringify(body), { status });
  for (const [nextPage, expectedListCalls] of [
    [(cursor) => page({ items: [listed], cursor: `${cursor}+`, listComplete: false }), 5],
    [() => page({ items: [listed], cursor: 'same', listComplete: false }), 2],
    [() => page({ items: [listed], cursor: null, listComplete: false }), 1],
    [(cursor) => (cursor ? page({ error: 'unavailable' }, 503) : page({ items: [listed], cursor: 'next', listComplete: false })), 2],
  ]) {
    let listCalls = 0;
    const { questions } = await loadPublicInterviewQuestions({
      slug: 'session-a',
      storageRoute: async ({ path, request }) => {
        if (path !== '/storage/list') return page(question('q1', 'Listed question'));
        listCalls += 1;
        return nextPage(new URL(request.url).searchParams.get('cursor') || '');
      },
    });
    assert.deepEqual(prompts(questions), [{ id: 'q1', prompt: 'Listed question' }]);
    assert.equal(listCalls, expectedListCalls);
  }
});

test('Cloudflare catalog keeps room for its payload reads within the per-request KV operation limit', async () => {
  const { kv, put, load } = createQuestionStore();
  for (let index = 0; index < 1500; index += 1) {
    const id = `q-${String(index).padStart(4, '0')}`;
    await put(`row-${id}`, new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(), { uploader: author, resourceId: id }, question(id, `Question ${index}?`));
  }
  // Cloudflare allows 1,000 KV operations per invocation.
  let operations = 0;
  const counted = (method) => async (...args) => {
    operations += 1;
    if (operations > 1000) throw new Error('Too many API requests by single worker invocation');
    return method(...args);
  };
  kv.get = counted(kv.get.bind(kv));
  kv.list = counted(kv.list.bind(kv));

  const questions = await load();
  assert.equal(questions.length, 100);
  assert.ok(operations <= 800, `${operations} KV operations`);
});

for (const failure of [503, 429, 'network', 404, 'non-json']) test(`Cloudflare read ${failure} distinguishes incomplete discovery from a permanent unusable payload`, async () => {
  const result = await loadPublicInterviewQuestions({ slug: 'fixture', config,
    storageRoute: async ({ path }) => {
      if (path === '/storage/list') return Response.json({ items: [{ storageRef: { id: 'fixture-ref' }, metadata: { resourceId: 'q1' } }], listComplete: true });
      if (failure === 'network') throw new Error('Synthetic network failure');
      return failure === 'non-json' ? new Response('not json') : new Response('', { status: failure });
    },
    fetch: () => assert.fail('A Worker-only fixture must not call RPC'),
  });
  assert.deepEqual(result.questions, []);
  assert.equal(result.incomplete, [503, 429, 'network'].includes(failure));
});

for (const failure of [503, 429, 'network', 404, 'non-json']) test(`on-chain payload ${failure} only retries temporary gateway failures`, async () => {
  const qid = `0x${'11'.repeat(32)}`;
  const eventData = `0x${(32n).toString(16).padStart(64, '0')}${(1n).toString(16).padStart(64, '0')}${qid.slice(2)}`;
  const result = await loadPublicInterviewQuestions({ slug: 'fixture',
    config: { contracts: { surveys: '0x1111111111111111111111111111111111111111' }, rpcUrl: 'https://rpc.example', blockLimits: { start: 1, end: 1 } },
    fetch: async (url, init) => {
      if (url === 'https://rpc.example') {
        const body = JSON.parse(init.body);
        const result = body.method === 'eth_blockNumber' ? '0x1' : body.method === 'eth_getLogs' ? [{ data: eventData }] : `0x${'01'.repeat(32)}`;
        return Response.json({ jsonrpc: '2.0', id: 1, result });
      }
      assert.ok(['ar-io.dev', 'arweave.net'].includes(new URL(url).hostname));
      if (failure === 'network') throw new Error('Synthetic network failure');
      return failure === 'non-json' ? new Response('not json') : new Response('', { status: failure });
    },
  });
  assert.deepEqual(result.questions, []);
  assert.equal(result.incomplete, [503, 429, 'network'].includes(failure));
});

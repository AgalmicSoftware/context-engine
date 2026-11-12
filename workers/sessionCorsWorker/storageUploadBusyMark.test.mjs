import assert from 'node:assert/strict';
import test from 'node:test';

import { Wallet } from 'ethers';
import { SESSION_CONFIG_COORDINATION_ERROR } from './sessionConfigAuthority.js';
import {
  SESSION_ID, SLUG, createSessionEnv, fetchWorker, login, makeRequest, readJson, uploadJson,
} from './sessionWorkerRuntimeFixture.mjs';

// An answer marks the session's backup revision before and after it writes.
// A coordinator too busy for either mark must not leave the answer refused,
// stored twice, or stuck behind its own retry lease.
const session = { sessionId: SESSION_ID, sessionSlug: SLUG };

const setup = async () => {
  let marks = 0;
  let failMark = 0;
  const created = createSessionEnv({ onCoordinatorFetch: (request) => {
    if (new URL(request.url).pathname !== '/session-config/backup/write-revision') return;
    marks += 1;
    if (marks === failMark) throw new Error('synthetic overload');
  } });
  const { env } = created;
  const admin = await login({ env, wallet: created.admin });
  assert.equal((await uploadJson({ env, token: admin, resource: 'questions', data: { id: 'q-1', type: 'binary', prompt: 'Statement', ...session } })).status, 200);
  const token = await login({ env, wallet: Wallet.createRandom() });
  return {
    // Fails the given mark of the next answer: 1 before its write, 2 after.
    failNextAnswersMark: (which) => { failMark = marks + which; },
    send: () => uploadJson({ env, token, resource: 'responses', requestId: 'answer-1',
      data: { questionID: 'q-1', answer: { value: 'Agree', encrypted: false }, ...session } }),
    stored: async () => (await readJson(await fetchWorker(makeRequest('/storage/list?resource=responses&limit=100'), env))).body.items.length,
  };
};

test('a coordinator too busy to mark an answer before its write gets the busy reply, and the retry stores it once', async () => {
  const s = await setup();
  s.failNextAnswersMark(1);
  const busy = await s.send();
  assert.equal(busy.status, 503, JSON.stringify(busy.body));
  assert.equal(busy.body.error, SESSION_CONFIG_COORDINATION_ERROR);
  assert.equal(await s.stored(), 0);

  const retried = await s.send();
  assert.equal(retried.status, 200, JSON.stringify(retried.body));
  assert.equal(await s.stored(), 1);
});

test('a coordinator too busy to mark an answer after its write still saves it once', async () => {
  const s = await setup();
  s.failNextAnswersMark(2);
  const saved = await s.send();
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  const again = await s.send();
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.replayed, true);
  assert.equal(await s.stored(), 1);
});

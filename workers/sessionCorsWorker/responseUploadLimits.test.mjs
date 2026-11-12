import assert from 'node:assert/strict';
import test from 'node:test';

import { Wallet } from 'ethers';
import { SESSION_ID, SLUG, createSessionEnv, login, signedAdminRequest, uploadJson } from './sessionWorkerRuntimeFixture.mjs';

const session = { sessionId: SESSION_ID, sessionSlug: SLUG };

const setup = async (questionIds) => {
  const { admin, env } = createSessionEnv();
  setup.admin = admin;
  const adminToken = await login({ env, wallet: admin });
  for (const id of questionIds) {
    const stored = await uploadJson({ env, token: adminToken, resource: 'questions', data: { id, type: 'binary', prompt: `Agree with ${id}?`, ...session } });
    assert.equal(stored.status, 200, JSON.stringify(stored.body));
  }
  const person = async () => login({ env, wallet: Wallet.createRandom() });
  return { env, person };
};

const answer = (questionID, value = 'Agree') => ({ questionID, answer: { value, encrypted: false }, ...session });

test('one person stores at most 20 versions of an answer; replays and other questions still pass', async () => {
  const questions = Array.from({ length: 5 }, (_, index) => `q-${index}`);
  const { env, person } = await setup(questions);
  const token = await person();
  for (let version = 0; version < 20; version += 1) {
    const stored = await uploadJson({ env, token, resource: 'responses', data: answer('q-0', version % 2 ? 'Agree' : 'Disagree'), requestId: `edit-${version}` });
    assert.equal(stored.status, 200, `version ${version + 1}: ${JSON.stringify(stored.body)}`);
  }
  const refused = await uploadJson({ env, token, resource: 'responses', data: answer('q-0', 'Unsure') });
  assert.equal(refused.status, 422);
  assert.equal(refused.body.reason, 'response_limit_versions');
  assert.match(refused.body.error, /20 times/);
  // A survey submission carrying that answer is refused too.
  const survey = await uploadJson({ env, token, resource: 'responses', data: { surveyID: 's-1', ...session, responses: [answer('q-1'), answer('q-0')] } });
  assert.equal(survey.body.reason, 'response_limit_versions');
  // A retry of an answer already stored replays it.
  const replay = await uploadJson({ env, token, resource: 'responses', data: answer('q-0', 'Disagree'), requestId: 'edit-0' });
  assert.equal(replay.status, 200, JSON.stringify(replay.body));
  assert.equal(replay.body.replayed, true);
  assert.equal((await uploadJson({ env, token, resource: 'responses', data: answer('q-1') })).status, 200);
  // The limit is one person's: someone else answers freely.
  assert.equal((await uploadJson({ env, token: await person(), resource: 'responses', data: answer('q-0') })).status, 200);
});

test('one person stores at most five answers per question the session has', async () => {
  const { env, person } = await setup(['q-a', 'q-b']);
  const token = await person();
  for (let row = 0; row < 10; row += 1) {
    const stored = await uploadJson({ env, token, resource: 'responses', data: answer(row % 2 ? 'q-a' : 'q-b') });
    assert.equal(stored.status, 200, `row ${row + 1}: ${JSON.stringify(stored.body)}`);
  }
  const refused = await uploadJson({ env, token, resource: 'responses', data: answer('q-a') });
  assert.equal(refused.status, 422);
  assert.equal(refused.body.reason, 'response_limit_rows');
  assert.match(refused.body.error, /10 answers/);
  assert.equal((await uploadJson({ env, token: await person(), resource: 'responses', data: answer('q-a') })).status, 200);
});

test('a survey submit, its bundle and then each answer, counts each answer once', async () => {
  const { env, person } = await setup(['q-only']);
  const token = await person();
  // One question allows five saved answers. A bundle counted as an answer too would stop the third submit.
  for (let submit = 0; submit < 5; submit += 1) {
    const value = submit % 2 ? 'Agree' : 'Disagree';
    const bundle = await uploadJson({ env, token, resource: 'responses', data: { surveyID: 's-1', ...session, responses: [answer('q-only', value)] } });
    assert.equal(bundle.status, 200, `bundle ${submit + 1}: ${JSON.stringify(bundle.body)}`);
    const stored = await uploadJson({ env, token, resource: 'responses', data: answer('q-only', value) });
    assert.equal(stored.status, 200, `answer ${submit + 1}: ${JSON.stringify(stored.body)}`);
  }
  assert.equal((await uploadJson({ env, token, resource: 'responses', data: answer('q-only') })).body.reason, 'response_limit_rows');
  // Bundles have the same allowance of their own, so they cannot be stored without end.
  const sixth = await uploadJson({ env, token, resource: 'responses', data: { surveyID: 's-1', ...session, responses: [answer('q-only', 'Unsure')] } });
  assert.equal(sixth.status, 422);
  assert.equal(sixth.body.reason, 'response_limit_rows');
  assert.match(sixth.body.error, /surveys/);
});

test('hiding a question does not shrink what people may still save', async () => {
  const { env, person } = await setup(['q-kept', 'q-hidden']);
  const token = await person();
  for (let row = 0; row < 5; row += 1) {
    assert.equal((await uploadJson({ env, token, resource: 'responses', data: answer('q-kept', row % 2 ? 'Agree' : 'Disagree') })).status, 200);
  }
  const hidden = await signedAdminRequest({ env, wallet: setup.admin, action: 'storage/set-hidden', body: { resource: 'questions', id: 'q-hidden', hidden: true } });
  assert.equal(hidden.status, 200, JSON.stringify(hidden.body));
  // Two stored questions still allow ten answers, where one shown question would allow five.
  const sixth = await uploadJson({ env, token, resource: 'responses', data: answer('q-kept', 'Unsure') });
  assert.equal(sixth.status, 200, JSON.stringify(sixth.body));
});

test('parallel uploads cannot pass the limit together', async () => {
  const { env, person } = await setup(Array.from({ length: 10 }, (_, index) => `q-${index}`));
  const token = await person();
  const results = await Promise.all(Array.from({ length: 26 }, (_, index) => (
    uploadJson({ env, token, resource: 'responses', data: answer('q-0', index % 2 ? 'Agree' : 'Disagree') })
  )));
  assert.equal(results.filter((result) => result.status === 200).length, 20);
  assert.ok(results.filter((result) => result.status !== 200).every((result) => result.body.reason === 'response_limit_versions'));
});

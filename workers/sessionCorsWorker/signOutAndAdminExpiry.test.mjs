import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SESSION_ID, SLUG, createSessionEnv, fetchWorker, login, makeRequest, readJson, signedAdminRequest, uploadJson,
} from './sessionWorkerRuntimeFixture.mjs';

const question = (id) => ({ id, type: 'binary', prompt: 'Agree?', sessionId: SESSION_ID, sessionSlug: SLUG });
const logout = async (env, token) => readJson(await fetchWorker(makeRequest('/auth/logout', { method: 'POST', token }), env));

test('signing out revokes the token at the Worker', async () => {
  const { admin, env } = createSessionEnv();
  const token = await login({ env, wallet: admin });
  const other = await login({ env, wallet: admin });
  assert.equal((await uploadJson({ env, token, resource: 'questions', data: question('q-1') })).status, 200);

  assert.deepEqual(await logout(env, token), { status: 200, body: { ok: true } });
  const after = await uploadJson({ env, token, resource: 'questions', data: question('q-2') });
  assert.equal(after.status, 401, JSON.stringify(after.body));
  assert.equal((await logout(env, token)).status, 401);
  // Only that sign-in ends.
  assert.equal((await uploadJson({ env, token: other, resource: 'questions', data: question('q-3') })).status, 200);
  assert.equal((await logout(env, '')).status, 401);
});

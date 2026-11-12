import assert from 'node:assert/strict';
import test from 'node:test';

import { Wallet } from 'ethers';
import {
  SLUG, createSessionEnv, fetchWorker, login, makeRequest, readJson, signedAdminRequest,
} from './sessionWorkerRuntimeFixture.mjs';

const AUTH_FAILED = 'Admin authorization failed.';

const setup = () => {
  const resultsAdmin = Wallet.createRandom();
  const session = createSessionEnv({ configOverrides: { resultsAdminAddresses: [resultsAdmin.address.toLowerCase()] } });
  return { ...session, resultsAdmin, stranger: Wallet.createRandom() };
};

const readAs = async ({ env, wallet, path }) => readJson(await fetchWorker(
  makeRequest(`${path}?slug=${SLUG}`, { token: await login({ env, wallet }) }), env,
));

test('a results admin reads AI Views status as the admin does; others may not, nor read diagnostics', async () => {
  const { admin, env, resultsAdmin, stranger } = setup();
  const asAdmin = await readAs({ env, wallet: admin, path: '/admin/results-analysis/status' });
  assert.equal(asAdmin.status, 200, JSON.stringify(asAdmin.body));
  const asResultsAdmin = await readAs({ env, wallet: resultsAdmin, path: '/admin/results-analysis/status' });
  assert.equal(asResultsAdmin.status, 200, JSON.stringify(asResultsAdmin.body));
  assert.deepEqual(asResultsAdmin.body, asAdmin.body);

  const asStranger = await readAs({ env, wallet: stranger, path: '/admin/results-analysis/status' });
  assert.equal(asStranger.status, 403);
  const diagnostics = await readAs({ env, wallet: resultsAdmin, path: '/admin/diagnostics' });
  assert.equal(diagnostics.status, 403);
  assert.equal(diagnostics.body.error, AUTH_FAILED);
});

test('a results admin starts AI Views as the admin does, and gets nothing else an admin has', async () => {
  const { admin, env, resultsAdmin, stranger } = setup();
  const generate = (wallet) => signedAdminRequest({ env, wallet, action: 'results-analysis/generate', body: {} });
  const asAdmin = await generate(admin);
  const asResultsAdmin = await generate(resultsAdmin);
  assert.notEqual(asResultsAdmin.body.error, AUTH_FAILED);
  assert.equal(asResultsAdmin.status, asAdmin.status, JSON.stringify(asResultsAdmin.body));
  assert.equal(asResultsAdmin.body.error, asAdmin.body.error);
  assert.equal((await generate(stranger)).status, 403);

  for (const [action, body] of [
    ['set-config', { config: { ...setup().config, sessionName: 'Taken over' } }],
    ['set-secrets', { secrets: {} }],
    ['secret-presence', {}],
    ['export-storage-envelopes', {}],
    ['export-session-backup', {}],
    ['export-recovery-key', {}],
  ]) {
    // A fresh session each time: sign-in nonces are limited per address.
    const fresh = setup();
    const refused = await signedAdminRequest({ env: fresh.env, wallet: fresh.resultsAdmin, action, body });
    assert.equal(refused.status, 403, `${action}: ${JSON.stringify(refused.body)}`);
  }
});

test('only the admin may build AI Views from answers the request supplies', async () => {
  const supplied = [
    { source: { kind: 'admin-snapshot', snapshot: { sessionSlug: SLUG, questions: [], responses: [] } } },
    { sourceKind: 'admin-snapshot' },
    { committedResponses: [{ metadata: { responder: '0x00000000000000000000000000000000000000ee' }, payload: { questionID: 'q1', answer: 'Agree' } }] },
  ];
  for (const body of supplied) {
    const { env, resultsAdmin } = setup();
    const refused = await signedAdminRequest({ env, wallet: resultsAdmin, action: 'results-analysis/generate', body });
    assert.equal(refused.status, 403, JSON.stringify(body));
    assert.match(refused.body.error, /Only the session admin can build AI Views from supplied answers/);
    const { admin, env: adminEnv } = setup();
    const asAdmin = await signedAdminRequest({ env: adminEnv, wallet: admin, action: 'results-analysis/generate', body });
    assert.doesNotMatch(String(asAdmin.body.error), /supplied answers|Admin authorization failed/);
  }
});

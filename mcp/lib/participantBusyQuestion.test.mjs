import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ethers } from 'ethers';
import { createParticipant } from './participant.mjs';
const fixture = JSON.parse(await readFile(new URL('../../tests/fixtures/worker-compat/previous-minor.json', import.meta.url), 'utf8'));

test('an answer to a question that could not be read says to retry, not that the question is unknown', async (t) => {
  const stateDir = await mkdtemp(join(tmpdir(), 'ce-busy-question-'));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  const participant = createParticipant({
    wallet: ethers.Wallet.createRandom(),
    config: { stateDir, profile: {}, appOrigin: 'https://contextengine.sh', trustedAppOrigins: ['https://contextengine.sh'] },
    fetchImpl: async (input) => {
      const url = new URL(input);
      if (url.pathname === '/session-config') return Response.json({ config: fixture.config });
      if (url.pathname === '/auth/nonce') return Response.json({ nonce: 'fixtureNonce12345' });
      if (url.pathname === '/auth/login') return Response.json({ token: 'fixture-token' });
      if (url.pathname === '/resource-presence') return Response.json({});
      if (url.pathname === '/storage/list') {
        const resource = url.searchParams.get('resource');
        return Response.json({
          items: fixture.records.filter(({ metadata }) => metadata.resource === resource).map(({ metadata }) => ({
            metadata, storageRef: { backend: 'cloudflare', resource, id: metadata.id },
          })), cursor: null, listComplete: true,
        });
      }
      // Every question read fails, as when the session is too busy to answer.
      if (url.pathname === '/storage/read') return Response.json({ error: 'Temporarily unavailable.' }, { status: 500 });
      throw new Error(`Unexpected route: ${url.pathname}`);
    },
  });
  await participant.joinSession({ worker: fixture.config.corsWorkerUrl, session: fixture.config.slug });
  const [questionId] = fixture.expectedQuestions[0];
  const { results } = await participant.answer({ answers: [{ questionId, value: 'Agree' }] });
  assert.equal(results[0].ok, false);
  assert.match(results[0].error, /could not be read just now/);
});

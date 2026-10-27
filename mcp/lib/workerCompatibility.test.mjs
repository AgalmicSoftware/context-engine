import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ethers } from 'ethers';
import { createParticipant } from './participant.mjs';
const fixture = JSON.parse(await readFile(new URL('../../tests/fixtures/worker-compat/previous-minor.json', import.meta.url), 'utf8'));

for (const upgraded of [false, true]) {
  test(`MCP reader agrees on previous-format history (upgraded=${upgraded})`, async (t) => {
    const stateDir = await mkdtemp(join(tmpdir(), 'ce-compat-'));
    t.after(() => rm(stateDir, { recursive: true, force: true }));
    const records = [...fixture.records, ...(upgraded ? fixture.upgradedRecords : [])];
    const wallet = ethers.Wallet.createRandom();
    const participant = createParticipant({
      wallet,
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
            items: records.filter(({ metadata }) => metadata.resource === resource).map(({ metadata }) => ({
              metadata, storageRef: { backend: 'cloudflare', resource, id: metadata.id },
            })), cursor: null, listComplete: true,
          });
        }
        if (url.pathname === '/storage/read') return Response.json(records.find(({ metadata }) => metadata.id === url.searchParams.get('id'))?.payload);
        throw new Error(`Unexpected route: ${url.pathname}`);
      },
    });
    await participant.joinSession({ worker: fixture.config.corsWorkerUrl, session: fixture.config.slug });
    const listed = await participant.listQuestions({ filter: 'all' });
    assert.deepEqual(listed.questions.map(({ id, prompt }) => [id, prompt]).sort(([a], [b]) => a.localeCompare(b)),
      upgraded ? fixture.expectedUpgradedQuestions : fixture.expectedQuestions);
  });
}

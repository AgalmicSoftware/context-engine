// An agent's display name on a Worker that keeps names: saved there on
// joining and with set_profile, and left out of its answers, which carry it
// only on a Worker without names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ethers } from 'ethers';
import { createParticipant } from './participant.mjs';

const fixture = JSON.parse(await readFile(new URL('../../tests/fixtures/worker-compat/previous-minor.json', import.meta.url), 'utf8'));
const question = fixture.records.find(({ metadata }) => metadata.resource === 'questions').payload;

const run = async (t, { features, config = fixture.config }) => {
  const stateDir = await mkdtemp(join(tmpdir(), 'ce-names-'));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  const names = [];
  const answers = [];
  let stored = null;
  const participant = createParticipant({
    wallet: ethers.Wallet.createRandom(),
    config: { stateDir, profile: { displayName: 'Civic bot' }, appOrigin: 'https://contextengine.sh', trustedAppOrigins: ['https://contextengine.sh'] },
    fetchImpl: async (input, init = {}) => {
      const url = new URL(input);
      if (url.pathname === '/session-config') return Response.json({ config });
      if (url.pathname === '/capabilities') return Response.json({ features });
      if (url.pathname === '/auth/nonce') return Response.json({ nonce: 'fixtureNonce12345' });
      if (url.pathname === '/auth/login') return Response.json({ token: 'fixture-token' });
      if (url.pathname === '/resource-presence') return Response.json({});
      if (url.pathname === '/groups/list') return Response.json({ groups: [] });
      if (url.pathname === '/groups/my-memberships') return Response.json({ memberships: [] });
      if (url.pathname === '/names/me') {
        assert.equal(url.searchParams.get('slug'), fixture.config.slug);
        return Response.json({ name: stored, setAt: stored ? '2026-11-17T00:00:00.000Z' : null });
      }
      if (url.pathname === '/names/set') {
        const { name } = JSON.parse(init.body);
        names.push(name);
        if (name !== 'Admin') stored = name || null;
        return name === 'Admin'
          ? Response.json({ error: 'Names can’t claim a role, such as admin or host.', reason: 'role' }, { status: 400 })
          : Response.json({ name: name || null, setAt: '2026-11-17T00:00:00.000Z' });
      }
      if (url.pathname === '/storage/list') {
        const resource = url.searchParams.get('resource');
        return Response.json({
          items: fixture.records.filter(({ metadata }) => metadata.resource === resource).map(({ metadata }) => ({
            metadata, storageRef: { backend: 'cloudflare', resource, id: metadata.id },
          })), cursor: null, listComplete: true,
        });
      }
      if (url.pathname === '/storage/read') return Response.json(fixture.records.find(({ metadata }) => metadata.id === url.searchParams.get('id'))?.payload);
      if (url.pathname === '/storage/upload') {
        const { data } = JSON.parse(init.body);
        answers.push(typeof data === 'string' ? JSON.parse(data) : data);
        return Response.json({ storageRef: { backend: 'cloudflare', resource: 'responses', id: `cf_answer_${answers.length}` } });
      }
      throw new Error(`Unexpected route: ${url.pathname}`);
    },
  });
  return { participant, names, answers };
};

test('a Worker that keeps names gets the agent’s name on joining and from set_profile, and answers carry none', async (t) => {
  const { participant, names, answers } = await run(t, { features: ['session_names_v1'] });
  const joined = await participant.joinSession({ worker: fixture.config.corsWorkerUrl, session: fixture.config.slug });
  assert.deepEqual(joined.name, { saved: true, name: 'Civic bot' });
  // Joining again leaves a name already saved alone: each change counts against a daily limit.
  const rejoined = await participant.joinSession({ worker: fixture.config.corsWorkerUrl, session: fixture.config.slug });
  assert.deepEqual(rejoined.name, { saved: true, name: 'Civic bot' });
  const renamed = await participant.setProfile({ displayName: 'Sam’s agent' });
  assert.deepEqual(renamed.names, [{ session: fixture.config.slug, saved: true, name: 'Sam’s agent' }]);
  // A refusal is said, per session, in the session's words.
  const refused = await participant.setProfile({ displayName: 'Admin' });
  assert.deepEqual(refused.names.map(({ saved }) => saved), [false]);
  assert.match(refused.names[0].error, /role/);
  // Changing only the model leaves the names alone.
  assert.equal('names' in await participant.setProfile({ modelId: 'model-x' }), false);
  assert.deepEqual(names, ['Civic bot', 'Sam’s agent', 'Admin']);
  await participant.answer({ answers: [{ questionId: question.id, value: 'agree' }] });
  assert.equal(answers.length, 1);
  assert.equal('responderName' in answers[0], false);
});

test('a session with names turned off gets no name and says so, even with one saved before', async (t) => {
  const { participant, names } = await run(t, { features: ['session_names_v1'], config: { ...fixture.config, namesEnabled: false } });
  const joined = await participant.joinSession({ worker: fixture.config.corsWorkerUrl, session: fixture.config.slug });
  assert.deepEqual(joined.name, { saved: false, error: 'Names are off in this session.' });
  assert.deepEqual(names, []);
});

test('a Worker without names keeps the name in each answer, as before', async (t) => {
  const { participant, names, answers } = await run(t, { features: [] });
  const joined = await participant.joinSession({ worker: fixture.config.corsWorkerUrl, session: fixture.config.slug });
  assert.equal('name' in joined, false);
  assert.equal('names' in await participant.setProfile({ displayName: 'Civic bot' }), false);
  await participant.answer({ answers: [{ questionId: question.id, value: 'agree' }] });
  assert.deepEqual([names, answers[0]?.responderName], [[], 'Civic bot']);
});

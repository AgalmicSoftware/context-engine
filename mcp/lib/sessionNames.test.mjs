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

// worker.features and worker.setRefusal may change mid-test, as on a redeploy;
// worker.capabilitiesDown makes the feature list unreadable; worker.onUpload and
// worker.onOwnRead run with each upload and each read of the agent's own name; clock.now moves the time the participant reads; restart()
// starts another process on the same key and state.
const run = async (t, { features, config = fixture.config }) => {
  const stateDir = await mkdtemp(join(tmpdir(), 'ce-names-'));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  const names = [];
  const answers = [];
  const worker = { features, setRefusal: null, ownReads: 0, stored: null, capabilitiesDown: false, onUpload: () => {}, onOwnRead: () => {} };
  const clock = { now: Date.parse('2026-11-18T12:00:00.000Z') };
  const wallet = ethers.Wallet.createRandom();
  const start = () => createParticipant({
    wallet,
    config: { stateDir, profile: { displayName: 'Civic bot' }, appOrigin: 'https://contextengine.sh', trustedAppOrigins: ['https://contextengine.sh'] },
    now: () => clock.now,
    fetchImpl: async (input, init = {}) => {
      const url = new URL(input);
      if (url.pathname === '/session-config') return Response.json({ config });
      if (url.pathname === '/capabilities') {
        return worker.capabilitiesDown ? Response.json({ error: 'down' }, { status: 500 }) : Response.json({ features: worker.features });
      }
      if (url.pathname === '/auth/nonce') return Response.json({ nonce: 'fixtureNonce12345' });
      if (url.pathname === '/auth/login') return Response.json({ token: 'fixture-token' });
      if (url.pathname === '/resource-presence') return Response.json({});
      if (url.pathname === '/groups/list') return Response.json({ groups: [] });
      if (url.pathname === '/groups/my-memberships') return Response.json({ memberships: [] });
      if (url.pathname === '/names/me') {
        assert.equal(url.searchParams.get('slug'), fixture.config.slug);
        worker.ownReads += 1;
        worker.onOwnRead();
        return Response.json({ name: worker.stored, setAt: worker.stored ? '2026-11-17T00:00:00.000Z' : null });
      }
      if (url.pathname === '/names/set') {
        const { name } = JSON.parse(init.body);
        names.push(name);
        if (worker.setRefusal) return Response.json(worker.setRefusal.body, { status: worker.setRefusal.status });
        if (name !== 'Admin') worker.stored = name || null;
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
        worker.onUpload();
        return Response.json({ storageRef: { backend: 'cloudflare', resource: 'responses', id: `cf_answer_${answers.length}` } });
      }
      throw new Error(`Unexpected route: ${url.pathname}`);
    },
  });
  return { participant: start(), restart: start, names, answers, worker, clock };
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

// The Worker's own refusals for a save: the daily limit, and the store or limit busy.
const DAILY_LIMIT = { status: 429, body: { error: 'You’ve changed your name 10 times today. Try again tomorrow.', reason: 'rate_limited' } };
const BUSY = { status: 503, body: { error: 'Names couldn’t be reached just now. Try again shortly.', reason: 'names_unavailable' } };
const answerOnce = (participant) => participant.answer({ answers: [{ questionId: question.id, value: 'agree' }] });

test('an agent that joined before its Worker kept names saves its name with its next answer, once', async (t) => {
  const { participant, names, answers, worker, clock } = await run(t, { features: [] });
  await participant.joinSession({ worker: fixture.config.corsWorkerUrl, session: fixture.config.slug });
  assert.equal((await answerOnce(participant)).submitted, 1);
  assert.equal(answers[0].responderName, 'Civic bot');
  // The Worker is redeployed with names; the agent's next answer carries none, so the session gets it.
  worker.features = ['session_names_v1'];
  clock.now += 60_000;
  const after = await answerOnce(participant);
  assert.equal(after.submitted, 1);
  assert.equal('name' in after, false);
  assert.equal('responderName' in answers[1], false);
  assert.deepEqual(names, ['Civic bot']);
  // Later answers neither save nor read it again.
  const reads = worker.ownReads;
  await answerOnce(participant);
  assert.deepEqual([names, worker.ownReads], [['Civic bot'], reads]);
});

for (const earlier of [false, true]) {
  test(`a name saved on joining${earlier ? ', or found saved from an earlier run,' : ''} is not read or saved again by answers`, async (t) => {
    const { participant, names, worker } = await run(t, { features: ['session_names_v1'] });
    if (earlier) worker.stored = 'Civic bot';
    await participant.joinSession({ worker: fixture.config.corsWorkerUrl, session: fixture.config.slug });
    const reads = worker.ownReads;
    await answerOnce(participant);
    await answerOnce(participant);
    assert.deepEqual([names, worker.ownReads], [earlier ? [] : ['Civic bot'], reads]);
  });
}

test('a call that stored no answer saves no name', async (t) => {
  const { participant, names, worker, clock } = await run(t, { features: [] });
  await participant.joinSession({ worker: fixture.config.corsWorkerUrl, session: fixture.config.slug });
  worker.features = ['session_names_v1'];
  clock.now += 60_000;
  const refused = await participant.answer({ answers: [{ questionId: '0xfeed', value: 'agree' }] });
  assert.deepEqual([refused.submitted, 'name' in refused, names, worker.ownReads], [0, false, [], 0]);
  await answerOnce(participant);
  assert.deepEqual(names, ['Civic bot']);
});

for (const [label, refusal] of [['the daily limit', DAILY_LIMIT], ['a busy Worker', BUSY]]) {
  test(`a save refused by ${label} keeps the answers, says so once, and is not tried on every answer`, async (t) => {
    const { participant, names, answers, worker, clock } = await run(t, { features: [] });
    await participant.joinSession({ worker: fixture.config.corsWorkerUrl, session: fixture.config.slug });
    worker.features = ['session_names_v1'];
    worker.setRefusal = refusal;
    clock.now += 60_000;
    const first = await answerOnce(participant);
    assert.deepEqual([first.submitted, first.failed, first.results[0].ok], [1, 0, true]);
    assert.equal(answers.length, 1);
    assert.equal(first.name.saved, false);
    assert.ok(first.name.error.includes(refusal.body.error), first.name.error);
    assert.match(first.name.next, /set_profile/);
    const second = await answerOnce(participant);
    assert.deepEqual([second.submitted, 'name' in second, names.length], [1, false, 1]);
    // set_profile still tries again when asked.
    worker.setRefusal = null;
    const retried = await participant.setProfile({ displayName: 'Civic bot' });
    assert.deepEqual(retried.names, [{ session: fixture.config.slug, saved: true, name: 'Civic bot' }]);
  });
}

test('a save that failed on joining is tried once more by the next answer', async (t) => {
  const { participant, names, worker } = await run(t, { features: ['session_names_v1'] });
  worker.setRefusal = BUSY;
  const joined = await participant.joinSession({ worker: fixture.config.corsWorkerUrl, session: fixture.config.slug });
  assert.equal(joined.name.saved, false);
  worker.setRefusal = null;
  const answered = await answerOnce(participant);
  assert.equal('name' in answered, false);
  assert.deepEqual(names, ['Civic bot', 'Civic bot']);
  await answerOnce(participant);
  assert.equal(names.length, 2);
});

test('answers save no name where the admins turned names off', async (t) => {
  const { participant, names, worker, clock, answers } = await run(t, { features: [], config: { ...fixture.config, namesEnabled: false } });
  await participant.joinSession({ worker: fixture.config.corsWorkerUrl, session: fixture.config.slug });
  worker.features = ['session_names_v1'];
  clock.now += 60_000;
  const answered = await answerOnce(participant);
  assert.deepEqual([answered.submitted, 'name' in answered, names, worker.ownReads], [1, false, [], 0]);
  assert.equal('responderName' in answers[0], false);
});

test('a name an admin cleared after it was saved is not saved again by answers, even in a later run', async (t) => {
  const { participant, restart, names, worker, clock } = await run(t, { features: [] });
  await participant.joinSession({ worker: fixture.config.corsWorkerUrl, session: fixture.config.slug });
  worker.features = ['session_names_v1'];
  clock.now += 60_000;
  await answerOnce(participant);
  assert.deepEqual(names, ['Civic bot']);
  worker.stored = null;
  const later = restart();
  const answered = await answerOnce(later);
  assert.deepEqual([answered.submitted, 'name' in answered, names, worker.stored], [1, false, ['Civic bot'], null]);
});

test('a save skipped because the features could not be read is tried by the next answer', async (t) => {
  const { participant, names, worker, clock } = await run(t, { features: [] });
  await participant.joinSession({ worker: fixture.config.corsWorkerUrl, session: fixture.config.slug });
  worker.features = ['session_names_v1'];
  clock.now += 60_000;
  // The feature list goes stale during the upload, then can't be read.
  worker.onUpload = () => { clock.now += 60_000; worker.capabilitiesDown = true; };
  const first = await answerOnce(participant);
  assert.deepEqual([first.submitted, 'name' in first, names], [1, false, []]);
  worker.onUpload = () => {};
  worker.capabilitiesDown = false;
  clock.now += 60_000;
  await answerOnce(participant);
  assert.deepEqual(names, ['Civic bot']);
});

test('a call stopped while it saves the name leaves the save to the next answer', async (t) => {
  const { participant, names, worker, clock } = await run(t, { features: [] });
  await participant.joinSession({ worker: fixture.config.corsWorkerUrl, session: fixture.config.slug });
  worker.features = ['session_names_v1'];
  clock.now += 60_000;
  const stop = new AbortController();
  worker.onOwnRead = () => stop.abort();
  const stopped = await participant.answer({ answers: [{ questionId: question.id, value: 'agree' }] }, { signal: stop.signal });
  assert.deepEqual([stopped.submitted, names], [1, []]);
  worker.onOwnRead = () => {};
  await answerOnce(participant);
  assert.deepEqual(names, ['Civic bot']);
});

// The name rule the MCP states is the Worker's own, in both tools that save a
// name, and comes back with a name the session refused, which is sent as given.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ethers } from 'ethers';
import { createParticipant } from './participant.mjs';
import { AGENT_NAME_EXAMPLE, SESSION_NAME_RULE } from './sessionNameRule.mjs';
import { SERVER_INSTRUCTIONS, buildTools } from './tools.mjs';
import { SESSION_NAME_LIMITS, normalizeSessionName } from '../../workers/sessionCorsWorker/sessionNames.js';

const fixture = JSON.parse(await readFile(new URL('../../tests/fixtures/worker-compat/previous-minor.json', import.meta.url), 'utf8'));

test('the names rule the tools state is the Worker’s own', () => {
  const said = (value) => normalizeSessionName(value).error.replace(/^Use /, '').replace(/\.$/, '');
  assert.equal(said('x'.repeat(SESSION_NAME_LIMITS.chars + 1)), `A name can be at most ${SESSION_NAME_LIMITS.chars} characters`);
  assert.ok(SESSION_NAME_RULE.includes(`at most ${SESSION_NAME_LIMITS.chars} characters`));
  assert.ok(SESSION_NAME_RULE.includes(said('Civic bot!')), said('Civic bot!'));
  assert.ok(SESSION_NAME_RULE.includes(said('Admin').match(/such as [^.]+/)[0]));
  assert.ok(!SESSION_NAME_RULE.includes('\n'));
  // Its note on the apostrophe holds: the straight one is taken, the curly one refused.
  assert.deepEqual([normalizeSessionName("Sam's agent").ok, normalizeSessionName('Sam’s agent').reason], [true, 'characters']);
  // Both tools that save a name state it, and set_profile the MCP's own 80 characters.
  const tools = Object.fromEntries(buildTools({}).map((tool) => [tool.name, tool]));
  for (const name of ['set_profile', 'join_session']) assert.ok(tools[name].description.includes(SESSION_NAME_RULE), name);
  assert.match(tools.set_profile.inputSchema.properties.displayName.description, /up to 80 characters of any kind/);
  // set_profile leads with the rule, and its name field and the instructions state its core.
  assert.ok(tools.set_profile.description.startsWith(SESSION_NAME_RULE));
  assert.equal(normalizeSessionName('Agent Trial, Forum').reason, 'characters');
  assert.match(SESSION_NAME_RULE, /no commas or brackets/);
  for (const said of [tools.set_profile.inputSchema.properties.displayName.description, SERVER_INSTRUCTIONS]) {
    assert.ok(said.includes(`at most ${SESSION_NAME_LIMITS.chars} characters, letters, numbers, spaces and . - _ ' only`), said);
  }
  // The name the instructions suggest is one a session takes.
  assert.deepEqual(normalizeSessionName(AGENT_NAME_EXAMPLE), { ok: true, name: AGENT_NAME_EXAMPLE });
  assert.ok(SERVER_INSTRUCTIONS.includes(AGENT_NAME_EXAMPLE));
  assert.match(SERVER_INSTRUCTIONS, /only if set_profile’s names or join_session’s name says saved: true/);
});

test('a name the session refuses is sent as given and comes back with the rule', async (t) => {
  const stateDir = await mkdtemp(join(tmpdir(), 'ce-name-rule-'));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  const sent = [];
  let stored = null;
  const participant = createParticipant({
    wallet: ethers.Wallet.createRandom(),
    config: { stateDir, profile: { displayName: '' }, appOrigin: 'https://contextengine.sh', trustedAppOrigins: ['https://contextengine.sh'] },
    fetchImpl: async (input, init = {}) => {
      const url = new URL(input);
      if (url.pathname === '/session-config') return Response.json({ config: fixture.config });
      if (url.pathname === '/capabilities') return Response.json({ features: ['session_names_v1'] });
      if (url.pathname === '/auth/nonce') return Response.json({ nonce: 'fixtureNonce12345' });
      if (url.pathname === '/auth/login') return Response.json({ token: 'fixture-token' });
      if (url.pathname === '/resource-presence') return Response.json({});
      if (url.pathname === '/groups/list') return Response.json({ groups: [] });
      if (url.pathname === '/groups/my-memberships') return Response.json({ memberships: [] });
      if (url.pathname === '/storage/list') return Response.json({ items: [], cursor: null, listComplete: true });
      if (url.pathname === '/names/me') return Response.json({ name: stored, setAt: null });
      if (url.pathname === '/names/set') {
        // Refused as the Worker refuses it.
        const { name } = JSON.parse(init.body);
        sent.push(name);
        const checked = normalizeSessionName(name);
        if (!checked.ok) return Response.json({ error: checked.error, reason: checked.reason }, { status: 400 });
        stored = checked.name || null;
        return Response.json({ name: stored, setAt: '2026-11-18T00:00:00.000Z' });
      }
      throw new Error(`Unexpected route: ${url.pathname}`);
    },
  });
  await participant.joinSession({ worker: fixture.config.corsWorkerUrl, session: fixture.config.slug });
  const long = 'An agent with a name of forty characters';
  const results = [];
  for (const displayName of [long, 'Sam’s agent', 'Admin', "Sam's agent"]) results.push((await participant.setProfile({ displayName })).names[0]);
  assert.deepEqual(sent, [long, 'Sam’s agent', 'Admin', "Sam's agent"]);
  assert.deepEqual(results.map(({ saved, rule }) => [saved, rule]),
    [[false, SESSION_NAME_RULE], [false, SESSION_NAME_RULE], [false, SESSION_NAME_RULE], [true, undefined]]);
  assert.match(results[0].error, /at most 32 characters/);
  assert.match(results[2].error, /role/);
  const one = await participant.setProfile({ displayName: 'Admin' });
  assert.match(one.warning, /^Your name was not saved in 1 of 1 joined session that keeps names: compat-session \(Names can’t claim a role, such as admin or host\.\)\. Only/);
});

// Two sessions that keep names, each with the Worker's own rule; the second can be made busy.
const twoSessions = async (t) => {
  const stateDir = await mkdtemp(join(tmpdir(), 'ce-name-two-'));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  const second = { ...fixture.config, slug: 'forum-b', corsWorkerUrl: 'https://forum-b-worker.example.test',
    sessionId: '0x44444444444444444444444444444444', sessionIdHex: '0x44444444444444444444444444444444' };
  const sessions = { [fixture.config.corsWorkerUrl]: { config: fixture.config, stored: null, busy: false },
    [second.corsWorkerUrl]: { config: second, stored: null, busy: false, off: false } };
  const sent = [];
  const participant = createParticipant({
    wallet: ethers.Wallet.createRandom(),
    config: { stateDir, profile: { displayName: '' }, appOrigin: 'https://contextengine.sh', trustedAppOrigins: ['https://contextengine.sh'] },
    fetchImpl: async (input, init = {}) => {
      const url = new URL(input);
      const at = sessions[url.origin];
      if (url.pathname === '/session-config') return Response.json({ config: at.config });
      if (url.pathname === '/capabilities') return Response.json({ features: ['session_names_v1'] });
      if (url.pathname === '/auth/nonce') return Response.json({ nonce: 'fixtureNonce12345' });
      if (url.pathname === '/auth/login') return Response.json({ token: 'fixture-token' });
      if (url.pathname === '/resource-presence') return Response.json({});
      if (url.pathname === '/groups/list') return Response.json({ groups: [] });
      if (url.pathname === '/groups/my-memberships') return Response.json({ memberships: [] });
      if (url.pathname === '/storage/list') return Response.json({ items: [], cursor: null, listComplete: true });
      if (url.pathname === '/names/me') return Response.json({ name: at.stored, setAt: null });
      if (url.pathname === '/names/set') {
        const { name } = JSON.parse(init.body);
        sent.push([at.config.slug, name]);
        if (at.off) return Response.json({ error: 'Names are off in this session', reason: 'names_off' }, { status: 403 });
        if (at.busy) return Response.json({ error: 'Names couldn’t be reached just now. Try again shortly.', reason: 'names_unavailable' }, { status: 503 });
        const checked = normalizeSessionName(name);
        if (!checked.ok) return Response.json({ error: checked.error, reason: checked.reason }, { status: 400 });
        at.stored = checked.name || null;
        return Response.json({ name: at.stored, setAt: '2026-11-18T00:00:00.000Z' });
      }
      throw new Error(`Unexpected route: ${url.pathname}`);
    },
  });
  for (const config of [fixture.config, second]) await participant.joinSession({ worker: config.corsWorkerUrl, session: config.slug });
  return { participant, sessions, second, sent };
};

test('set_profile says first which sessions did not take a name, why, and what next, and never shortens it', async (t) => {
  const { participant, sessions, second, sent } = await twoSessions(t);
  const [a, b] = [fixture.config.slug, second.slug];
  sessions[second.corsWorkerUrl].busy = true;
  // 33 characters with a comma: refused by length in one session, the other busy.
  const tooLong = 'Forum Agent Trial, 19 November 26';
  const refused = await participant.setProfile({ displayName: tooLong });
  assert.equal(Object.keys(refused)[0], 'warning');
  assert.match(refused.warning, new RegExp(`^Your name was not saved in 2 of 2 joined sessions that keep names: ${a} \\(A name can be at most 32 characters\\.\\); ${b} \\(Names couldn’t[^)]*\\)\\. Only this MCP’s`));
  assert.match(refused.warning, /Only this MCP’s profile changed for them.*Don’t say your name is set there\./);
  assert.equal(refused.profile.displayName, tooLong);
  assert.deepEqual(refused.names.map(({ session, saved, rule }) => [session, saved, rule]), [[a, false, SESSION_NAME_RULE], [b, false, undefined]]);
  assert.match(refused.names[0].next, /fits the rule.*nothing shortens or changes it/);
  assert.match(refused.names[1].next, /again later/);
  assert.doesNotMatch(refused.note, /from now on|Saved/);
  assert.equal(Object.getOwnPropertySymbols(refused).length, 0, 'the local profile changed, so the call is not marked failed');
  // A comma within 32 characters is refused for its character.
  const comma = await participant.setProfile({ displayName: 'Forum Agent Trial, 19 November 2' });
  assert.match(comma.names[0].error, /letters, numbers, spaces/);
  // The name without its comma fits: saved in one session, the other still busy.
  const fits = 'Forum Agent Trial 19 November 26';
  const partly = await participant.setProfile({ displayName: fits });
  assert.match(partly.warning, new RegExp(`^Your name was not saved in 1 of 2 joined sessions that keep names: ${b} \\(`));
  assert.equal(partly.note, `Saved as your name in ${a}.`);
  assert.deepEqual(partly.names.map(({ saved }) => saved), [true, false]);
  // Once the busy session answers, no warning.
  sessions[second.corsWorkerUrl].busy = false;
  const saved = await participant.setProfile({ displayName: fits });
  assert.equal('warning' in saved, false);
  assert.equal(saved.note, `Saved as your name in ${a}, ${b}.`);
  // Clearing still works, and says so.
  const cleared = await participant.setProfile({ displayName: '' });
  assert.equal('warning' in cleared, false);
  assert.equal(cleared.note, `Your name was removed in ${a}, ${b}.`);
  assert.deepEqual([sessions[fixture.config.corsWorkerUrl].stored, sessions[second.corsWorkerUrl].stored], [null, null]);
  // Names turned off after the settings were read: nothing to retry there.
  sessions[second.corsWorkerUrl].off = true;
  const off = await participant.setProfile({ displayName: fits });
  assert.match(off.names[1].next, /nothing to retry/);
  sessions[second.corsWorkerUrl].off = false;
  // Every name went to the sessions exactly as given.
  assert.deepEqual([...new Set(sent.map(([, name]) => name))], [tooLong, 'Forum Agent Trial, 19 November 2', fits, '']);
  // A change of model alone touches no names and says what it applies to.
  const model = await participant.setProfile({ modelId: 'model-x' });
  assert.deepEqual(['names' in model, 'warning' in model, model.note], [false, false, 'The model applies to answers and statements submitted from now on.']);
});

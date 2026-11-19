// The name rule the MCP states is the Worker's own, in both tools that save a
// name, and comes back with a name the session refused, which is sent as given.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ethers } from 'ethers';
import { createParticipant } from './participant.mjs';
import { SESSION_NAME_RULE } from './sessionNameRule.mjs';
import { buildTools } from './tools.mjs';
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
});

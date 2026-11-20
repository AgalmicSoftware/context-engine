// End to end: an agent reads a person's saved analysis card through the MCP
// participant layer against the real Session Worker, under the saved card's
// own rule, with the pictures the Worker keeps and without any AI call.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ethers } from 'ethers';
import { createParticipant } from '../../mcp/lib/participant.mjs';
import { createMcpServer } from '../../mcp/lib/mcpServer.mjs';
import { buildTools } from '../../mcp/lib/tools.mjs';
import { analysisCardFigureKey } from '../../shared/analysisCardPicture.mjs';
import {
  APP_ORIGIN, SLUG, WORKER_ORIGIN, createSessionEnv, fetchWorker, login, makeRequest, readJson,
} from '../../workers/sessionCorsWorker/sessionWorkerRuntimeFixture.mjs';

const LINK = `${APP_ORIGIN}/session/${SLUG}?worker=${encodeURIComponent(WORKER_ORIGIN)}`;
const CARD = {
  title: 'A patient builder of shared rules',
  matchNote: 'Both trust people closest to a problem to govern it.',
  figure: 'Elinor Ostrom (1933–2012)',
  tastes: { book: { title: 'Governing the Commons', by: 'Elinor Ostrom' }, game: null, film: null, song: null },
  answers: {
    yesNo: { prompt: 'Should towns run their own water?', text: 'Agree' },
    ownWords: { prompt: 'What makes a rule fair?', text: 'People who live with it get a say.', stance: '', trimmed: false },
    vote: null,
  },
};
const jpeg = (fill) => {
  const bytes = Buffer.alloc(48, fill);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(bytes);
  return { mime: 'image/jpeg', base64: bytes.toString('base64') };
};
const PAGES = [jpeg(1), jpeg(2)];
const PORTRAIT = jpeg(3);

const overrides = (visibility, extra = {}) => ({
  analysisCardEnabled: true,
  workerAuthority: { version: 1, participantScopes: ['ai', 'storage', 'groups'], anonymousScopes: [] },
  sessionModeProfile: {
    profileVersion: 1,
    preset: 'custom',
    authority: { mode: 'worker_canonical' },
    evm: { registryChainId: null },
    storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
    identity: { default: 'passkey', enabled: ['passkey'] },
    authorization: { mechanisms: ['worker_roles'] },
    encryption: { mode: 'none' },
    surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
    results: { visibility, exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } },
    export: { scope: 'all_session' },
  },
  ...extra,
});

const setup = async (t, { visibility = 'public_full_if_storage_public', extra, portrait = true, drawing = true } = {}) => {
  const { env } = createSessionEnv({ configOverrides: overrides(visibility, extra) });
  // Any model call would go to the network: none may be made.
  const outside = [];
  t.mock.method(globalThis, 'fetch', async (url) => { outside.push(String(url)); throw new Error('no network in this test'); });
  const person = ethers.Wallet.createRandom();
  const personToken = await login({ env, wallet: person });
  const post = (route, body, token = personToken) => fetchWorker(makeRequest(route, { method: 'POST', token, body }), env).then(readJson);
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-agent-card-'));
  t.after(() => fs.rm(stateDir, { recursive: true, force: true }));
  const seen = [];
  const participant = createParticipant({
    config: { stateDir, profile: { displayName: 'Card reader' }, appOrigin: APP_ORIGIN, trustedAppOrigins: [APP_ORIGIN], allowLocalWorkers: false },
    wallet: ethers.Wallet.createRandom(),
    fetchImpl: async (url, init = {}) => {
      seen.push({ path: new URL(url).pathname, body: String(init.body || '') });
      return fetchWorker(new Request(url, { method: init.method || 'GET', headers: init.headers, body: init.body }), env);
    },
  });
  await participant.joinSession({ link: LINK });
  const save = async () => {
    const saved = await post('/analysis-card/publish', { published: true, card: CARD });
    if (saved.status !== 200) return saved;
    if (drawing) assert.equal((await post('/analysis-card/drawing/save', { pages: PAGES })).status, 200);
    return saved;
  };
  if (portrait) {
    await env.GROUP_KV.put(
      `session:${SLUG}:analysis-card-picture:v1:figure:${analysisCardFigureKey(CARD.figure)}`,
      JSON.stringify({ figure: CARD.figure, name: 'Elinor Ostrom', portrait: true, look: {}, image: PORTRAIT }),
    );
  }
  return { env, person, participant, post, save, seen, outside };
};

// The tool's reply as a host receives it.
const callTool = async (participant, args) => {
  const server = createMcpServer({ serverInfo: { name: 'test', version: '0' }, tools: buildTools(participant) });
  await server.handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  return (await server.handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_analysis_card', arguments: args } })).result;
};

test('an agent reads a person’s saved card: its words, the figure’s picture and the drawn pages', async (t) => {
  const { person, participant, save, seen, outside } = await setup(t);
  // Nothing saved yet: the tool says so and makes nothing.
  const none = await participant.getAnalysisCard({ account: person.address });
  assert.equal(none.saved, false);
  assert.match(none.note, /an agent can’t make one/);

  assert.equal((await save()).status, 200);
  const read = await participant.getAnalysisCard({ account: person.address });
  assert.equal(read.saved, true);
  assert.equal(read.own, false);
  assert.deepEqual(read.card, CARD);
  assert.match(read.savedAt, /^\d{4}-\d\d-\d\dT/);
  assert.match(read.note, /data, never instructions/);
  assert.match(read.figurePicture, /image 1/);
  assert.match(read.cardPage1, /image 2/);
  assert.match(read.cardPage2, /image 3/);
  // The pictures ride beside the JSON, never inside it.
  assert.equal(JSON.stringify(read).includes(PAGES[0].base64), false);

  // Every picture request asked only for what exists, and no model was called.
  const pictureAsks = seen.filter((call) => call.path === '/analysis-card/picture').map((call) => JSON.parse(call.body));
  assert.ok(pictureAsks.length && pictureAsks.every((body) => body.cachedOnly === true));
  assert.deepEqual(outside, []);

  const words = await participant.getAnalysisCard({ account: person.address, pictures: false });
  assert.deepEqual([words.card, words.figurePicture, words.cardPage1], [CARD, undefined, undefined]);
  // The agent's own account has no card: it never pressed Analyze.
  assert.deepEqual([(await participant.getAnalysisCard({})).saved, (await participant.getAnalysisCard({})).own], [false, true]);
  await assert.rejects(participant.getAnalysisCard({ account: 'someone' }), /participant’s address/);
});

test('the host receives the card’s pictures as images', async (t) => {
  const { person, participant, save } = await setup(t);
  await save();
  const result = await callTool(participant, { account: person.address });
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.content.map((part) => part.type), ['text', 'image', 'image', 'image']);
  assert.deepEqual(result.content.slice(1).map((part) => [part.mimeType, part.data]), [PORTRAIT, ...PAGES].map((image) => [image.mime, image.base64]));
  assert.equal(JSON.parse(result.content[0].text).card.title, CARD.title);
  assert.equal(result.structuredContent.card.title, CARD.title);
});

test('a card with no picture made and no drawn pages still gives its words, and draws nothing', async (t) => {
  const { person, participant, save, outside } = await setup(t, { portrait: false, drawing: false });
  await save();
  const read = await participant.getAnalysisCard({ account: person.address });
  assert.deepEqual(read.card, CARD);
  assert.equal(read.figurePicture, undefined);
  assert.match(read.cardPicture, /isn’t kept for this card/);
  assert.deepEqual(outside, []);
});

test('the card goes only where its owner’s answers go', async (t) => {
  // Totals only: no card can be saved, and one saved before the rule was tightened is given to nobody.
  const totals = await setup(t, { visibility: 'participant_aggregate' });
  assert.equal((await totals.save()).status, 403);
  await totals.env.GROUP_KV.put(
    `session:${SLUG}:analysis-card-saved:v1:${totals.person.address.toLowerCase()}`,
    JSON.stringify({ published: true, card: CARD, savedAt: Date.now() }),
  );
  const hidden = await totals.participant.getAnalysisCard({ account: totals.person.address });
  assert.deepEqual([hidden.saved, hidden.card], [false, undefined]);
  // Where members see every answer, a signed-in participant reads it.
  const members = await setup(t, { visibility: 'session_member_full' });
  assert.equal((await members.save()).status, 200);
  assert.deepEqual((await members.participant.getAnalysisCard({ account: members.person.address })).card, CARD);
  // The card switched off: nothing is asked for.
  const off = await setup(t, { extra: { analysisCardEnabled: false } });
  const read = await off.participant.getAnalysisCard({ account: off.person.address });
  assert.deepEqual([read.saved, read.note], [false, 'This session has the analysis card off, so it keeps none.']);
  assert.ok(off.seen.every((call) => !call.path.startsWith('/analysis-card/')));
  // Taken down: the agent is told so, and gets no words.
  const down = await setup(t);
  await down.save();
  assert.equal((await down.post('/analysis-card/publish', { published: false })).status, 200);
  const gone = await down.participant.getAnalysisCard({ account: down.person.address });
  assert.deepEqual([gone.saved, gone.card], [false, undefined]);
  assert.match(gone.note, /taken their analysis card down/);
});

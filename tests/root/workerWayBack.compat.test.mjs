/**
 * @jest-environment node
 */
// The way back: a session whose Worker is put back on a released bundle after
// running this one. Data, a backup and settings made here must still read,
// restore and save under the released bundle, and come back intact when this
// Worker returns. Released bundles: the one live sessions run, the release
// this one is pinned to, and one from before names.
import { execFileSync } from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ethers } from 'ethers';
import { createSignedSiweBody, installSessionCoordinatorBinding, makeJsonRequest } from '../helpers/sessionCorsWorkerTestUtils.mjs';
import { createWorkerClient } from '../../mcp/lib/workerClient.mjs';
import { createWorkerRuntime } from '../../workers/sessionCorsWorker/worker.js';
import { SessionWriteCoordinator } from '../../workers/sessionCorsWorker/sessionWriteCoordinator.js';
import { analysisCardFigureKey } from '../../shared/analysisCardPicture.mjs';

const repo = path.resolve(__dirname, '../..');
const git = (args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe', maxBuffer: 20 * 1024 * 1024 });
const hasRef = (ref) => {
  try { git(['rev-parse', '--verify', `${ref}^{commit}`]); return true; } catch { return false; }
};
const bundleRef = (ref, what) => {
  if (hasRef(ref)) return ref;
  const message = `The Worker way-back drill requires ${what} ${ref} (fetch full history and tags to run it).`;
  if (process.env.CI) throw new Error(message);
  console.warn(`Skipping locally: ${message}`);
  return '';
};
// The bundle live sessions run (0.9.17). Move this pin deliberately, to the
// bundle live sessions run; never to a moving tag.
const live = bundleRef('refs/tags/worker-bundles-0744dc384f5195baae787632952d41653887c31d', 'the live bundle');
// A bundle from before names (0.9.12), for the names drill.
const beforeNames = bundleRef('refs/tags/worker-bundles-8d41d69ffc6db0fa31d990d306ed2979d9fe02fa', 'a bundle from before names');
// The release this one is pinned to: pin-worker-release names its bundles in the
// deploy helper's example config. WAY_BACK_PINNED_REF stands in for it before
// that release is published (a local run only; CI always takes the pin).
const pinnedRelease = () => {
  const toml = fsSync.readFileSync(path.join(repo, 'workers/deploy-helper/wrangler.example.toml'), 'utf8');
  const [, commit] = toml.match(/releases\/download\/worker-bundles-([a-f0-9]{40})\/sessionCorsWorker\.bundle\.js/) || [];
  if (!commit) throw new Error('The deploy helper example config names no worker-bundles release.');
  return `refs/tags/worker-bundles-${commit}`;
};
const pinned = !process.env.CI && process.env.WAY_BACK_PINNED_REF
  ? bundleRef(process.env.WAY_BACK_PINNED_REF, 'the stand-in for the pinned bundle')
  : bundleRef(pinnedRelease(), 'the pinned bundle');

const loadBundle = async (ref, dir) => {
  const file = path.join(dir, `worker-${ref.replace(/\W+/g, '-')}.mjs`);
  await fs.writeFile(file, git(['show', `${ref}:deploy/cloudflare/session-worker/worker.mjs`]));
  return import(file);
};

const memoryKv = () => {
  const values = new Map();
  const listMetadata = new Map();
  return {
    values,
    get: async (key) => {
      if (!Array.isArray(key)) return values.get(key) ?? null;
      if (key.length < 1 || key.length > 100) throw new Error(`KV GET_BULK failed: ${key.length} keys`);
      return new Map(key.map(name => [name, values.get(name) ?? null]));
    },
    put: async (key, value, options) => {
      if (options?.metadata) listMetadata.set(key, options.metadata);
      else listMetadata.delete(key);
      values.set(key, value);
    },
    delete: async (key) => { listMetadata.delete(key); values.delete(key); },
    list: async ({ prefix = '', cursor = '', limit = 100 } = {}) => {
      const names = [...values.keys()].filter(key => key.startsWith(prefix) && key > cursor).sort();
      const keys = names.slice(0, limit).map(name => (listMetadata.has(name) ? { name, metadata: listMetadata.get(name) } : { name }));
      return { keys, list_complete: names.length <= limit, cursor: names.length > limit ? keys.at(-1).name : '' };
    },
  };
};

const origin = 'https://worker.example';
const site = 'https://app.example';
const slug = 'way-back';
const sessionId = `0x${'3'.repeat(32)}`;
const [owner, member] = [4, 5].map(digit => new ethers.Wallet(`0x${String(digit).repeat(64)}`));
const offline = async () => { throw new Error('Unexpected network call'); };

// One session's stores, kept across redeploys (its KV and its coordinator's
// storage), served by whichever Worker is deployed, and the clients of the
// people signed in to it. `provider` answers this Worker's AI calls.
const drill = async ({ provider = offline } = {}) => {
  const config = JSON.parse(await fs.readFile(path.join(repo, 'tests/fixtures/worker-compat/previous-minor.json'), 'utf8')).config;
  let clock = Date.now();
  const now = jest.spyOn(Date, 'now').mockImplementation(() => clock);
  const kv = memoryKv();
  // A redeploy keeps each store's coordinators' storage; only their code changes.
  const coordinatorStores = new Map();
  const environment = (Coordinator, store = kv) => {
    const env = installSessionCoordinatorBinding({ GROUP_KV: store, CE_STORAGE_INDEX_KV: store,
      CE_STORAGE_ENVELOPE_KEK: 'a'.repeat(64), TOKEN_HMAC_SECRET: 'synthetic-way-back-hmac',
      ADMIN_TRUSTED_ORIGINS: site, BOOTSTRAP_ADMIN_ADDRESS: owner.address }, Coordinator);
    if (!coordinatorStores.has(store)) coordinatorStores.set(store, new Map());
    const kept = coordinatorStores.get(store);
    const binding = env.CE_SESSION_COORDINATOR;
    const get = binding.get;
    binding.get = (id) => {
      const instance = get(id);
      if (!kept.has(id)) kept.set(id, instance.store);
      else if (instance.store !== kept.get(id)) {
        for (const [key, value] of kept.get(id)) instance.store.set(key, value);
        kept.set(id, instance.store);
      }
      return instance;
    };
    return env;
  };
  const runtime = (create, env, fetch = offline) => create(env, { now: () => clock, fetch, rpcFetch: offline });
  const session = { kv, deployed: null, signIns: 0 };
  // The Worker serving the session now; a redeploy swaps it under the same clients.
  session.deploy = (create, Coordinator, fetch) => {
    const env = environment(Coordinator);
    session.deployed = { env, worker: runtime(create, env, fetch) };
    return session.deployed;
  };
  session.current = () => session.deploy(createWorkerRuntime, SessionWriteCoordinator, provider);
  session.released = (bundle) => session.deploy(bundle.createWorkerRuntime, bundle.SessionWriteCoordinator);
  // Sign-ins are counted: a client signs in again on its own after a refused token.
  const clientOf = (target) => wallet => createWorkerClient({ workerOrigin: origin, slug, trustedOrigins: [site], wallet,
    fetchImpl: (url, init) => {
      const at = target();
      if (at === session.deployed && new URL(url).pathname.startsWith('/auth/')) session.signIns += 1;
      return at.worker.fetch(new Request(url, init), at.env, { waitUntil() {} });
    } });
  session.client = clientOf(() => session.deployed);
  session.signed = async (target, action, body = {}) => {
    clock += 61_000;
    const signedBody = await createSignedSiweBody({ worker: target.worker, env: target.env, wallet: owner, sessionSlug: slug, sessionId,
      adminAction: action, audience: site, body });
    const response = await target.worker.fetch(makeJsonRequest(`/admin/${action}`, signedBody, { headers: { Origin: site } }), target.env);
    return { status: response.status, body: await response.json() };
  };
  session.readConfig = async () => (await (await session.deployed.worker.fetch(
    new Request(`${origin}/session-config?slug=${slug}`, { headers: { 'X-Session-Slug': slug } }), session.deployed.env)).json()).config;
  session.backup = async () => {
    const pages = [];
    let cursor = '';
    do {
      const page = await session.signed(session.deployed, 'export-session-backup', { cursor });
      expect([page.status, page.body.error]).toEqual([200, undefined]);
      pages.push(page.body);
      cursor = page.body.nextCursor;
    } while (cursor);
    return pages;
  };
  // A backup restored into a fresh session on a Worker. The fresh session can
  // be redeployed too (`fresh.deploy`), and has its own clients.
  session.restore = async (pages, create, Coordinator, fetch) => {
    const store = memoryKv();
    const fresh = { store };
    fresh.deploy = (createNext, CoordinatorNext, fetchNext) => {
      fresh.env = environment(CoordinatorNext, store);
      fresh.worker = runtime(createNext, fresh.env, fetchNext);
      return fresh;
    };
    fresh.deploy(create, Coordinator, fetch);
    const results = [];
    for (const page of pages) results.push(await session.signed(fresh, 'import-session-backup', { page, adoptSessionId: true, workerUrl: origin }));
    fresh.client = clientOf(() => fresh);
    fresh.keys = () => [...coordinatorStores.get(store).values()].flatMap(instance => [...instance.keys()]);
    fresh.readConfig = async () => (await (await fresh.worker.fetch(
      new Request(`${origin}/session-config?slug=${slug}`, { headers: { 'X-Session-Slug': slug } }), fresh.env)).json()).config;
    return { fresh, results };
  };
  session.end = () => now.mockRestore();
  Object.assign(config, { slug, sessionId, sessionIdHex: sessionId, adminAddress: owner.address, allowOrigins: [site],
    corsWorkerUrl: origin, workerAuthority: { version: 1, participantScopes: ['storage'] } });
  delete config.resultsAnalysis;
  session.config = config;
  return session;
};

describe('putting a session back on a released Worker bundle', () => {
  let tempDir;
  const bundles = {};
  const testResponse = globalThis.Response;

  beforeAll(async () => {
    // The Workers run on the platform's Response, which the shared Jest setup
    // replaces with a partial stand-in; Node's own fetch still makes it.
    globalThis.Response = (await fetch('data:,')).constructor;
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ce-way-back-worker-'));
    for (const ref of new Set([beforeNames, live, pinned].filter(Boolean))) bundles[ref] = await loadBundle(ref, tempDir);
  }, 120000);

  afterAll(async () => {
    globalThis.Response = testResponse;
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
  });

  (beforeNames ? it : it.skip)('reads, restores and saves settings on a bundle from before names, and keeps names for the return', async () => {
    const released = bundles[beforeNames];
    const session = await drill();
    try {
      const { config } = session;
      await session.kv.put(`session:${slug}:config`, JSON.stringify(config));

      // On this Worker: a question, an answer, a name, names saved off, and a backup.
      const current = session.current();
      const [admin, person] = [session.client(owner), session.client(member)];
      const questionId = `0x${'7'.repeat(64)}`;
      const question = await admin.upload({ resource: 'questions', data: JSON.stringify({ id: questionId, type: 'text', prompt: 'Keep going?', sessionId, sessionSlug: slug }) });
      const answer = await person.upload({ resource: 'responses', data: JSON.stringify({ questionID: questionId, answer: { value: 'Yes' } }) });
      expect(await person.request('/names/set', { method: 'POST', auth: true, body: { name: 'Sam' } })).toMatchObject({ name: 'Sam' });
      const memberKey = member.address.toLowerCase();
      expect((await person.request('/names', { auth: true })).names).toEqual({ [memberKey]: 'Sam' });
      expect(await session.signed(current, 'set-config', { config: { ...config, namesEnabled: false } })).toMatchObject({ status: 200 });
      expect((await session.readConfig()).namesEnabled).toBe(false);
      const pages = await session.backup();
      expect(JSON.stringify(pages)).toContain('Sam');

      // Back on the released bundle, same stores, same sign-ins.
      const signedInBefore = session.signIns;
      const previous = session.released(released);
      // (a) What this Worker stored still reads, for people signed in before the redeploy.
      expect((await person.read(answer.id)).answer.value).toBe('Yes');
      expect((await admin.listAll('responses')).items).toHaveLength(1);
      expect((await admin.listAll('questions')).items.map(row => row.storageRef?.id)).toEqual([question.id]);
      expect(session.signIns).toBe(signedInBefore);
      // (b) The backup restores into a fresh session.
      const { fresh, results } = await session.restore(pages, released.createWorkerRuntime, released.SessionWriteCoordinator);
      results.forEach((result, index) => expect(result).toMatchObject({ status: 200, body: { complete: pages[index].manifest.complete, counts: { conflicts: 0 } } }));
      const restored = fresh.client(member);
      expect((await restored.read(answer.id)).answer.value).toBe('Yes');
      expect((await restored.listAll('questions')).items.map(row => row.storageRef?.id)).toEqual([question.id]);
      // The released Worker has no names: a restore there leaves them out, and
      // only the same backup restored on this Worker brings them back.
      expect(fresh.keys().some(key => key.startsWith('session-config-authority'))).toBe(true);
      expect(fresh.keys().filter(key => key.startsWith('session-name-v1:'))).toEqual([]);
      // (c) Settings save. The released Worker serves the config without the
      // setting it does not know, and a save without it goes through.
      expect(await session.readConfig()).not.toHaveProperty('namesEnabled');
      expect(await session.signed(previous, 'set-config', { config: { ...config, sessionName: 'Renamed on the way back' } }))
        .toEqual({ status: 200, body: { ok: true } });
      expect((await session.readConfig()).sessionName).toBe('Renamed on the way back');
      // A save that still carries it, from a page loaded before the way back,
      // is refused whole: reload the admin page after redeploying, then save.
      expect(await session.signed(previous, 'set-config', { config: { ...config, namesEnabled: false, sessionName: 'Refused' } })).toEqual({
        status: 400, body: { error: 'Unsupported worker-canonical session config field: namesEnabled.' },
      });

      // This Worker again: the edit stands, names stay off, and the name was kept.
      const signedInBack = session.signIns;
      session.current();
      expect(await session.readConfig()).toMatchObject({ sessionName: 'Renamed on the way back', namesEnabled: false });
      expect((await person.request('/names', { auth: true })).names).toEqual({});
      expect(await session.signed(session.deployed, 'set-config', { config: { ...config, sessionName: 'Renamed on the way back', namesEnabled: true } })).toMatchObject({ status: 200 });
      expect((await person.request('/names', { auth: true })).names).toEqual({ [memberKey]: 'Sam' });
      expect((await admin.read(answer.id)).answer.value).toBe('Yes');
      expect(session.signIns).toBe(signedInBack);
    } finally {
      session.end();
    }
  }, 120000);

  // 0.9.18's context cards (with a PDF's reading) and saved analysis card, and
  // their two switches, saved one way and then the other.
  const sides = [['the live bundle', live], ['the pinned bundle', pinned]];
  const switchSets = [{ contextCardsEnabled: true, analysisCardEnabled: false }, { contextCardsEnabled: false, analysisCardEnabled: true }];
  // This Worker's AI: a card for a source, a reading for a PDF.
  const provider = async (url, init) => {
    const body = JSON.parse(typeof init.body === 'string' ? init.body : new TextDecoder().decode(init.body));
    const pdf = JSON.stringify(body.messages?.[0]?.content ?? '').includes('"type":"document"');
    const text = pdf ? 'Slide 1: Coalition goals.' : JSON.stringify({ summary: 'Minutes of the salon.', tags: ['minutes'], names: ['Ada'] });
    return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }), { headers: { 'content-type': 'application/json' } });
  };
  const aiConfig = config => ({ ...config, workerAuthority: { version: 1, participantScopes: ['storage', 'ai'] },
    ai: { mode: 'anthropic', models: { fast: { provider: 'anthropic', model: 'claude-sonnet-5-5' }, thinking: { provider: 'anthropic', model: 'claude-sonnet-5-5' } } } });
  const card = { title: 'A patient builder of shared rules', matchNote: 'Both trust people closest to a problem.',
    figure: 'Elinor Ostrom (1933–2012)', tastes: { book: { title: 'Governing the Commons', by: 'Elinor Ostrom' }, game: null, film: null, song: null },
    answers: { yesNo: { prompt: 'Should towns run their own water?', text: 'Agree' }, ownWords: null, vote: null } };
  // Drawing a picture needs OpenAI, so one is stored as the picture route stores it.
  const keepPicture = session => session.kv.put(`session:${slug}:analysis-card-picture:v1:figure:${analysisCardFigureKey(card.figure)}`,
    JSON.stringify({ figure: card.figure, name: 'Elinor Ostrom', portrait: 'A woman at a desk.', look: { era: '1990s', ground: 'paper', accentHex: '#aa3311' },
      image: { mime: 'image/jpeg', base64: 'aW1hZ2U=' } }));
  describe.each(sides)('context cards and the saved analysis card on %s', (_name, ref) => {
    (ref ? it.each(switchSets) : it.skip.each(switchSets))('with %o saved: read, restored, saved and back again', async (switches) => {
      const released = bundles[ref];
      const session = await drill({ provider });
      try {
        const config = aiConfig(session.config);
        await session.kv.put(`session:${slug}:config`, JSON.stringify(config));
        const [admin, person] = [session.client(owner), session.client(member)];
        const contextList = async (client = admin) => (await client.request('/storage/list?resource=docsContext&role=context', { auth: true })).items;
        const cardsOf = items => Object.fromEntries(items.map(item => [item.storageRef.id, item.metadata.card?.summary ?? null]));
        const readText = (client, id) => client.request(`/storage/read?id=${encodeURIComponent(id)}`, { auth: true, raw: true });
        const savedCard = client => client.request('/analysis-card/published', { method: 'POST', auth: true, body: { account: member.address } });
        const picture = client => client.request('/analysis-card/picture', { method: 'POST', auth: true, body: { figure: card.figure } });
        // The card's stored rows: the saved card, and its picture as the picture route keeps one.
        const cardRows = () => [...session.kv.values].filter(([key]) => key.includes(':analysis-card-'));
        const refusal = request => request.then(() => null, error => [error.status, error.code]);

        // On this Worker, both switches on: a text file and a PDF as context, the
        // PDF read by the AI, each with the AI's card, and a member's saved card.
        const current = session.current();
        expect(await session.signed(current, 'set-secrets', { secrets: { anthropicKey: 'synthetic-anthropic-key' } })).toMatchObject({ status: 200 });
        expect(await session.signed(current, 'set-config', { config: { ...config, contextCardsEnabled: true, analysisCardEnabled: true } })).toMatchObject({ status: 200 });
        const upload = (name, type, text) => {
          const form = new FormData();
          form.append('file', new Blob([new TextEncoder().encode(text)], { type }), name);
          form.append('resource', 'docsContext');
          form.append('contentType', type);
          form.append('tags', JSON.stringify([{ name: 'CE-DocLibrary', value: '1' }, { name: 'CE-DocKind', value: 'file' },
            { name: 'CE-DocStorage', value: 'cloudflare' }, { name: 'CE-DocRole', value: 'context' }, { name: 'CE-DocName', value: name }]));
          return admin.request('/storage/upload', { method: 'POST', auth: true, form });
        };
        const notes = (await upload('notes.md', 'text/markdown', '# Minutes\nWe agreed.')).id;
        const deck = (await upload('deck.pdf', 'application/pdf', '%PDF-1.7 synthetic deck')).id;
        const reading = (await admin.request('/storage/context', { method: 'POST', auth: true, body: { action: 'read-pdf', id: deck } })).text.id;
        const cards = { [notes]: 'Minutes of the salon.', [deck]: 'Minutes of the salon.', [reading]: null };
        expect(cardsOf(await contextList())).toEqual(cards);
        expect(await readText(admin, reading)).toBe('Slide 1: Coalition goals.');
        expect(await person.request('/analysis-card/publish', { method: 'POST', auth: true, body: { published: true, card } })).toMatchObject({ published: true, card });
        expect(await savedCard(admin)).toMatchObject({ published: true, card });
        await keepPicture(session);
        expect(await picture(person)).toMatchObject({ cached: true, image: { mime: 'image/jpeg', base64: 'aW1hZ2U=' } });
        const cardRowsBefore = cardRows();
        expect(cardRowsBefore).toHaveLength(2);
        // Then the switches as this case saves them, and a backup.
        expect(await session.signed(current, 'set-config', { config: { ...config, ...switches } })).toMatchObject({ status: 200 });
        expect(await session.readConfig()).toMatchObject(switches);
        const pages = await session.backup();
        // A backup carries the switches, with the config, but no saved card or picture.
        expect(JSON.stringify(pages)).toContain('analysisCardEnabled');
        expect(JSON.stringify(pages)).not.toContain(card.title);
        expect(JSON.stringify(pages)).not.toContain('analysis-card-');

        // Back on the released bundle, same stores, same sign-ins.
        const signedInBefore = session.signIns;
        const previous = session.released(released);
        // (a) Everything stored still reads. The released Worker knows neither
        // switch, cards or saved cards: it serves the config without the switches,
        // lists each source without its card, and has no saved-card route.
        const served = await session.readConfig();
        expect(served).not.toHaveProperty('contextCardsEnabled');
        expect(served).not.toHaveProperty('analysisCardEnabled');
        expect(cardsOf(await contextList())).toEqual({ [notes]: null, [deck]: null, [reading]: null });
        const stored = { [notes]: '# Minutes\nWe agreed.', [deck]: '%PDF-1.7 synthetic deck', [reading]: 'Slide 1: Coalition goals.' };
        const readsAll = async client => Object.fromEntries(await Promise.all(Object.keys(stored).map(async id => [id, await readText(client, id)])));
        expect(await readsAll(person)).toEqual(stored);
        // It has no card routes, and leaves the card's rows alone.
        for (const ask of [savedCard, picture, client => client.request('/analysis-card/publish', { method: 'POST', auth: true, body: { published: false } })]) {
          expect(await refusal(ask(person))).toEqual([404, expect.anything()]);
        }
        expect(session.signIns).toBe(signedInBefore);
        // (b) The backup restores into a fresh session: the files and the reading,
        // without the switches or the cards, and never a saved card.
        const { fresh, results } = await session.restore(pages, released.createWorkerRuntime, released.SessionWriteCoordinator);
        results.forEach((result, index) => expect(result).toMatchObject({ status: 200, body: { complete: pages[index].manifest.complete, counts: { conflicts: 0 } } }));
        const restorer = fresh.client(owner);
        expect(cardsOf(await contextList(restorer))).toEqual({ [notes]: null, [deck]: null, [reading]: null });
        expect(await readsAll(restorer)).toEqual(stored);
        const restoredConfig = await fresh.readConfig();
        expect(restoredConfig).not.toHaveProperty('contextCardsEnabled');
        expect(restoredConfig).not.toHaveProperty('analysisCardEnabled');
        expect([...fresh.store.values.keys()].filter(key => key.includes('analysis-card'))).toEqual([]);
        // The released Worker restores the switches and the cards too, only
        // unseen: put this Worker on the restored session and they are there.
        fresh.deploy(createWorkerRuntime, SessionWriteCoordinator, provider);
        expect(await fresh.readConfig()).toMatchObject(switches);
        expect(await session.signed(fresh, 'set-config', { config: { contextCardsEnabled: true, analysisCardEnabled: true } })).toMatchObject({ status: 200 });
        expect(cardsOf(await contextList(restorer))).toEqual(cards);
        // None was saved there: a restore never brings saved cards back.
        expect(await savedCard(restorer)).toEqual({ published: null });
        // (c) Settings save. The admin page sends only the fields it changed, so
        // a change to anything else saves, from a page loaded before or after the
        // way back. A save that carries either switch, on or off, is refused whole,
        // with whatever else it carried: reload the admin page after redeploying.
        expect(await session.signed(previous, 'set-config', { config: { sessionName: 'Renamed on the way back' } }))
          .toEqual({ status: 200, body: { ok: true } });
        for (const carried of [{ contextCardsEnabled: true }, { contextCardsEnabled: false }, { analysisCardEnabled: true }, { analysisCardEnabled: false }]) {
          expect(await session.signed(previous, 'set-config', { config: { ...carried, sessionName: 'Refused' } })).toEqual({
            status: 400, body: { error: `Unsupported worker-canonical session config field: ${Object.keys(carried)[0]}.` },
          });
        }
        expect(await session.readConfig()).toMatchObject({ sessionName: 'Renamed on the way back', ai: { models: config.ai.models } });
        expect(cardRows()).toEqual(cardRowsBefore);

        // (d) This Worker again: the edit stands, both switches are as saved, and
        // the cards, the reading and the saved card are there once their switch is on.
        const signedInBack = session.signIns;
        session.current();
        expect(await session.readConfig()).toMatchObject({ ...switches, sessionName: 'Renamed on the way back' });
        expect(await readsAll(admin)).toEqual(stored);
        const shown = { cards: () => contextList().then(cardsOf), saved: () => refusal(savedCard(admin)) };
        if (switches.contextCardsEnabled) expect(await shown.cards()).toEqual(cards);
        else expect(await shown.cards()).toEqual({ [notes]: null, [deck]: null, [reading]: null });
        if (switches.analysisCardEnabled) expect(await savedCard(admin)).toMatchObject({ published: true, card });
        else expect(await shown.saved()).toEqual([403, 'analysis_card_off']);
        expect(await session.signed(session.deployed, 'set-config', {
          config: { ...config, sessionName: 'Renamed on the way back', contextCardsEnabled: true, analysisCardEnabled: true } })).toMatchObject({ status: 200 });
        expect(await shown.cards()).toEqual(cards);
        expect(await savedCard(admin)).toMatchObject({ published: true, card });
        expect(await picture(person)).toMatchObject({ cached: true, image: { mime: 'image/jpeg', base64: 'aW1hZ2U=' } });
        expect(session.signIns).toBe(signedInBack);
      } finally {
        session.end();
      }
    }, 120000);

    // A session from before 0.9.18 never saved either switch, so the card and
    // Context cards are both off. This Worker stores nothing new for it, and the
    // released bundle meets no setting it does not know.
    (ref ? it : it.skip)('with neither switch saved: both off, nothing new stored, and the way back meets no new setting', async () => {
      const released = bundles[ref];
      const session = await drill({ provider });
      try {
        const config = aiConfig(session.config);
        expect(config).not.toHaveProperty('analysisCardEnabled');
        expect(config).not.toHaveProperty('contextCardsEnabled');
        await session.kv.put(`session:${slug}:config`, JSON.stringify(config));
        const [admin, person] = [session.client(owner), session.client(member)];
        const ownCard = client => client.request('/analysis-card/published', { method: 'POST', auth: true, body: { account: member.address } });
        const publish = client => client.request('/analysis-card/publish', { method: 'POST', auth: true, body: { published: true, card } });
        const picture = client => client.request('/analysis-card/picture', { method: 'POST', auth: true, body: { figure: card.figure } });
        const refusal = request => request.then(() => null, error => [error.status, error.code]);
        const storedConfig = store => JSON.parse(store.values.get(`session:${slug}:config`));
        const cardRows = store => [...store.values.keys()].filter(key => key.includes('analysis-card'));

        // On this Worker: a member's own card, its picture and a context file's
        // card are all refused, and the session's config is left as it was.
        const current = session.current();
        expect(await session.signed(current, 'set-secrets', { secrets: { anthropicKey: 'synthetic-anthropic-key' } })).toMatchObject({ status: 200 });
        const configBefore = storedConfig(session.kv);
        expect(configBefore).toEqual(config);
        const form = new FormData();
        form.append('file', new Blob([new TextEncoder().encode('# Minutes\nWe agreed.')], { type: 'text/markdown' }), 'notes.md');
        form.append('resource', 'docsContext');
        form.append('contentType', 'text/markdown');
        form.append('tags', JSON.stringify([{ name: 'CE-DocLibrary', value: '1' }, { name: 'CE-DocKind', value: 'file' },
          { name: 'CE-DocStorage', value: 'cloudflare' }, { name: 'CE-DocRole', value: 'context' }, { name: 'CE-DocName', value: 'notes.md' }]));
        const notes = (await admin.request('/storage/upload', { method: 'POST', auth: true, form })).id;
        const context = async (client = admin) => (await client.request('/storage/list?resource=docsContext&role=context', { auth: true }))
          .items.map(item => [item.storageRef.id, item.metadata.card ?? null]);
        const makeCard = () => refusal(admin.request('/storage/context', { method: 'POST', auth: true, body: { action: 'make-card', id: notes } }));
        const cardsOff = [409, 'context_cards_off'];
        const reads = client => client.request(`/storage/read?id=${encodeURIComponent(notes)}`, { auth: true, raw: true });
        const bothOff = async () => {
          expect(await refusal(publish(person))).toEqual([403, 'analysis_card_off']);
          expect(await refusal(ownCard(person))).toEqual([403, 'analysis_card_off']);
          expect(await refusal(picture(person))).toEqual([403, 'analysis_card_off']);
          expect(await makeCard()).toEqual(cardsOff);
          expect(await context()).toEqual([[notes, null]]);
        };
        await bothOff();
        expect(storedConfig(session.kv)).toEqual(configBefore);
        expect(cardRows(session.kv)).toEqual([]);
        const pages = await session.backup();
        expect(JSON.stringify(pages)).not.toContain('analysisCardEnabled');
        expect(JSON.stringify(pages)).not.toContain('contextCardsEnabled');

        // (a) The released bundle reads the file and has no card routes.
        const signedInBefore = session.signIns;
        const previous = session.released(released);
        expect(await reads(person)).toBe('# Minutes\nWe agreed.');
        for (const ask of [ownCard, picture, publish]) expect(await refusal(ask(person))).toEqual([404, expect.anything()]);
        expect(session.signIns).toBe(signedInBefore);
        // (b) The backup restores there whole, and this Worker on the restored
        // session finds both still off.
        expect(pages.at(-1).manifest.complete).toBe(true);
        const { fresh, results } = await session.restore(pages, released.createWorkerRuntime, released.SessionWriteCoordinator);
        results.forEach((result, index) => expect(result).toMatchObject({ status: 200, body: { complete: pages[index].manifest.complete, counts: { conflicts: 0 } } }));
        const restorer = fresh.client(owner);
        expect(await reads(restorer)).toBe('# Minutes\nWe agreed.');
        fresh.deploy(createWorkerRuntime, SessionWriteCoordinator, provider);
        expect(await fresh.readConfig()).not.toHaveProperty('analysisCardEnabled');
        expect(await fresh.readConfig()).not.toHaveProperty('contextCardsEnabled');
        expect(await refusal(ownCard(fresh.client(member)))).toEqual([403, 'analysis_card_off']);
        // (c) A settings save there, from a page loaded before or after the way
        // back, carries no switch, as none was changed: it saves.
        expect(await session.signed(previous, 'set-config', { config: { sessionName: 'Renamed on the way back' } }))
          .toEqual({ status: 200, body: { ok: true } });
        const renamed = storedConfig(session.kv);
        expect(renamed.sessionName).toBe('Renamed on the way back');
        expect(renamed).not.toHaveProperty('analysisCardEnabled');
        expect(renamed).not.toHaveProperty('contextCardsEnabled');

        // (d) This Worker again: both still off, until an admin turns the card
        // on; then a member saves and reads their own card.
        const signedInBack = session.signIns;
        session.current();
        const returned = await session.readConfig();
        expect(returned).toMatchObject({ sessionName: 'Renamed on the way back' });
        expect(returned).not.toHaveProperty('analysisCardEnabled');
        expect(returned).not.toHaveProperty('contextCardsEnabled');
        await bothOff();
        expect(await session.signed(session.deployed, 'set-config', { config: { analysisCardEnabled: true } })).toMatchObject({ status: 200 });
        expect(await publish(person)).toMatchObject({ published: true, card });
        expect(await ownCard(person)).toMatchObject({ published: true, card });
        expect(await session.readConfig()).not.toHaveProperty('contextCardsEnabled');
        expect(await makeCard()).toEqual(cardsOff);
        expect(session.signIns).toBe(signedInBack);
      } finally {
        session.end();
      }
    }, 120000);
  });

  // gpt-live-1.1, the default here, under a released Worker that knows only gpt-live-1.
  describe.each(sides)('the interview voice model on %s', (_name, ref) => {
    // One session, its OpenAI calls answered by the Live API stand-in.
    const voiceDrill = async (body) => {
      const released = bundles[ref];
      const session = await drill();
      const calls = [];
      const realFetch = globalThis.fetch;
      // Each Worker calls OpenAI with the platform's fetch: the Live API answers here.
      globalThis.fetch = async (url, init) => {
        if (!String(url).startsWith('https://api.openai.com/')) return realFetch(url, init);
        calls.push({ url: String(url), model: JSON.parse(init.body).session.model });
        return Response.json({ transport: { type: 'webrtc', sdp: 'v=0\r\no=answer' } });
      };
      try {
        // Interviews are open to anyone here, so the call needs no sign-in.
        const config = { ...session.config, workerAuthority: { ...session.config.workerAuthority, anonymousScopes: ['ai'] },
          interviewModeEnabled: true, interviewMode: { enabled: true, provider: 'openai' } };
        await session.kv.put(`session:${slug}:config`, JSON.stringify(config));
        const interview = async () => {
          const response = await session.deployed.worker.fetch(new Request(`${origin}/realtime/call?slug=${slug}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Slug': slug, Origin: site },
            body: JSON.stringify({ sdp: 'v=0\r\no=offer\r\n', instructions: 'Ask one question.' }),
          }), session.deployed.env);
          return { status: response.status, protocol: response.headers.get('x-interview-protocol'), model: calls.at(-1)?.model };
        };
        const withModel = (realtimeModel, extra = {}) => ({ config: { ...config, ...extra,
          interviewMode: { ...config.interviewMode, ...(realtimeModel ? { realtimeModel } : {}) } } });
        const current = session.current();
        expect(await session.signed(current, 'set-secrets', { secrets: { openaiKey: 'synthetic-openai-key' } })).toMatchObject({ status: 200 });
        await body({ session, released, current, interview, withModel, calls });
      } finally {
        globalThis.fetch = realFetch;
        session.end();
      }
    };

    (ref ? it : it.skip)('with no model saved: gpt-live-1.1 here, gpt-live-1 there, and saves go through both ways', () => voiceDrill(async ({ session, released, interview, withModel }) => {
      expect(await interview()).toEqual({ status: 200, protocol: 'live', model: 'gpt-live-1.1' });
      const previous = session.released(released);
      expect(await interview()).toEqual({ status: 200, protocol: 'live', model: 'gpt-live-1' });
      expect(await session.signed(previous, 'set-config', withModel(undefined, { sessionName: 'Renamed on the way back' })))
        .toEqual({ status: 200, body: { ok: true } });
      session.current();
      expect(await session.readConfig()).toMatchObject({ sessionName: 'Renamed on the way back' });
      expect(await interview()).toEqual({ status: 200, protocol: 'live', model: 'gpt-live-1.1' });
    }), 120000);

    (ref ? it : it.skip)('with gpt-live-1 saved: it stays on gpt-live-1 here and there', () => voiceDrill(async ({ session, released, current, interview, withModel }) => {
      expect(await session.signed(current, 'set-config', withModel('gpt-live-1'))).toMatchObject({ status: 200 });
      expect(await interview()).toEqual({ status: 200, protocol: 'live', model: 'gpt-live-1' });
      session.released(released);
      expect(await interview()).toEqual({ status: 200, protocol: 'live', model: 'gpt-live-1' });
    }), 120000);

    // The site never saves the default, but a script or an agent can.
    (ref ? it : it.skip)('with gpt-live-1.1 saved by hand: interviews run on gpt-live-1 there, and saves wait for gpt-live-1', () => voiceDrill(async ({ session, released, current, interview, withModel, calls }) => {
      expect(await session.signed(current, 'set-config', withModel('gpt-live-1.1'))).toMatchObject({ status: 200 });
      expect((await session.readConfig()).interviewMode.realtimeModel).toBe('gpt-live-1.1');
      expect(await interview()).toEqual({ status: 200, protocol: 'live', model: 'gpt-live-1.1' });

      // Back on the released bundle. (a) Interviews still run, on gpt-live-1,
      // the model it falls back to for one it doesn't know.
      const previous = session.released(released);
      expect(await interview()).toEqual({ status: 200, protocol: 'live', model: 'gpt-live-1' });
      expect(calls.map(call => call.url)).toEqual(Array(2).fill('https://api.openai.com/v1/live/sessions'));
      // (b) It refuses every settings save while gpt-live-1.1 is stored, even
      // one that doesn't touch interviews; nothing stored changes.
      expect(await session.signed(previous, 'set-config', withModel('gpt-live-1.1', { sessionName: 'Refused' }))).toEqual({
        status: 400, body: { error: 'Invalid interview mode config.' },
      });
      expect(await session.signed(previous, 'set-config', { config: { sessionName: 'Refused' } })).toEqual({
        status: 400, body: { error: 'Invalid interview mode config.' },
      });
      expect((await session.readConfig()).interviewMode.realtimeModel).toBe('gpt-live-1.1');
      // (c) The way out: save interview settings without it (as the site does)
      // or with gpt-live-1, and saves go through again.
      expect(await session.signed(previous, 'set-config', withModel(undefined, { sessionName: 'Renamed on the way back' })))
        .toEqual({ status: 200, body: { ok: true } });
      expect(await session.readConfig()).toMatchObject({ sessionName: 'Renamed on the way back' });
      expect((await session.readConfig()).interviewMode).not.toHaveProperty('realtimeModel');

      // This Worker again: the edit stands, on the default.
      session.current();
      expect(await session.readConfig()).toMatchObject({ sessionName: 'Renamed on the way back' });
      expect(await interview()).toEqual({ status: 200, protocol: 'live', model: 'gpt-live-1.1' });
    }), 120000);
  });
});

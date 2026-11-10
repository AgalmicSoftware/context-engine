// Breakout recorder durability smoke.
//
// Plays a 30-minute group recording (about ten three-minute chunks) in Chromium at phone width on Playwright's
// clock, through an offline stretch, a reload in the middle of a chunk, Close and keep the audio and reopening, a
// closed tab, a burst of 503s from transcription and an upload that never answers. A byte ledger keeps every byte
// the fake recorder hands over and every byte that reaches the Session Worker for transcription. At the end every
// chunk must be Transcribed, every byte must have reached the Worker apart from the tail a reload or closed tab can
// lose by design (bounded below), and the transcript must hold each chunk's text once, in order.
//
// Start a local Vite server from client/ first:
//   PUBLIC_URL=/ npx vite --host 127.0.0.1 --port 4192 --strictPort
// then run: BASE_URL=http://127.0.0.1:4192 node scripts/breakout-recording-durability-smoke.mjs
//
// https://worker.example is answered in this process by the checkout's Session Worker runtime, whose OpenAI calls
// are faked. Every other request that isn't to the local server gets an empty stub.
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { chromium } from 'playwright';
import { Wallet } from 'ethers';
import { createWorkerRuntime } from '../workers/sessionCorsWorker/worker.js';
import { putSessionSecrets } from '../workers/sessionCorsWorker/sessionConfigSecretsStore.js';
import { installSessionCoordinatorBinding } from '../tests/helpers/sessionCorsWorkerTestUtils.mjs';
import { createWorkerClient } from '../mcp/lib/workerClient.mjs';
import { DEFAULT_AI_MODELS, DEFAULT_TRANSCRIPTION_MODEL } from '../shared/aiDefaults.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4192';
assert(['localhost', '127.0.0.1'].includes(new URL(BASE).hostname), 'Use a local Vite server');
const WORKER = 'https://worker.example';
const SLUG = 'breakout-durability';
const CHUNK_MS = 180_000; // the recorder's chunk length
// 4 kHz 8-bit mono WAV: about the size of a phone's speech recording, and decodable, so voice samples get cut.
const BYTES_PER_SECOND = 4000;
const WAV_HEADER_BYTES = 44;
// A reload or closed tab loses what came after the chunk's last saved snapshot: the recorder saves a chunk's audio
// so far at most every ten seconds and when the chunk ends, and a page that is unloading can't finish a save.
// Each interruption below lands a millisecond before the next snapshot, the worst case.
const SNAPSHOT_MS = 10_000;
const LOSS_BOUND_SECONDS = SNAPSHOT_MS / 1000;
const TOPICS = ['library hours', 'bus routes', 'park lighting', 'street trees', 'school meals', 'night buses',
  'bike lanes', 'market stalls', 'river paths', 'youth clubs', 'public toilets', 'bin collection', 'polling places',
  'street names', 'play areas', 'tool library'];
// A chunk's speech names its number, so the transcript shows any chunk lost, repeated or out of order.
const chunkText = (serial) => `Part ${serial} of the breakout covered ${TOPICS[serial - 1]}.`;
const QUESTIONS = JSON.stringify({ surveyTitle: 'Breakout', questions: [{ prompt: 'The breakout should keep its audio safe through interruptions.', questionType: 'binary', options: [], voiceCredits: null, tags: ['recording'] }] });

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const settle = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const seconds = (bytes) => bytes / BYTES_PER_SECOND;

// ---- Ledger: what the fake recorder handed over, by recorder (one per chunk), and what reached the Worker. ----
const ledger = { recorders: [], byId: new Map(), uploads: [] };
const recordLedger = (_source, entry) => {
  if (entry.event === 'start') {
    const recorder = { id: entry.recorder, serial: ledger.recorders.length + 1, startedAt: entry.at, fragments: [] };
    ledger.recorders.push(recorder);
    ledger.byId.set(recorder.id, recorder);
    return;
  }
  const bytes = Buffer.from(entry.data, 'base64');
  ledger.byId.get(entry.recorder).fragments.push({ at: entry.at, bytes, sha256: sha(bytes) });
};
const produced = (recorder) => Buffer.concat(recorder.fragments.map((fragment) => fragment.bytes));
// The recorder whose audio an upload holds; it must be the first fragments of that recorder, whole and unchanged.
const identify = (bytes) => {
  for (const recorder of ledger.recorders) {
    const first = recorder.fragments[0]?.bytes;
    if (!first || bytes.length < first.length || !bytes.subarray(0, first.length).equals(first)) continue;
    let offset = 0;
    for (const { bytes: fragment } of recorder.fragments) {
      if (offset + fragment.length > bytes.length || !bytes.subarray(offset, offset + fragment.length).equals(fragment)) break;
      offset += fragment.length;
    }
    assert.equal(offset, bytes.length, `Upload of ${bytes.length} bytes is not whole fragments of chunk ${recorder.serial}`);
    return recorder;
  }
  return null;
};

// ---- An in-process Session Worker with fresh storage; OpenAI is faked. ----
async function createFakeWorker() {
  const participant = Wallet.createRandom();
  const values = new Map();
  const kv = {
    get: async (key) => values.get(key) ?? null,
    put: async (key, value) => values.set(key, value),
    delete: async (key) => values.delete(key),
    list: async ({ prefix = '' } = {}) => ({ keys: [...values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })), list_complete: true }),
  };
  const config = {
    slug: SLUG, sessionId: `0x${'d'.repeat(32)}`, sessionIdHex: `0x${'d'.repeat(32)}`, sessionName: 'Breakout durability',
    adminAddress: Wallet.createRandom().address, allowOrigins: [BASE], corsWorkerUrl: WORKER, authzEpoch: 1,
    scopes: { ai: true, transcribe: true, storage: true },
    ai: { mode: 'openai', models: { ...DEFAULT_AI_MODELS, transcription: { provider: 'openai', model: DEFAULT_TRANSCRIPTION_MODEL } } },
    workerAuthority: { version: 1, participantScopes: ['ai', 'transcribe', 'storage'], anonymousScopes: ['ai', 'transcribe'] },
    sessionModeProfile: { profileVersion: 1, preset: 'custom', authority: { mode: 'worker_canonical' }, evm: { registryChainId: null },
      storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
      identity: { default: 'passkey', enabled: ['passkey'] }, authorization: { mechanisms: ['worker_roles'] }, encryption: { mode: 'none' },
      surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
      results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 } }, export: { scope: 'all_session' } },
  };
  config.storageProfile = { ...config.sessionModeProfile.storage };
  // Sample secrets are made per run.
  const env = installSessionCoordinatorBinding({ GROUP_KV: kv, CE_STORAGE_INDEX_KV: kv, DEFAULT_SESSION_SLUG: SLUG,
    TOKEN_HMAC_SECRET: randomBytes(32).toString('hex'), CE_STORAGE_ENVELOPE_KEK: randomBytes(32).toString('hex'), LOGIN_TRUSTED_ORIGINS: BASE });
  await kv.put(`session:${SLUG}:config`, JSON.stringify(config));
  await putSessionSecrets(env, SLUG, { openaiKey: `test-${randomBytes(12).toString('hex')}` });

  // What the Worker does with each chunk's transcription requests: 503s, an upload held or one that never answers.
  const plan = { unavailable: new Map(), hang: 0, hold: null };
  const openAi = async (url, init) => {
    const { origin, pathname } = new URL(url);
    assert.equal(origin, 'https://api.openai.com', `Unexpected provider call ${url}`);
    if (pathname.endsWith('/audio/transcriptions')) {
      const form = init.body;
      const file = Buffer.from(await form.get('file').arrayBuffer());
      const recorder = identify(file);
      const failures = plan.unavailable.get(recorder.serial) || 0;
      if (failures) {
        plan.unavailable.set(recorder.serial, failures - 1);
        return Response.json({ error: { message: 'The server is overloaded.' } }, { status: 503 });
      }
      const text = chunkText(recorder.serial);
      if (form.get('response_format') !== 'diarized_json') return Response.json({ text });
      // One voice: under its known name once the recorder sends its sample, otherwise the model's own label.
      const speaker = form.getAll('known_speaker_names[]')[0] || 'A';
      return Response.json({ text, segments: [{ id: 'seg_0', type: 'transcript.text.segment', speaker, start: 0, end: seconds(file.length - WAV_HEADER_BYTES), text }] });
    }
    if (pathname.endsWith('/responses')) return Response.json({ model: 'fake-model', output_text: QUESTIONS });
    if (pathname.endsWith('/chat/completions')) return Response.json({ model: 'fake-model', choices: [{ message: { content: QUESTIONS } }] });
    return assert.fail(`Unexpected provider path ${pathname}`);
  };
  const worker = createWorkerRuntime(env, { rpcFetch: async () => assert.fail('No RPC calls are allowed'), fetch: openAi });
  let login;
  const workerFetch = async (url, init = {}) => {
    const response = await worker.fetch(new Request(url, init), env, { waitUntil: () => {} });
    if (new URL(url).pathname === '/auth/login') login = await response.clone().json();
    return response;
  };
  await createWorkerClient({ workerOrigin: WORKER, slug: SLUG, trustedOrigins: [BASE], wallet: participant, fetchImpl: workerFetch }).login();

  let release;
  const unanswered = new Promise((resolve) => { release = resolve; });
  const statuses = [];
  const handle = async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const body = request.postDataBuffer() || undefined;
    let upload;
    if (pathname === '/transcribe' && request.method() === 'POST') {
      const form = await new Request(request.url(), { method: 'POST', headers: { 'content-type': request.headers()['content-type'] }, body }).formData();
      const file = Buffer.from(await form.get('file').arrayBuffer());
      const recorder = identify(file);
      assert(recorder, `Upload of ${file.length} bytes matches no recorded chunk`);
      upload = { serial: recorder.serial, bytes: file.length, sha256: sha(file), outcome: 'sent' };
      ledger.uploads.push(upload);
      const attempt = ledger.uploads.filter((entry) => entry.serial === upload.serial).length;
      if (upload.serial === plan.hang && attempt === 1) {
        upload.outcome = 'never answered';
        await unanswered;
        return route.abort().catch(() => {});
      }
      if (upload.serial === plan.hold?.serial && attempt === 1) {
        upload.outcome = 'held';
        await plan.hold.released;
      }
    }
    const response = await workerFetch(request.url(), { method: request.method(), headers: request.headers(), body });
    statuses.push(`${response.status} ${request.method()} ${pathname}`);
    if (upload) upload.outcome = upload.outcome === 'held' ? `held, then ${response.status}` : String(response.status);
    return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) }).catch(() => {});
  };
  return { config, address: participant.address, token: login.token, exp: Number(login.exp), plan, handle, statuses, release };
}

// ---- Page stubs: a microphone, a screen lock, and a MediaRecorder that hands over a WAV in one-second fragments
// on the page's (fake) timers, reporting every byte to the ledger as it hands it over. ----
function installStubs({ bytesPerSecond }) {
  // The waveform draws every animation frame, which Playwright's clock would run one by one; one a second will do.
  window.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 1000);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
  // A recorder hands over requested data in a later task; MessageChannel tasks don't wait for the fake clock.
  const later = (task) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => { channel.port1.close(); task(); };
    channel.port2.postMessage(0);
  };
  let audio;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => {
    audio ??= new AudioContext();
    const stream = audio.createMediaStreamDestination().stream;
    Object.defineProperty(stream.getAudioTracks()[0], 'label', { configurable: true, value: 'Built-in microphone' });
    return stream;
  } } });
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => Object.assign(new EventTarget(), { released: false, release: async () => {} }) } });
  // The first fragment opens with a WAV header of unknown length, as a recorder's container header does.
  const header = () => {
    const bytes = new Uint8Array(44);
    const view = new DataView(bytes.buffer);
    const ascii = (offset, text) => [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    ascii(0, 'RIFF'); view.setUint32(4, 0xffffffff, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, bytesPerSecond, true); view.setUint32(28, bytesPerSecond, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
    ascii(36, 'data'); view.setUint32(40, 0xffffffff, true);
    return bytes;
  };
  const base64 = (bytes) => {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return btoa(binary);
  };
  window.MediaRecorder = class {
    static isTypeSupported(type) { return type === 'audio/wav'; }
    state = 'inactive';
    mimeType = 'audio/wav';
    constructor() {
      this.id = crypto.randomUUID();
    }
    // The audio captured since the last take, as random 8-bit samples, after the header the first time.
    take() {
      const now = Date.now();
      const bytes = new Uint8Array((this.opened ? 0 : 44) + Math.round(((now - this.capturedTo) * bytesPerSecond) / 1000));
      for (let offset = this.opened ? 0 : 44; offset < bytes.length; offset += 65_536)
        crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + 65_536, bytes.length)));
      if (!this.opened) bytes.set(header());
      this.opened = true;
      this.capturedTo = now;
      return bytes;
    }
    hand(bytes) {
      if (bytes.length) window.__durabilityLedger({ recorder: this.id, at: Date.now(), data: base64(bytes) });
      this.ondataavailable?.({ data: new Blob([bytes], { type: this.mimeType }) });
    }
    start(timeslice) {
      this.state = 'recording';
      this.capturedTo = Date.now();
      window.__durabilityLedger({ recorder: this.id, event: 'start', at: this.capturedTo });
      this.timer = setInterval(() => { if (this.state === 'recording') this.hand(this.take()); }, timeslice);
    }
    // Paused time records nothing; audio from before the pause is handed over later.
    pause() { this.pausedAt = Date.now(); this.state = 'paused'; }
    resume() { this.capturedTo += Date.now() - this.pausedAt; this.state = 'recording'; }
    requestData() {
      if (this.state !== 'recording') return;
      const bytes = this.take();
      later(() => this.hand(bytes));
    }
    stop() {
      if (this.state === 'inactive') return;
      if (this.state === 'paused') this.resume();
      clearInterval(this.timer);
      const bytes = this.take();
      this.state = 'inactive';
      later(() => { this.hand(bytes); this.onstop?.(); });
    }
  };
}

const probeHtml = (fake) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Breakout recording</title></head>
<body style="margin:0;padding:16px;background:var(--ce-canvas);color:var(--ce-text)"><main id="probe"></main><script type="module">
  import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;
  await import('/src/browserGlobals.ts');
  const { setStoredThemePreference } = await import('/src/utilities/ui/themeRuntime.ts');
  setStoredThemePreference('civic');
  await import('/src/assets/css/contextEngine.scss');
  const ReactModule = await import('/node_modules/.vite/deps/react.js'); const React = ReactModule.default || ReactModule;
  const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
  const config = ${JSON.stringify(fake.config)}, address = ${JSON.stringify(fake.address)};
  const { default: store } = await import('/src/store.ts');
  const { changeAccount } = await import('/src/actions/accountActions.ts');
  store.dispatch(changeAccount({ account: address, provider: 'passkey_eoa', loginComplete: true }));
  const { buildTokenCacheEnvelope, buildTokenCacheKey, writeTokenCache } = await import('/src/utilities/worker/workerAuthTokenCache.ts');
  const scope = { workerUrl: config.corsWorkerUrl, sessionId: config.sessionId, sessionSlug: config.slug, address };
  writeTokenCache(buildTokenCacheKey({ ...scope, slug: config.slug }), buildTokenCacheEnvelope({ ...scope, token: ${JSON.stringify(fake.token)}, exp: ${fake.exp} }));
  const { default: Modal } = await import('/src/components/SurveyTool/SessionVoiceModeModal.tsx');
  function Probe() {
    const [isOpen, setOpen] = React.useState(true);
    return React.createElement(React.Fragment, null,
      isOpen ? null : React.createElement('button', { type: 'button', onClick: () => setOpen(true) }, 'Open recorder'),
      React.createElement(Modal, { isOpen, mode: 'recordGroup', onClose: () => setOpen(false), onSelectMode: () => setOpen(true),
        sessionSlug: config.slug, sessionConfig: config, workerUrl: config.corsWorkerUrl, context: { account: address }, account: address,
        loginComplete: true, provider: 'passkey_eoa' }));
  }
  (ReactDOM.createRoot || ReactDOM.default.createRoot)(document.getElementById('probe')).render(React.createElement(Probe));
</script></body></html>`;

// Every record in the recorder's device store, read with IndexedDB directly. Audio is stored as its bytes.
const readStore = (page, { hashes = false } = {}) => page.evaluate(async (withHashes) => {
  if (!(await indexedDB.databases()).some((database) => database.name === 'ce-recording-chunks')) return [];
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('ce-recording-chunks');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    const records = await new Promise((resolve, reject) => {
      const request = database.transaction('chunks').objectStore('chunks').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const hex = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return Promise.all(records.map(async ({ segment, audioBytes, knownSpeakers }) => ({
      id: segment.id, index: segment.index, status: segment.status, text: segment.text, audioSize: audioBytes?.byteLength || 0,
      audioSha256: withHashes && audioBytes ? await hex(audioBytes) : undefined,
      voiceSamples: (knownSpeakers || []).filter((speaker) => speaker.sample).map((speaker) => speaker.name),
    })));
  } finally {
    database.close();
  }
}, hashes);
const chunksIn = (records) => records.filter((record) => record.index >= 0).sort((a, b) => a.index - b.index);
// The store once writes under way have landed: two reads in a row agree.
const settledStore = async (page) => {
  for (let previous = '', records = await readStore(page); ; records = await readStore(page)) {
    if (JSON.stringify(records) === previous) return records;
    previous = JSON.stringify(records);
    await settle(300);
  }
};

// Retention, as the owner decided: a chunk's audio leaves the device as soon as its transcript is saved, and once the
// recorder closes with every chunk transcribed no audio is left, voice samples included. This is the one place that
// states the policy.
function assertRetention(records, { recorderClosed = false } = {}) {
  for (const chunk of chunksIn(records).filter((record) => record.status === 'complete'))
    assert.equal(chunk.audioSize, 0, `Chunk ${chunk.index + 1} still holds ${chunk.audioSize} bytes of audio after its transcript was saved`);
  if (!recorderClosed) return;
  assert.deepEqual(records.filter((record) => record.audioSize).map((record) => record.id), [], 'No audio is left once the recorder closes with every chunk transcribed');
  assert.deepEqual(records.flatMap((record) => record.voiceSamples), [], 'No voice samples are left once the recorder closes with every chunk transcribed');
}

const started = performance.now();
const fake = await createFakeWorker();
const html = probeHtml(fake);
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => assert.fail(`No external calls are allowed: ${url}`);
const browser = await chromium.launch({ headless: true,
  args: [`--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE ${new URL(BASE).hostname}`, '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const consoleErrors = [];
const dialogs = [];
const interruptions = new Map();
let failed = true;
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await context.exposeBinding('__durabilityLedger', recordLedger);
  await context.clock.install({ time: Date.now() });
  await context.addInitScript(installStubs, { bytesPerSecond: BYTES_PER_SECOND });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === WORKER) return fake.handle(route);
    if (url.origin !== new URL(BASE).origin) return route.fulfill({ status: 204, body: '' });
    if (url.pathname === '/durability-probe') return route.fulfill({ contentType: 'text/html', body: html });
    return route.continue();
  });
  const clock = context.clock;
  // Fake time runs on in big steps; short real pauses let uploads and device storage keep up.
  const advance = async (ms, step = 15_000) => {
    for (let left = ms; left > 0; left -= step) {
      await clock.runFor(Math.min(step, left));
      await settle(30);
    }
  };
  const until = async (label, check, { step = 500, limit = 300_000 } = {}) => {
    for (let waited = 0; waited <= limit; waited += step) {
      const value = await check();
      if (value) return value;
      await clock.runFor(step);
      await settle(40);
    }
    throw new Error(`Timed out waiting for ${label}`);
  };
  const transcribed = (page, count) => until(`${count} chunks transcribed`, async () => {
    const chunks = chunksIn(await readStore(page));
    return chunks.length >= count && chunks.slice(0, count).every((chunk) => chunk.status === 'complete') && chunks;
  });
  const recorderReady = async (page) => {
    await page.getByRole('checkbox', { name: 'Label speakers' }).waitFor({ timeout: 60_000 });
    await page.waitForFunction(() => {
      const record = document.querySelector('[data-testid="ce-session-listening-start"]');
      return record && !record.disabled && [...document.querySelectorAll('.modal, .modal-dialog')].every((element) => getComputedStyle(element).opacity === '1');
    }, null, { timeout: 60_000 });
  };
  const openPage = async () => {
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200)); });
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.type());
      return dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss();
    });
    await page.goto(`${BASE}/durability-probe`);
    // The clock is paused across an interruption; it runs again once the page is back.
    await clock.resume();
    await recorderReady(page);
    return page;
  };
  // Presses Record and returns when (in fake time) capture began.
  const record = async (page) => {
    const before = ledger.recorders.length;
    await page.getByTestId('ce-session-listening-start').click();
    await page.getByRole('button', { name: 'Stop recording' }).waitFor();
    await until('a new recorder', () => ledger.recorders.length > before);
    return ledger.recorders.at(-1).startedAt;
  };
  const advanceTo = async (page, at) => advance(at - (await page.evaluate(() => Date.now())));
  // Pauses fake time, then runs it to a millisecond before the recording chunk's next snapshot, and returns
  // what an interruption there would leave saved.
  const toWorstMoment = async (page, kind) => {
    const recorder = ledger.recorders.at(-1);
    const pausedAt = (await page.evaluate(() => Date.now())) + 250;
    await clock.pauseAt(pausedAt);
    // With the clock paused no new snapshot starts; wait for one under way to land.
    const snapshot = async () => chunksIn(await readStore(page)).find((chunk) => chunk.status === 'recording');
    let current = await snapshot();
    for (let previous; previous?.audioSize !== current?.audioSize; current = await snapshot()) {
      previous = current;
      await settle(300);
    }
    assert(current?.audioSize, `${kind}: the chunk being recorded has a saved snapshot`);
    let saved = 0;
    let lastSave = 0;
    for (const fragment of recorder.fragments) {
      if (saved === current.audioSize) break;
      saved += fragment.bytes.length;
      lastSave = fragment.at;
    }
    assert.equal(saved, current.audioSize, `${kind}: the saved snapshot is whole fragments`);
    const at = lastSave + SNAPSHOT_MS - 1;
    assert(at >= pausedAt, `${kind}: the next snapshot is still ahead`);
    await clock.runFor(at - pausedAt);
    await settle(300);
    const stillSaved = chunksIn(await readStore(page)).find((chunk) => chunk.id === current.id);
    assert.equal(stillSaved.audioSize, current.audioSize, `${kind}: no snapshot landed before the interruption`);
    interruptions.set(recorder.serial, { kind, at, savedBytes: current.audioSize });
  };
  const uploadsOf = (serial) => ledger.uploads.filter((upload) => upload.serial === serial).map((upload) => upload.outcome);
  // Chunks not yet transcribed wait on the device, byte for byte as recorded.
  const assertWaiting = async (page, serials) => {
    const chunks = chunksIn(await readStore(page, { hashes: true }));
    for (const serial of serials) {
      assert.equal(chunks[serial - 1].status, 'queued', `Chunk ${serial} waits to upload`);
      assert.equal(chunks[serial - 1].audioSha256, sha(produced(ledger.recorders[serial - 1])), `Chunk ${serial} waits on the device as recorded`);
    }
  };

  // 1. Record. Chunk 1 is transcribed and its voice sampled, so later chunks send the voice sample.
  let page = await openPage();
  let since = await record(page);
  await advanceTo(page, since + CHUNK_MS + 1000);
  let chunks = await transcribed(page, 1);
  await until('a voice sample', async () => (await readStore(page)).some((entry) => entry.voiceSamples.length));
  assertRetention(await readStore(page));

  // 2. Six minutes offline while recording goes on: chunks 2 and 3 wait on the device, then upload in order.
  await advanceTo(page, since + 3.5 * 60_000);
  await context.setOffline(true);
  await advanceTo(page, since + 9.5 * 60_000);
  await page.getByRole('alert').filter({ hasText: 'Offline. Audio stays on this device' }).waitFor();
  await assertWaiting(page, [2, 3]);
  assert.deepEqual([uploadsOf(2), uploadsOf(3)], [[], []], 'Nothing uploads while offline');
  await context.setOffline(false);
  await transcribed(page, 3);
  assertRetention(await readStore(page));

  // 3. A burst of 503s from transcription: chunk 4 retries until the Worker answers.
  fake.plan.unavailable.set(4, 4);
  await advanceTo(page, since + 4 * CHUNK_MS + 1000);
  await transcribed(page, 4);
  assert.deepEqual(uploadsOf(4), ['503', '503', '503', '503', '200']);

  // 4. Reload in the middle of chunk 5, a millisecond before its next snapshot. Its saved part uploads without the
  // microphone; Record starts chunk 6.
  await advanceTo(page, since + 4 * CHUNK_MS + 75_000);
  await toWorstMoment(page, 'reload');
  let recorders = ledger.recorders.length;
  await page.reload();
  await clock.resume();
  await recorderReady(page);
  await transcribed(page, 5);
  assert.equal(ledger.recorders.length, recorders, 'Recovery does not start the microphone');
  assertRetention(await readStore(page));
  since = await record(page);

  // 5. Chunk 6's first upload never answers: recording goes on, the upload is abandoned after two minutes and
  // sent again, and chunk 7 follows it.
  fake.plan.hang = 6;
  await advanceTo(page, since + 2 * CHUNK_MS + 1000);
  await transcribed(page, 7);
  assert.deepEqual(uploadsOf(6), ['never answered', '200']);

  // 6. Stop a minute into chunk 8 while its upload is held, Close and keep the audio, then reopen the recording.
  await advanceTo(page, since + 2 * CHUNK_MS + 60_000);
  let releaseHold;
  fake.plan.hold = { serial: 8, released: new Promise((resolve) => { releaseHold = resolve; }) };
  await page.getByRole('button', { name: 'Stop recording' }).click();
  await page.getByRole('button', { name: 'Close and keep the audio' }).click();
  await page.getByRole('complementary', { name: 'Kept recording audio' }).filter({ hasText: 'Saved audio is waiting to upload.' }).waitFor();
  await assertWaiting(page, [8]);
  await page.getByRole('button', { name: 'Reopen recording' }).click();
  await recorderReady(page);
  await transcribed(page, 8);
  releaseHold();
  assertRetention(await readStore(page));
  since = await record(page);

  // 7. Close the tab in the middle of chunk 11, a millisecond before its next snapshot, then open the session in a
  // new tab: the saved part uploads, and Record carries on.
  await advanceTo(page, since + 2 * CHUNK_MS + 45_000);
  await toWorstMoment(page, 'tab close');
  recorders = ledger.recorders.length;
  const closed = new Promise((resolve) => { page.once('close', resolve); });
  await page.close({ runBeforeUnload: true });
  await closed;
  page = await openPage();
  await transcribed(page, 11);
  assert.equal(ledger.recorders.length, recorders, 'Recovery in the new tab does not start the microphone');
  assertRetention(await readStore(page));
  since = await record(page);

  // 8. One more full chunk, then Stop half a minute into the last.
  await advanceTo(page, since + CHUNK_MS + 30_000);
  await page.getByRole('button', { name: 'Stop recording' }).click();
  chunks = await transcribed(page, ledger.recorders.length);

  // ---- Every chunk Transcribed, every byte at the Worker, the transcript whole and in order. ----
  const made = ledger.recorders.filter((recorder) => recorder.fragments.length);
  assert.equal(chunks.length, made.length, 'One chunk for each recorder that handed over audio');
  assert(made.length >= 10, `About ten chunks: ${made.length}`);
  const rows = [];
  for (const recorder of made) {
    const chunk = chunks[recorder.serial - 1];
    assert.equal(chunk.status, 'complete', `Chunk ${recorder.serial} ends Transcribed`);
    assert.equal(chunk.text, chunkText(recorder.serial), `Chunk ${recorder.serial} holds its own transcript`);
    const audio = produced(recorder);
    const uploads = ledger.uploads.filter((upload) => upload.serial === recorder.serial);
    const accepted = uploads.filter((upload) => upload.outcome.endsWith('200'));
    assert(accepted.length, `Chunk ${recorder.serial} was transcribed by the Worker`);
    const sent = Math.max(...uploads.map((upload) => upload.bytes));
    const interruption = interruptions.get(recorder.serial);
    let lost = 0;
    if (interruption) {
      // What the page saved before the interruption is what reached the Worker; the rest is the unsaved tail, plus
      // the part second the recorder had not yet handed over.
      assert.equal(sent, interruption.savedBytes, `Chunk ${recorder.serial}: the saved part reached the Worker`);
      lost = seconds(audio.length - sent) + (interruption.at - recorder.fragments.at(-1).at) / 1000;
      assert(sent > WAV_HEADER_BYTES, `Chunk ${recorder.serial}: the ${interruption.kind} kept part of the chunk`);
      assert(lost < LOSS_BOUND_SECONDS, `Chunk ${recorder.serial}: the ${interruption.kind} lost ${lost} s, more than ${LOSS_BOUND_SECONDS} s`);
    } else {
      assert.equal(sent, audio.length, `Chunk ${recorder.serial}: every byte reached the Worker`);
      assert(accepted.every((upload) => upload.sha256 === sha(audio)), `Chunk ${recorder.serial}: the Worker received exactly what was recorded`);
    }
    rows.push({ chunk: recorder.serial, recorded: `${seconds(audio.length - WAV_HEADER_BYTES).toFixed(1)} s`, sent: `${seconds(sent - WAV_HEADER_BYTES).toFixed(1)} s`,
      lost: interruption ? `${lost.toFixed(3)} s (${interruption.kind})` : '0', uploads: uploads.map((upload) => upload.outcome).join(', '), sha256: sha(audio).slice(0, 12) });
  }
  console.table(rows);
  const transcript = await page.getByTestId('ce-session-listening-transcript').textContent();
  let cursor = -1;
  for (const recorder of made) {
    const text = chunkText(recorder.serial);
    assert.equal(transcript.split(text).length - 1, 1, `The transcript holds chunk ${recorder.serial} once:\n${transcript}`);
    assert(transcript.indexOf(text) > cursor, `The transcript holds chunk ${recorder.serial} in order:\n${transcript}`);
    cursor = transcript.indexOf(text);
  }
  assertRetention(await readStore(page));
  assert.equal(await page.getByText('Transcribing…').count(), 0, 'Nothing is left uploading');
  assert.deepEqual(await page.getByRole('alert').allInnerTexts(), [], 'No notice is left');
  assert.equal(dialogs.filter((type) => type === 'beforeunload').length, 2, 'The reload and the tab close asked first');

  // ---- Close with every chunk transcribed, reopen, then Clear: nothing is left on the device. ----
  await page.locator('.modal.show .modal-header .btn-close').first().click();
  await page.getByRole('button', { name: 'Open recorder' }).waitFor();
  assertRetention(await settledStore(page), { recorderClosed: true });
  await page.getByRole('button', { name: 'Open recorder' }).click();
  await recorderReady(page);
  assert.equal(await page.getByTestId('ce-session-listening-transcript').textContent(), transcript, 'Reopening restores the transcript');
  // Clear asks first, even with only a transcript left.
  await page.getByTestId('ce-session-listening-clear').click();
  await page.getByTestId('ce-recording-clear-confirm').click();
  await until('Clear', async () => !(await readStore(page)).length);
  assert.deepEqual(errors, [], 'No page errors');
  // The planned 503s log as failed loads; the app itself logs no errors.
  assert.deepEqual(consoleErrors.filter((text) => !text.startsWith('Failed to load resource')), [], 'No console errors');
  assert.equal(fake.statuses.filter((status) => !/^(200|204|503) /.test(status)).length, 0, `Unexpected Worker answers: ${fake.statuses.filter((status) => !/^(200|204|503) /.test(status)).join('; ')}`);
  failed = false;
  console.log(`PASS breakout recording durability: ${made.length} chunks, ${(made.reduce((total, recorder) => total + produced(recorder).length, 0) / 1e6).toFixed(1)} MB recorded, worst loss ${Math.max(...rows.map((row) => Number.parseFloat(row.lost) || 0)).toFixed(3)} s, ${((performance.now() - started) / 1000).toFixed(1)} s`);
} finally {
  fake.release();
  if (failed) console.log({ uploads: ledger.uploads, consoleErrors: consoleErrors.slice(-20), errors, dialogs });
  await browser.close();
  globalThis.fetch = originalFetch;
}

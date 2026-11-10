import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_TEMPLATE_FORMAT,
  SESSION_TEMPLATE_MAX_BYTES,
  diffSessionTemplates,
  parseSessionTemplateJson,
  sessionTemplateFromDraft,
  validateSessionTemplate,
} from '../../shared/sessionTemplate.mjs';
import { DEFAULT_INTERVIEW_SETTINGS } from '../../shared/interviewSettings.mjs';
import { DEFAULT_RESULTS_ANALYSIS_SETTINGS } from '../../shared/resultsAnalysisSettings.mjs';
import { findForbiddenWorkerConfigSecretPath } from '../../workers/shared/workerSessionConfig.mjs';

const format = SESSION_TEMPLATE_FORMAT;
const valid = (input) => {
  const result = validateSessionTemplate(input);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  return result.template;
};
const errorsOf = (input) => {
  const result = validateSessionTemplate(input);
  assert.equal(result.ok, false);
  return result.errors;
};
const workerProfile = () => ({
  profileVersion: 1,
  preset: 'custom',
  authority: { mode: 'worker_canonical' },
  evm: { registryChainId: null },
  storage: {
    backend: 'cloudflare',
    payloadAccessControl: {
      gate: 'role_gate',
      encryption: 'worker_envelope',
      accessConditions: { match: 'any', conditions: [{ kind: 'worker_role', role: 'admin' }] },
    },
  },
  identity: { default: 'passkey', enabled: ['passkey'] },
  authorization: { mechanisms: ['worker_roles'] },
  encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
  surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
  results: {
    visibility: 'participant_aggregate',
    exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 },
  },
  export: { scope: 'admin_raw' },
});
// Every field filled in, so every text leaf can be exercised.
const fullTemplate = () => ({
  ...valid({ format }),
  draftId: 'draft-1',
  sessionName: 'Salon',
  sessionInfo: 'About the salon',
  sessionHeader: 'https://example.com/header.png',
  sessionEndsAt: '2026-12-01T18:00:00.000Z',
  sessionContext: {
    title: 'Read first',
    paragraphs: ['A note'],
    links: [{ label: 'Essay', url: 'https://example.com/essay' }],
  },
  contextFiles: [{ name: 'deck.pdf' }],
  questionsGenPrompt: 'Ask about parks',
  questions: [
    { prompt: 'Parks need more shade.', type: 'binary', tags: ['parks'] },
    { prompt: 'How safe do parks feel?', type: 'rating', scale: { min: 0, max: 10, minLabel: 'Not', maxLabel: 'Very' } },
    { prompt: 'Which park first?', type: 'multichoice', options: ['North', 'South'], singleSelect: true },
    { prompt: 'Split the budget.', type: 'quadratic', options: ['Trees', 'Benches'], voiceCredits: 16 },
    { prompt: 'Anything else?', type: 'freeform' },
  ],
  defaultTags: 'parks',
  sessionModeProfile: {
    ...workerProfile(),
    encryption: {
      mode: 'worker_envelope',
      keyProvider: 'worker_secret',
      accessConditions: {
        match: 'any',
        conditions: [
          { kind: 'agent_grant_scope', scope: 'storage' },
          { kind: 'sbt_onchain', chainId: 11155420, contract: '0x0000000000000000000000000000000000000001', anyOrAll: 'any' },
        ],
      },
    },
  },
});

test('a template with only its format takes every default', () => {
  const template = valid({ format });
  assert.deepEqual(Object.keys(template), [
    'format', 'draftId', 'sessionName', 'sessionInfo', 'sessionHeader', 'sessionEndsAt', 'appearance',
    'sessionContext', 'contextFiles', 'questionsGenPrompt', 'questions', 'defaultTags', 'defaultGroupTags', 'groupCreationPolicy',
    'interviewModeEnabled', 'interviewMode', 'resultsAnalysis', 'ai', 'sessionModeProfile',
  ]);
  assert.equal(template.format, format);
  assert.equal(template.sessionName, '');
  assert.deepEqual(template.sessionContext, { title: '', paragraphs: [], links: [], html: '' });
  assert.equal(template.groupCreationPolicy, 'participants');
  assert.equal(template.interviewModeEnabled, true);
  assert.deepEqual(template.interviewMode, { ...DEFAULT_INTERVIEW_SETTINGS, realtimeModel: 'gpt-live-1' });
  assert.deepEqual(template.resultsAnalysis, DEFAULT_RESULTS_ANALYSIS_SETTINGS);
  // New sessions default to the current models: Terra and Sol, and gpt-transcribe.
  assert.deepEqual(template.ai.models, {
    fast: { provider: 'openai', model: 'gpt-6.1-terra' },
    thinking: { provider: 'openai', model: 'gpt-6.1-sol' },
    transcription: { provider: 'openai', model: 'gpt-transcribe' },
  });
  assert.equal(template.sessionModeProfile, null);
});

test('missing nested fields take defaults; a mode profile is taken whole', () => {
  const template = valid({
    format,
    ai: { models: { fast: { model: 'claude-sonnet-5-5' } } },
    interviewMode: { openingPrompt: 'Welcome' },
    resultsAnalysis: { generationMode: 'automatic' },
    sessionContext: { links: [{ label: 'Essay', url: 'https://example.com/essay' }] },
    sessionModeProfile: { preset: 'custom' },
  });
  assert.deepEqual(template.ai.models.fast, { provider: 'openai', model: 'claude-sonnet-5-5' });
  assert.equal(template.ai.models.thinking.model, 'gpt-6.1-sol');
  assert.equal(template.interviewMode.openingPrompt, 'Welcome');
  assert.equal(template.interviewMode.questionGrowthPercent, 20);
  assert.equal(template.resultsAnalysis.generationMode, 'automatic');
  assert.deepEqual(template.resultsAnalysis.views, DEFAULT_RESULTS_ANALYSIS_SETTINGS.views);
  assert.deepEqual(template.sessionContext, {
    title: '',
    paragraphs: [],
    links: [{ label: 'Essay', url: 'https://example.com/essay' }],
    html: '',
  });
  assert.deepEqual(template.sessionModeProfile, { preset: 'custom' });
});

test('unknown fields are rejected by name at any depth', () => {
  const errors = errorsOf({
    format,
    color: 'red',
    interviewMode: { tone: 'warm' },
    ai: { models: { fast: { provider: 'openai', apiKey: 'x' } } },
    sessionContext: { links: [{ label: 'Essay', url: 'https://example.com/essay', private: true }] },
    sessionModeProfile: { ...workerProfile(), storage: { backend: 'cloudflare', mirrors: ['x'] } },
  });
  for (const path of ['color', 'interviewMode.tone', 'ai.models.fast.apiKey', 'sessionContext.links.0.private',
    'sessionModeProfile.storage.mirrors']) {
    const error = errors.find((entry) => entry.path === path);
    assert.ok(error, path);
    assert.match(error.message, new RegExp(path.replace(/\./g, '\\.')));
  }
});

test('types are checked, and the format is required', () => {
  const errors = errorsOf({
    sessionName: 42,
    interviewModeEnabled: 'yes',
    sessionContext: { paragraphs: 'one' },
    contextFiles: [{ name: null }],
    sessionModeProfile: { ...workerProfile(), evm: { registryChainId: '11155420' } },
  });
  assert.deepEqual(errors.map((error) => error.path), [
    'format',
    'sessionName',
    'sessionContext.paragraphs',
    'contextFiles.0.name',
    'interviewModeEnabled',
    'sessionModeProfile.evm.registryChainId',
  ]);
  assert.deepEqual(errorsOf({ format: 'ce.session-template/v2' }).map((error) => error.path), ['format']);
  assert.deepEqual(errorsOf(['not', 'a', 'template']), [{ path: '', message: 'A session template must be a JSON object.' }]);
});

test('every string stays the text it was given', () => {
  const text = '<script>alert("x")</script> {{constructor}} <img src=x onerror=alert(1)> \u0000 ‮';
  const template = valid({ format, sessionName: text, sessionInfo: `  ${text}  ` });
  assert.equal(template.sessionName, text);
  assert.equal(template.sessionInfo, `  ${text}  `);
});

test('settings with fixed vocabularies or limits are checked', () => {
  const errors = errorsOf({
    format,
    draftId: 'has spaces',
    groupCreationPolicy: 'everyone',
    sessionContext: { links: [{ label: 'Bad', url: 'javascript:alert(1)' }, { label: 'Plain', url: 'http://example.com' }] },
    interviewMode: { hiddenDraftShare: 0.9, openingMode: 'owner', realtimeModel: 'gpt-invented' },
    resultsAnalysis: { generationMode: 'sometimes' },
  });
  assert.deepEqual(errors.map((error) => error.path), [
    'draftId',
    'sessionContext.links.0.url',
    'sessionContext.links.1.url',
    'groupCreationPolicy',
    'interviewMode.hiddenDraftShare',
    'interviewMode.realtimeModel',
    'interviewMode.openingPrompt',
    'resultsAnalysis.generationMode',
  ]);
});

test('a template carries uploaded HTML in place of notes and links, and refuses both together', () => {
  const html = '<h2>Atlas</h2><details><summary>Trust</summary><p>Who decides?</p></details>';
  const exported = sessionTemplateFromDraft({ sessionContext: { title: 'Read first', paragraphs: [], links: [], html } });
  assert.equal(exported.ok, true, JSON.stringify(exported.errors));
  assert.deepEqual(exported.template.sessionContext, { title: 'Read first', paragraphs: [], links: [], html });
  assert.deepEqual(parseSessionTemplateJson(JSON.stringify(exported.template)).template, exported.template);
  assert.deepEqual(
    errorsOf({ format, sessionContext: { paragraphs: ['Typed'], html } }).map((error) => error.path),
    ['sessionContext.html'],
  );
});

test('a template carries links, notes and file names with their privacy, never file contents', () => {
  const draft = {
    sessionContext: {
      title: 'Read first',
      paragraphs: ['Notes for the salon.'],
      links: [{ label: 'Essay', url: 'https://example.com/essay' }],
    },
    contextFiles: [{ name: 'deck.pdf', adminsOnly: true, size: 12, bytes: 'JVBERi0x' }, { name: 'notes.md' }],
  };
  const exported = sessionTemplateFromDraft(draft);
  assert.equal(exported.ok, true, JSON.stringify(exported.errors));
  assert.deepEqual(exported.template.sessionContext, { ...draft.sessionContext, html: '' });
  assert.deepEqual(exported.template.contextFiles, [{ name: 'deck.pdf', adminsOnly: true }, { name: 'notes.md' }]);
  const reimported = parseSessionTemplateJson(JSON.stringify(exported.template));
  assert.deepEqual(reimported.template, exported.template);
  assert.deepEqual(errorsOf({ format, contextFiles: [{ name: 'deck.pdf', adminsOnly: 'yes' }] }).map((error) => error.path), [
    'contextFiles.0.adminsOnly',
  ]);
  assert.deepEqual(errorsOf({ format, contextFiles: [{ name: 'deck.pdf', data: 'JVBERi0x' }] }).map((error) => error.path), [
    'contextFiles.0.data',
  ]);
});

test('a template holds no more context than set-config accepts', () => {
  const errors = errorsOf({
    format,
    sessionContext: {
      title: 'x'.repeat(81),
      paragraphs: Array(7).fill('Background.'),
      links: [{ label: 'No link', url: '' }],
    },
  });
  assert.deepEqual(errors.map((error) => error.path), [
    'sessionContext.links.0.url',
    'sessionContext.title',
    'sessionContext.paragraphs',
  ]);
});

// Built at runtime where needed, so the public release scan and email scrub
// leave these samples intact.
const SECRET_SAMPLES = [
  `sk-proj-${'A1b2'.repeat(8)}`,
  `sk-ant-api03-${'x9Y8'.repeat(8)}`,
  `AIza${'Sy0123456789abcdefghijklmnopqrstu'}`,
  `ghp_${'a1B2'.repeat(9)}`,
  `0x${'ab'.repeat(32)}`,
  'cd'.repeat(32),
  `Kp3${'aZ9_'.repeat(9)}x`,
  `-----BEGIN ${'PRIVATE'} KEY-----`,
  '{"kty":"RSA","n":"abc","e":"AQAB"}',
  `Bearer ${'t0k3n'.repeat(5)}`,
  `https://user:pass${'@'}example.com/doc`,
  'https://example.com/doc?token=abc123',
];

test('secret-shaped text is refused wherever it appears', () => {
  for (const secret of SECRET_SAMPLES) {
    const errors = errorsOf({ format, sessionInfo: `Context: ${secret} (pasted)` });
    assert.deepEqual(errors.map((error) => error.path), ['sessionInfo'], secret);
    assert.match(errors[0].message, /sessionInfo/);
  }
  for (const text of ['gpt-5.6-terra', 'https://arweave.net/' + 'Ab9_'.repeat(10) + 'xyz',
    'https://github.com/org/repo/commit/' + 'ab12'.repeat(10), '0x0000000000000000000000000000000000000001',
    'risk-free task-force sk-8', 'See https://example.com/doc?page=2']) {
    assert.equal(validateSessionTemplate({ format, sessionInfo: text }).ok, true, text);
  }
});

const textPaths = (value, path = '') => {
  if (typeof value === 'string') return [path];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, entry]) => textPaths(entry, path ? `${path}.${key}` : key));
};
const setPath = (target, path, value) => {
  const keys = path.split('.');
  const parent = keys.slice(0, -1).reduce((node, key) => node[key], target);
  parent[keys[keys.length - 1]] = value;
};

test('export keeps portable fields only, so no deployment value or secret can leave', () => {
  const markers = {
    sessionId: '0x1234', sessionIdHex: '0x1234', slug: 'marker-slug', corsWorkerUrl: 'https://marker.workers.dev',
    adminAddress: '0xmarkeradmin', adminAddresses: ['0xmarkeradmin2'], recoveryKey: 'marker-recovery',
    workerSecrets: { TOKEN_HMAC_SECRET: 'marker-hmac' }, secrets: { openai: 'marker-openai' },
    rpc: { providers: { path: { rpcUrl: 'https://marker-rpc', apiKey: 'marker-rpc-key' } } },
    faucet: { privateKey: 'marker-faucet' }, arweave: { jwk: 'marker-jwk' }, litCredentials: { litApiKey: 'marker-lit' },
    deployForm: { apiToken: 'marker-cloudflare' }, sponsored: { bundleKey: 'marker-bundle' },
    perMemberSpendLimits: { ai: 'marker-limit' }, workerRequirementProof: { proof: 'marker-proof' },
  };
  const draft = {
    ...fullTemplate(),
    ...markers,
    format: undefined,
    ai: {
      reasoningEffort: 'low',
      apiKey: 'marker-ai-key',
      models: {
        fast: { provider: 'openai', model: 'gpt-5.6-terra', apiKey: 'marker-fast-key' },
        thinking: { provider: 'openai', model: 'gpt-5.6-terra' },
        transcription: { provider: 'openai', model: 'whisper-1', rpcUrl: 'https://marker-transcription' },
      },
    },
    interviewMode: { ...DEFAULT_INTERVIEW_SETTINGS, enabled: true, provider: 'openai', realtimeModel: 'gpt-live-1', token: 'marker-token' },
    sessionContext: { title: 'Read first', paragraphs: [], links: [], uploadToken: 'marker-upload' },
  };
  const result = sessionTemplateFromDraft(draft);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.doesNotMatch(JSON.stringify(result.template), /marker/);
  const keys = new Set(textPaths(result.template).concat(Object.keys(result.template))
    .flatMap((path) => path.split('.')));
  for (const forbidden of ['sessionId', 'sessionIdHex', 'slug', 'corsWorkerUrl', 'adminAddress', 'adminAddresses',
    'recoveryKey', 'apiKey', 'rpcUrl', 'privateKey', 'jwk', 'apiToken', 'token', 'secrets', 'workerSecrets',
    'litCredentials', 'rpc', 'faucet', 'arweave', 'deployForm', 'sponsored']) {
    assert.equal(keys.has(forbidden), false, forbidden);
  }
  // The Worker's own secret-field check finds nothing in a full template.
  assert.equal(findForbiddenWorkerConfigSecretPath(result.template), '');
});

test('no text field can export a secret-shaped value', () => {
  const template = fullTemplate();
  const paths = textPaths(template).filter((path) => path !== 'format');
  assert.ok(paths.length > 40, `${paths.length} text fields`);
  for (const path of paths) {
    const draft = structuredClone(template);
    setPath(draft, path, `${SECRET_SAMPLES[paths.indexOf(path) % SECRET_SAMPLES.length]}`);
    const result = sessionTemplateFromDraft(draft);
    assert.equal(result.ok, false, path);
    assert.ok(result.errors.some((error) => error.path === path), path);
  }
});

test('exporting an exported template changes nothing', () => {
  const template = valid(fullTemplate());
  assert.deepEqual(sessionTemplateFromDraft(template), { ok: true, template });
  assert.deepEqual(sessionTemplateFromDraft({}), validateSessionTemplate({ format }));
  assert.deepEqual(parseSessionTemplateJson(JSON.stringify(template)), { ok: true, template });
});

test('the diff lists each changed field', () => {
  const before = valid(fullTemplate());
  const after = structuredClone(before);
  after.sessionName = 'Salon, part 2';
  after.interviewMode.openingPrompt = 'Welcome back';
  after.sessionContext.links.push({ label: 'Deck', url: 'https://example.com/deck' });
  after.sessionModeProfile.results.visibility = 'session_member_aggregate';
  delete after.sessionModeProfile.encryption.accessConditions;
  assert.deepEqual(diffSessionTemplates(before, after), [
    { path: 'sessionName', before: 'Salon', after: 'Salon, part 2' },
    { path: 'sessionContext.links', before: before.sessionContext.links, after: after.sessionContext.links },
    { path: 'interviewMode.openingPrompt', before: '', after: 'Welcome back' },
    {
      path: 'sessionModeProfile.encryption.accessConditions',
      before: before.sessionModeProfile.encryption.accessConditions,
      after: undefined,
    },
    { path: 'sessionModeProfile.results.visibility', before: 'participant_aggregate', after: 'session_member_aggregate' },
  ]);
  assert.deepEqual(diffSessionTemplates(before, structuredClone(before)), []);
  assert.deepEqual(diffSessionTemplates(valid({ format }), before).find((change) => change.path === 'sessionModeProfile'),
    { path: 'sessionModeProfile', before: null, after: before.sessionModeProfile });
});

test('pasted or uploaded JSON is parsed safely', () => {
  const failure = (text) => {
    const result = parseSessionTemplateJson(text);
    assert.equal(result.ok, false, String(text).slice(0, 40));
    return result.errors;
  };
  assert.match(failure('{"format":')[0].message, /JSON/);
  assert.match(failure(42)[0].message, /JSON text/);
  assert.match(failure(`{"format":"${format}","sessionInfo":"${'a'.repeat(SESSION_TEMPLATE_MAX_BYTES)}"}`)[0].message, /larger/);
  for (const [text, path] of [
    [`{"format":"${format}","__proto__":{"polluted":true}}`, '__proto__'],
    [`{"format":"${format}","interviewMode":{"constructor":{"prototype":{}}}}`, 'interviewMode.constructor'],
    [`{"format":"${format}","sessionContext":{"links":[{"prototype":1}]}}`, 'sessionContext.links.0.prototype'],
  ]) {
    assert.deepEqual(failure(text).map((error) => error.path), [path]);
  }
  assert.equal({}.polluted, undefined);
  assert.match(failure(`${'['.repeat(200)}${']'.repeat(200)}`)[0].message, /nested/);
  assert.equal(parseSessionTemplateJson(JSON.stringify({ format, sessionName: '<b>Salon</b>' })).template.sessionName, '<b>Salon</b>');
});

test('secret scanning stays fast on hostile text near the size cap', () => {
  for (const unit of ['a.', 'a', '-', '0', 'aA1', '-----BEGIN ', 'http://', '#&', 'Bearer ', 'sk-', 'x:', 'a://']) {
    const text = unit.repeat(Math.floor(240000 / unit.length));
    const started = performance.now();
    validateSessionTemplate({ format, sessionInfo: text });
    assert.ok(performance.now() - started < 1000, `${unit} took ${Math.round(performance.now() - started)} ms`);
  }
});

test('ordinary links with hashes or k= stay valid; a fragment key does not', () => {
  for (const url of [`https://etherscan.io/tx/0x${'ab'.repeat(32)}`, 'https://www.amazon.com/s?k=civic+tech']) {
    assert.equal(validateSessionTemplate({ format, sessionContext: { links: [{ label: 'Link', url }] } }).ok, true, url);
  }
  assert.deepEqual(
    errorsOf({ format, sessionInfo: 'Setup: https://contextengine.sh/new?sponsored=abc#k=secretbundlekey' }).map((error) => error.path),
    ['sessionInfo'],
  );
});

test('a template over the size cap cannot be exported, as it could not be imported', () => {
  const result = sessionTemplateFromDraft({ sessionInfo: 'word '.repeat(SESSION_TEMPLATE_MAX_BYTES / 5) });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((error) => error.path), ['']);
  assert.match(result.errors[0].message, /larger than 256 KB/);
});

test('questions keep their portable fields and are checked by type', () => {
  const template = valid(fullTemplate());
  assert.equal(template.questions.length, 5);
  assert.deepEqual(template.questions[1].scale, { min: 0, max: 10, minLabel: 'Not', maxLabel: 'Very' });
  assert.deepEqual(valid({ format }).questions, []);
  const invalid = (question) => errorsOf({ format, questions: [question] }).map((error) => error.path);
  assert.deepEqual(invalid({ prompt: 'A', type: 'binary', answer: { value: '' } }), ['questions.0.answer']);
  assert.deepEqual(invalid({ prompt: ' ', type: 'binary' }), ['questions.0.prompt']);
  assert.deepEqual(invalid({ prompt: 'A', type: 'poll' }), ['questions.0.type']);
  assert.deepEqual(invalid({ prompt: 'A', type: 'multichoice', options: ['Only'] }), ['questions.0.options']);
  assert.deepEqual(invalid({ prompt: 'A', type: 'multichoice', options: ['Same', 'same'] }), ['questions.0.options']);
  assert.deepEqual(invalid({ prompt: 'A', type: 'binary', options: ['X', 'Y'] }), ['questions.0.options']);
  assert.deepEqual(invalid({ prompt: 'A', type: 'binary', singleSelect: true }), ['questions.0.singleSelect']);
  assert.deepEqual(invalid({ prompt: 'A', type: 'binary', scale: { min: 0, max: 5 } }), ['questions.0.scale']);
  assert.deepEqual(invalid({ prompt: 'A', type: 'rating', scale: { min: 5, max: 5 } }), ['questions.0.scale']);
  assert.deepEqual(
    invalid({ prompt: 'A', type: 'quadratic', options: ['X', 'Y'], voiceCredits: 0 }),
    ['questions.0.voiceCredits'],
  );
  assert.deepEqual(invalid({ prompt: 'A', type: 'binary', tags: [''] }), ['questions.0.tags.0']);
  assert.deepEqual(
    errorsOf({ format, questions: Array.from({ length: 201 }, () => ({ prompt: 'A', type: 'binary' })) }).map(
      (error) => error.path,
    ),
    ['questions'],
  );
});

test('question text is scanned for secrets like every other field', () => {
  const errors = errorsOf({ format, questions: [{ prompt: `Use sk-${'a'.repeat(24)}`, type: 'freeform' }] });
  assert.deepEqual(errors.map((error) => error.path), ['questions.0.prompt']);
});

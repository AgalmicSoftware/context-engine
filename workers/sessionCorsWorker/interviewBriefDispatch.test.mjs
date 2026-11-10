import test from 'node:test';
import assert from 'node:assert/strict';
import { persistAuthTokenRecord } from './authTokenClaims.js';
import {
  INTERVIEW_PROMPT_VERSION,
  __test__interviewBriefDispatch,
  buildInterviewBriefDocument,
  dispatchInterviewBriefRequest as boundary,
  dispatchInterviewCatalogTicketRequest,
} from './interviewBriefDispatch.js';
import { issueInterviewCatalogTicket, verifyInterviewCatalogTicket } from './interviewCatalogTicket.js';

const dispatchInterviewBriefRequest = (args) => boundary({
  ...args, deps: { ...args.deps, readCurrentSessionConfig: args.deps?.readCurrentSessionConfig || (async ({ env, slug }) => ({
    config: await args.deps?.getSessionConfig?.(env, slug), revision: 1,
  })) },
});

const { canonicalizeQuestions } = __test__interviewBriefDispatch;

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: new Headers([['content-type', 'application/json'], ...new Headers(headers)]) });

test('buildInterviewBriefDocument returns only an inert question catalog', () => {
  const document = buildInterviewBriefDocument({
    slug: 'demo',
    sessionUrl: 'https://app.example/session/demo',
    servedWorkerOrigin: 'https://worker.example',
    questionSetHash: 'hash',
    questions: [{ id: 'q1', type: 'freeform', prompt: 'What matters?', options: [] }],
  });
  assert.deepEqual(document, {
    type: 'context-engine.interview-question-catalog',
    version: 1,
    sessionSlug: 'demo',
    reviewUrl: 'https://app.example/session/demo?worker=https%3A%2F%2Fworker.example&mode=interview',
    questionSetHash: 'hash',
    prefillPromptVersion: INTERVIEW_PROMPT_VERSION,
    answerContract: {
      binary: ['Agree', 'Unsure', 'Disagree'],
      rating: { min: 0, max: 10, step: 1 },
      ratingScaleOverrides: 'Use a question.scale object when present: answer min plus a whole number of steps (1 when no step is given), at most max. Otherwise use the default rating contract.',
      multichoice: 'When singleSelect is true, use one exact question option. Otherwise use an array of one or more exact question options.',
      quadratic: 'Signed integer array in option order; sum(vote²) <= voiceCredits (99 default). Zero is neutral; unused credits are allowed.',
    },
    researchCoverageContract: {
      countFields: [
        'historyChatsSearched',
        'historyChatsUsed',
        'memoryItemsSearched',
        'memoryItemsUsed',
        'connectedSourcesSearched',
        'connectedSourcesUsed',
        'userStatementsUsed',
      ],
      unknownSearchedCount: null,
      verification: 'self_reported',
    },
    questions: [{ id: 'q1', type: 'freeform', prompt: 'What matters?', options: [] }],
  });
  assert.equal('instructions' in document, false);
});


test('catalog review URLs include only the trusted serving Worker discovery origin', () => {
  const { buildReviewUrl, safeServedWorkerOrigin } = __test__interviewBriefDispatch;
  assert.equal(safeServedWorkerOrigin('https://worker.example/agent/interview-catalog?slug=demo'), 'https://worker.example');
  assert.equal(safeServedWorkerOrigin('http://localhost:8787/agent/interview-catalog?slug=demo'), 'http://localhost:8787');
  assert.equal(safeServedWorkerOrigin('http://remote.example/agent/interview-catalog?slug=demo'), '');
  assert.equal(safeServedWorkerOrigin('ftp://worker.example/agent/interview-catalog?slug=demo'), '');
  assert.equal(
    buildReviewUrl({
      sessionUrl: 'https://app.example/session/demo',
      servedWorkerOrigin: 'https://worker.example/agent/interview-catalog?slug=demo',
    }),
    'https://app.example/session/demo?worker=https%3A%2F%2Fworker.example&mode=interview',
  );
  assert.equal(
    buildReviewUrl({
      sessionUrl: 'https://app.example/session/demo',
      servedWorkerOrigin: 'http://remote.example/agent/interview-catalog?slug=demo',
    }),
    'https://app.example/session/demo?mode=interview',
  );
});

test('safeSessionUrl preserves only bounded recruitment and group auto-join state', () => {
  const safe = __test__interviewBriefDispatch.safeSessionUrl;
  const options = { slug: 'demo', allowOrigins: ['https://app.example'] };
  assert.equal(
    safe('https://app.example/session/demo?src=partner launch&joinGroup=EDDY-2026&worker=https%3A%2F%2Fattacker.example&mode=groupRecording#prefill=private', options),
    'https://app.example/session/demo?src=partner-launch&joinGroup=eddy-2026',
  );
  assert.equal(
    safe('https://app.example/session/demo?src=one&src=two&joinGroup=EDDY-2026', options),
    'https://app.example/session/demo?joinGroup=eddy-2026',
  );
  assert.equal(
    safe('https://app.example/session/demo?src=partner&joinGroup=bad/path', options),
    'https://app.example/session/demo?src=partner',
  );
});

test('canonicalizes question order before calculating a revision hash', () => {
  assert.deepEqual(
    canonicalizeQuestions([
      { id: 'q2', type: 'freeform', prompt: 'Second', options: [] },
      { id: 'q1', type: 'freeform', prompt: 'First', options: [] },
    ]).map(({ id }) => id),
    ['q1', 'q2'],
  );
});

test('dispatchInterviewBriefRequest returns public questions and a stable revision as inert JSON', async () => {
  const response = await dispatchInterviewBriefRequest({
    request: new Request('https://worker.example/agent/interview-brief?slug=demo&sessionUrl=https%3A%2F%2Fapp.example%2Fsession%2Fdemo'),
    env: {},
    slugHint: '',
    baseHeaders: {},
    deps: {
      resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'demo' }),
      getSessionConfig: async () => ({
        allowOrigins: ['https://app.example'],
        interviewMode: { enabled: true },
      }),
      getCorsContext: async () => ({ ok: true, headers: { 'access-control-allow-origin': '*' } }),
      loadPublicInterviewQuestions: async () => ({ questions: [
        {
          id: 'rating-q1',
          type: 'rating',
          prompt: 'Rate support',
          options: [],
          scale: { min: 1, max: 10, minLabel: 'Strongly oppose', maxLabel: 'Strongly support' },
        },
      ], incomplete: false }),
      sha256: async () => 'question-hash',
      json,
    },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const body = await response.json();
  assert.equal(body.type, 'context-engine.interview-question-catalog');
  assert.equal(body.prefillPromptVersion, INTERVIEW_PROMPT_VERSION);
  assert.equal(body.questionSetHash, 'question-hash');
  assert.equal(body.reviewUrl, 'https://app.example/session/demo?worker=https%3A%2F%2Fworker.example&mode=interview');
  assert.deepEqual(body.answerContract.binary, ['Agree', 'Unsure', 'Disagree']);
  assert.deepEqual(body.answerContract.rating, { min: 0, max: 10, step: 1 });
  assert.equal(
    body.answerContract.ratingScaleOverrides,
    'Use a question.scale object when present: answer min plus a whole number of steps (1 when no step is given), at most max. Otherwise use the default rating contract.',
  );
  assert.deepEqual(body.questions, [
    {
      id: 'rating-q1',
      type: 'rating',
      prompt: 'Rate support',
      options: [],
      scale: { min: 1, max: 10, minLabel: 'Strongly oppose', maxLabel: 'Strongly support' },
    },
  ]);
  assert.equal(body.researchCoverageContract.verification, 'self_reported');
  assert.equal(body.researchCoverageContract.unknownSearchedCount, null);
  assert.equal('instructions' in body, false);
});

test('dispatchInterviewBriefRequest honors per-session disablement and requires a safe return URL', async () => {
  const baseDeps = {
    resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'demo' }),
    getCorsContext: async () => ({ ok: true, headers: {} }),
    loadPublicInterviewQuestions: async () => ({ questions: [{ id: 'q1', type: 'freeform', prompt: 'Question?', options: [] }], incomplete: false }),
    json,
  };
  const disabled = await dispatchInterviewBriefRequest({
    request: new Request('https://worker.example/agent/interview-brief?slug=demo&sessionUrl=https://app.example/session/demo'),
    deps: { ...baseDeps, getSessionConfig: async () => ({ interviewModeEnabled: false }) },
  });
  assert.equal(disabled.status, 404);

  const unsafe = await dispatchInterviewBriefRequest({
    request: new Request('https://worker.example/agent/interview-brief?slug=demo&sessionUrl=http://remote.example/session/demo'),
    deps: { ...baseDeps, getSessionConfig: async () => ({ allowOrigins: ['https://app.example'] }) },
  });
  assert.equal(unsafe.status, 400);

  const wrongSession = await dispatchInterviewBriefRequest({
    request: new Request('https://worker.example/agent/interview-brief?slug=demo&sessionUrl=https://app.example/session/another'),
    deps: { ...baseDeps, getSessionConfig: async () => ({ allowOrigins: ['https://app.example'] }) },
  });
  assert.equal(wrongSession.status, 400);

  const wrongOrigin = await dispatchInterviewBriefRequest({
    request: new Request('https://worker.example/agent/interview-brief?slug=demo&sessionUrl=https://phishing.example/session/demo'),
    deps: { ...baseDeps, getSessionConfig: async () => ({ allowOrigins: ['https://app.example'] }) },
  });
  assert.equal(wrongOrigin.status, 400);

  const unapproved = await dispatchInterviewBriefRequest({
    request: new Request('https://worker.example/agent/interview-brief?slug=demo&sessionUrl=https://app.example/session/demo'),
    deps: { ...baseDeps, getSessionConfig: async () => ({}) },
  });
  assert.equal(unapproved.status, 400);
  assert.deepEqual(await unapproved.json(), {
    error: 'A session-approved HTTPS (or localhost) sessionUrl is required.',
  });
});

test('dispatchInterviewBriefRequest preserves only safe source and auto-join state from the supplied return URL', async () => {
  const response = await dispatchInterviewBriefRequest({
    request: new Request('https://worker.example/agent/interview-brief?slug=demo&format=json&sessionUrl=https%3A%2F%2Fapp.example%2Fsession%2Fdemo%3Fsrc%3Dpartner%2520launch%26joinGroup%3DEDDY-2026%26worker%3Dhttps%253A%252F%252Fattacker.example%26mode%3DgroupRecording%23private'),
    deps: {
      resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'demo' }),
      getSessionConfig: async () => ({ allowOrigins: ['https://app.example'] }),
      getCorsContext: async () => ({ ok: true, headers: {} }),
      loadPublicInterviewQuestions: async () => ({ questions: [{ id: 'q1', type: 'freeform', prompt: 'Question?', options: [] }], incomplete: false }),
      sha256: async () => 'question-hash',
      json,
    },
  });
  const body = await response.json();
  assert.equal(
    body.reviewUrl,
    'https://app.example/session/demo?src=partner-launch&joinGroup=eddy-2026&worker=https%3A%2F%2Fworker.example&mode=interview',
  );
  assert.equal(body.reviewUrl.includes('attacker.example'), false);
  assert.equal(body.reviewUrl.includes('groupRecording'), false);
  assert.equal(body.reviewUrl.includes('private'), false);
  assert.equal('instructions' in body, false);
});

test('the catalog lists groups to join only when the session joins matching groups', async () => {
  const listed = [];
  const run = (interviewMode, groups) => dispatchInterviewBriefRequest({
    request: new Request('https://worker.example/agent/interview-brief?slug=demo&sessionUrl=https%3A%2F%2Fapp.example%2Fsession%2Fdemo%3FjoinGroup%3DSalon'),
    env: { marker: 'env' },
    deps: {
      resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'demo' }),
      getSessionConfig: async () => ({ allowOrigins: ['https://app.example'], interviewMode }),
      getCorsContext: async () => ({ ok: true, headers: {} }),
      loadPublicInterviewQuestions: async () => ({ questions: [{ id: 'q1', type: 'freeform', prompt: 'Question?', options: [] }], incomplete: false }),
      listSelfJoinableWorkerGroupsForVisitor: async (args) => {
        listed.push(args);
        return groups;
      },
      sha256: async () => 'question-hash',
      json,
    },
  }).then((response) => response.json());
  const groups = [
    {
      groupId: 'salon',
      sessionSlug: 'demo',
      label: 'Salon',
      description: 'People at the salon',
      tags: ['in person'],
      joinMode: 'open',
      memberVisibility: 'session',
      adminAddress: '0x0000000000000000000000000000000000000abc',
    },
    { groupId: 'dacc', label: 'd/acc', tags: [], joinMode: 'open', memberVisibility: 'session' },
  ];

  const on = await run({ joinMatchingGroups: true }, groups);
  // Only what an AI needs to match someone; never who runs a group.
  assert.deepEqual(on.groups, [
    { groupId: 'salon', label: 'Salon', description: 'People at the salon', tags: ['in person'] },
    { groupId: 'dacc', label: 'd/acc' },
  ]);
  // The catalog carries no instructions; the clipboard prompt says how to suggest groups.
  assert.equal('groupContract' in on, false);
  // What an AI may base a suggestion on, in words: the session's choice, or the default.
  assert.deepEqual(on.groupSuggestionData, [
    'the country they live in',
    'their work, studies and roles',
    'their interests, causes and communities',
  ]);
  // What no AI may go on, whatever the session allows.
  assert.match(on.groupSuggestionNever, /^their health, disability, religion, .* or party or union membership$/);
  // A kind no longer offered, such as sensitive details, is never passed on.
  const chosen = await run({ joinMatchingGroups: true, groupSuggestionData: ['sensitive', 'town'] }, groups);
  assert.deepEqual(chosen.groupSuggestionData, [
    'where in their country they live (region, town, city or neighbourhood)',
  ]);
  assert.equal(on.questionSetHash, 'question-hash');
  assert.equal(listed.length, 2);
  assert.equal(listed[0].slug, 'demo');
  assert.equal(listed[0].inviteGroupId, 'salon');
  assert.equal(listed[0].env.marker, 'env');

  for (const body of [
    await run({ joinMatchingGroups: true }, []),
    await run({ suggestGroups: true }, groups),
    await run(undefined, groups),
    // Nothing about people to go on, so no groups to suggest.
    await run({ joinMatchingGroups: true, groupSuggestionData: [] }, groups),
  ]) {
    assert.equal('groups' in body, false);
    assert.equal('groupSuggestionData' in body, false);
  }
  assert.equal(listed.length, 3);
});

test('dispatchInterviewBriefRequest applies anonymous IP daily budgets before loading questions', async () => {
  const cases = [
    {
      name: 'explicit anonymous limit overrides wallet limit',
      limits: { perWalletPerDay: 10, perAnonymousIpPerDay: 4 },
      expectedLimit: 4,
    },
    {
      name: 'absent anonymous limit leaves anonymous routes unlimited',
      limits: { perWalletPerDay: 10 },
      expectedLimit: 0,
    },
  ];

  for (const entry of cases) {
    let questionsLoaded = false;
    let capturedRateLimit = null;
    const env = { RATE_LIMITS: entry.name };
    const response = await dispatchInterviewBriefRequest({
      request: new Request('https://worker.example/agent/interview-brief?slug=demo&sessionUrl=https://app.example/session/demo'),
      env,
      deps: {
        resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'demo' }),
        getSessionConfig: async () => ({ limits: entry.limits }),
        getCorsContext: async () => ({ ok: true, headers: {} }),
        resolveAnonymousRateIdentity: () => 'anon:example',
        checkRateLimit: async (value) => {
          capturedRateLimit = value;
          return false;
        },
        loadPublicInterviewQuestions: async () => {
          questionsLoaded = true;
          return ({ questions: [], incomplete: false });
        },
        json,
      },
    });

    assert.equal(response.status, 429, entry.name);
    assert.equal(questionsLoaded, false, entry.name);
    assert.deepEqual(capturedRateLimit, {
      env,
      slug: 'demo',
      address: 'anon:example',
      limit: entry.expectedLimit,
      route: 'interview-brief',
    }, entry.name);
  }
});

test('catalog accepts approved loopback HTTP URLs but rejects other protocols', () => {
  const safe = __test__interviewBriefDispatch.safeSessionUrl;
  const options = { slug: 'demo', allowOrigins: ['http://127.0.0.1:3000', 'http://[::1]:3000', 'ftp://127.0.0.1'] };
  assert.equal(safe('http://127.0.0.1:3000/session/demo', options), 'http://127.0.0.1:3000/session/demo');
  assert.equal(safe('http://[::1]:3000/session/demo', options), 'http://[::1]:3000/session/demo');
  assert.equal(safe('ftp://127.0.0.1/session/demo', options), '');
  assert.equal(safe('http://unapproved.example/session/demo', options), '');
});

for (const failure of ['pointer', 'payload']) test(`unreadable only-question ${failure} asks interview clients to retry`, async () => {
  const qid = `0x${'11'.repeat(32)}`;
  const eventData = `0x${(32n).toString(16).padStart(64, '0')}${(1n).toString(16).padStart(64, '0')}${qid.slice(2)}`;
  const response = await dispatchInterviewBriefRequest({
    request: new Request('https://worker.example/agent/interview-brief?slug=fixture'), env: {}, baseHeaders: {},
    deps: {
      resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'fixture' }),
      getSessionConfig: async () => ({ interviewMode: { enabled: true },
        contracts: { surveys: '0x1111111111111111111111111111111111111111' },
        rpcUrl: 'https://rpc.example', blockLimits: { start: 1, end: 1 } }),
      getCorsContext: async () => ({ ok: true, headers: {} }), json,
      fetch: async (url, init) => {
        if (String(url) !== 'https://rpc.example') return new Response('Unavailable', { status: 503 });
        const body = JSON.parse(init.body);
        if (body.method === 'eth_call' && failure === 'pointer') throw new Error('Unavailable');
        const result = body.method === 'eth_blockNumber' ? '0x1' : body.method === 'eth_getLogs'
          ? [{ data: eventData }] : `0x${'01'.repeat(32)}`;
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }));
      },
    },
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '5');
  assert.match((await response.json()).error, /Retry/);
});

const NOW_MS = 1_800_000_000_000;
const NOW = NOW_MS / 1000;
const PERSON = `0x${'ab'.repeat(20)}`;
const SIGN_IN = 'b6a3c1f2-0d4e-4a8b-9c7d-1e2f3a4b5c6d';
const catalogUrl = (extra = '') => `https://worker.example/agent/interview-catalog?slug=demo&sessionUrl=${
  encodeURIComponent('https://app.example/session/demo?joinGroup=Salon')}${extra}`;
const memoryKv = () => {
  const values = new Map();
  return { get: async (key) => values.get(key) ?? null, put: async (key, value) => { values.set(key, value); } };
};
// Built at runtime so no secret-shaped string sits in the source.
const signedInEnv = async () => {
  const env = { TOKEN_HMAC_SECRET: ['brief', 'ticket', 'test'].join('-'), GROUP_KV: memoryKv() };
  await persistAuthTokenRecord({ env, slug: 'demo', sub: PERSON, jti: SIGN_IN, ttlSeconds: 3600 });
  return env;
};
const catalogDeps = (config, overrides = {}) => ({
  resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'demo' }),
  getSessionConfig: async () => config,
  getCorsContext: async () => ({ ok: true, headers: {} }),
  computeScopesForLogin: async () => ({ storage: true, arweave: false }),
  sha256: async () => 'question-hash',
  now: () => NOW_MS,
  json,
  ...overrides,
});

test('a catalog ticket reads questions and groups as its person, and nothing passes the ticket on', async () => {
  const env = await signedInEnv();
  const config = { allowOrigins: ['https://app.example'], interviewMode: { joinMatchingGroups: true } };
  const { ticket } = await issueInterviewCatalogTicket({
    env, config, slug: 'demo', sub: PERSON, parent: SIGN_IN, parentExp: NOW + 3600, deps: { now: () => NOW_MS },
  });
  const loads = [];
  const memberLists = [];
  let visitorListed = false;
  const response = await dispatchInterviewBriefRequest({
    request: new Request(catalogUrl(`&ticket=${ticket}`)),
    env,
    deps: catalogDeps(config, {
      loadPublicInterviewQuestions: async (args) => {
        loads.push(args);
        return { questions: [{ id: 'q1', type: 'freeform', prompt: 'Members only?', options: [] }], incomplete: false, refused: false };
      },
      listSelfJoinableWorkerGroupsForMember: async (args) => {
        memberLists.push(args);
        return [{ groupId: 'dacc', label: 'd/acc', joinMode: 'open', memberVisibility: 'session' }];
      },
      listSelfJoinableWorkerGroupsForVisitor: async () => {
        visitorListed = true;
        return [];
      },
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  const body = await response.json();
  assert.deepEqual(loads[0].reader, { address: PERSON, scopes: { storage: true, arweave: false } });
  // Groups this person could join, not what a visitor or a join link would see.
  assert.equal(memberLists[0].address, PERSON);
  assert.equal(visitorListed, false);
  assert.deepEqual(body.groups, [{ groupId: 'dacc', label: 'd/acc' }]);
  assert.equal(JSON.stringify(body).includes(ticket), false);
  assert.equal(body.reviewUrl, 'https://app.example/session/demo?joinGroup=salon&worker=https%3A%2F%2Fworker.example&mode=interview');
});

test('a ticket that no longer works is refused before any question is read', async () => {
  const env = await signedInEnv();
  const config = { allowOrigins: ['https://app.example'] };
  const { ticket } = await issueInterviewCatalogTicket({
    env, config, slug: 'demo', sub: PERSON, parent: SIGN_IN, parentExp: NOW + 3600, deps: { now: () => NOW_MS },
  });
  let loaded = false;
  const loadPublicInterviewQuestions = async () => {
    loaded = true;
    return { questions: [], incomplete: false };
  };
  for (const [label, extra, overrides] of [
    ['an altered ticket', `&ticket=${ticket.slice(0, -2)}AA`, {}],
    ['lost access', `&ticket=${ticket}`, { computeScopesForLogin: async () => ({ storage: false, arweave: false }) }],
    ['an expired ticket', `&ticket=${ticket}`, { now: () => NOW_MS + 3600 * 1000 }],
  ]) {
    const response = await dispatchInterviewBriefRequest({
      request: new Request(catalogUrl(extra)),
      env,
      deps: catalogDeps(config, { loadPublicInterviewQuestions, ...overrides }),
    });
    assert.equal(response.status, 401, label);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer', label);
    assert.equal((await response.json()).reason, 'catalog_ticket_invalid', label);
  }
  assert.equal(loaded, false);
});

test('a catalog closed to signed-out visitors says to sign in', async () => {
  const config = { allowOrigins: ['https://app.example'] };
  const run = (result, extra = '', overrides = {}) => dispatchInterviewBriefRequest({
    request: new Request(catalogUrl(extra)),
    env: overrides.env || {},
    deps: catalogDeps(config, { loadPublicInterviewQuestions: async () => result, ...overrides }),
  });
  // A listing refused to signed-out visitors is not a retry, even when it looks unfinished.
  const refused = await run({ questions: [], incomplete: true, refused: true });
  assert.equal(refused.status, 401);
  assert.equal((await refused.json()).reason, 'sign_in_required');
  // Questions may all be for groups, which a sign-in could show.
  const empty = await run({ questions: [], incomplete: false, refused: false });
  assert.equal(empty.status, 404);
  assert.equal((await empty.json()).reason, 'sign_in_required');
  const env = await signedInEnv();
  const { ticket } = await issueInterviewCatalogTicket({
    env, config, slug: 'demo', sub: PERSON, parent: SIGN_IN, parentExp: NOW + 3600, deps: { now: () => NOW_MS },
  });
  const signedIn = await run({ questions: [], incomplete: false, refused: false }, `&ticket=${ticket}`, { env });
  assert.equal(signedIn.status, 404);
  assert.deepEqual(await signedIn.json(), { error: 'No questions you can see are available for interview prefill.' });
});

test('only a person signed in on the session page, with access now, gets a catalog ticket', async () => {
  const env = await signedInEnv();
  const config = { allowOrigins: ['https://app.example'] };
  const rateLimits = [];
  const mint = ({ payload = {}, ...overrides } = {}) => dispatchInterviewCatalogTicketRequest({
    request: new Request('https://worker.example/agent/interview-catalog-ticket', { method: 'POST' }),
    env,
    baseHeaders: {},
    slug: 'demo',
    deps: {
      json,
      requireAuth: async () => ({
        ok: true,
        slug: 'demo',
        payload: { sub: PERSON, jti: SIGN_IN, exp: NOW + 600, scopes: { storage: true }, authzEpoch: 0, ...payload },
      }),
      readCurrentSessionConfig: async () => ({ config, revision: 1 }),
      getCorsContext: async () => ({ ok: true, headers: { 'access-control-allow-origin': 'https://app.example' } }),
      computeScopesForLogin: async () => ({ storage: true }),
      checkRateLimit: async (args) => {
        rateLimits.push(args);
        return true;
      },
      toStr: (value) => String(value ?? ''),
      now: () => NOW_MS,
      ...overrides,
    },
  });

  const issued = await mint();
  assert.equal(issued.status, 200);
  assert.equal(issued.headers.get('cache-control'), 'no-store');
  assert.equal(issued.headers.get('access-control-allow-origin'), 'https://app.example');
  const { ticket, expiresAt } = await issued.json();
  // Never past the sign-in it came from.
  assert.equal(expiresAt, NOW + 600);
  assert.equal(rateLimits[0].route, 'interview-ticket');
  assert.equal(rateLimits[0].address, PERSON);
  const verified = await verifyInterviewCatalogTicket({
    env, ticket, config, slug: 'demo', deps: { now: () => NOW_MS, computeScopesForLogin: async () => ({ storage: true }) },
  });
  assert.deepEqual(verified.reader, { address: PERSON, scopes: { storage: true, arweave: false } });

  const signedOut = await mint({
    requireAuth: async () => ({ ok: false, response: json({ error: 'Missing Authorization header.' }, 401) }),
  });
  assert.equal(signedOut.status, 401);
  const status = async (args) => (await mint(args)).status;
  assert.equal(await status({ readCurrentSessionConfig: async () => ({ config: { ...config, interviewModeEnabled: false } }) }), 404);
  assert.equal(await status({ payload: { authzEpoch: 1 } }), 401, 'a sign-in from before an access edit');
  assert.equal(await status({ payload: { scopes: {} } }), 403, 'a sign-in that cannot read');
  assert.equal(await status({ computeScopesForLogin: async () => ({ storage: false }) }), 403, 'access lost since signing in');
  assert.equal(await status({ checkRateLimit: async () => false }), 429);
  const agent = await mint({ payload: { agentSource: 'agent-key-hash' } });
  assert.equal(agent.status, 403);
  assert.equal((await agent.json()).reason, 'catalog_ticket_person_only');
  assert.equal(await status({ payload: { exp: NOW } }), 500, 'a sign-in at its very end');
});

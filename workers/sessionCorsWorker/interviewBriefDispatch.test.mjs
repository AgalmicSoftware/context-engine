import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTERVIEW_PROMPT_VERSION,
  __test__interviewBriefDispatch,
  buildInterviewBriefDocument,
  dispatchInterviewBriefRequest,
} from './interviewBriefDispatch.js';

const { canonicalizeQuestions } = __test__interviewBriefDispatch;

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

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
      multichoice: 'Use one exact question option.',
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
      loadPublicInterviewQuestions: async () => [
        { id: 'q1', type: 'freeform', prompt: 'What matters?', options: [] },
      ],
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
  assert.equal(body.researchCoverageContract.verification, 'self_reported');
  assert.equal(body.researchCoverageContract.unknownSearchedCount, null);
  assert.equal('instructions' in body, false);
});

test('dispatchInterviewBriefRequest honors per-session disablement and requires a safe return URL', async () => {
  const baseDeps = {
    resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'demo' }),
    getCorsContext: async () => ({ ok: true, headers: {} }),
    loadPublicInterviewQuestions: async () => [{ id: 'q1', type: 'freeform', prompt: 'Question?', options: [] }],
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

test('dispatchInterviewBriefRequest strips query and fragment state from the supplied return URL', async () => {
  const response = await dispatchInterviewBriefRequest({
    request: new Request('https://worker.example/agent/interview-brief?slug=demo&format=json&sessionUrl=https%3A%2F%2Fapp.example%2Fsession%2Fdemo%3Fworker%3Dhttps%253A%252F%252Fattacker.example%26mode%3DrecordGroup%23private'),
    deps: {
      resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'demo' }),
      getSessionConfig: async () => ({ allowOrigins: ['https://app.example'] }),
      getCorsContext: async () => ({ ok: true, headers: {} }),
      loadPublicInterviewQuestions: async () => [{ id: 'q1', type: 'freeform', prompt: 'Question?', options: [] }],
      sha256: async () => 'question-hash',
      json,
    },
  });
  const body = await response.json();
  assert.equal(body.reviewUrl, 'https://app.example/session/demo?worker=https%3A%2F%2Fworker.example&mode=interview');
  assert.equal(body.reviewUrl.includes('attacker.example'), false);
  assert.equal('instructions' in body, false);
});

test('dispatchInterviewBriefRequest applies anonymous IP daily budgets before loading questions', async () => {
  const cases = [
    {
      name: 'explicit anonymous limit overrides wallet limit',
      limits: { perWalletPerDay: 10, perAnonymousIpPerDay: 4 },
      expectedLimit: 4,
    },
    {
      name: 'absent anonymous limit keeps legacy wallet fallback',
      limits: { perWalletPerDay: 10 },
      expectedLimit: 10,
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
          return [];
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

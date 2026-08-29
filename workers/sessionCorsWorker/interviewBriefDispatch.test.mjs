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
    questionSetHash: 'hash',
    questions: [{ id: 'q1', type: 'freeform', prompt: 'What matters?', options: [] }],
  });
  assert.deepEqual(document, {
    type: 'context-engine.interview-question-catalog',
    version: 1,
    sessionSlug: 'demo',
    reviewUrl: 'https://app.example/session/demo?mode=interview',
    questionSetHash: 'hash',
    prefillPromptVersion: INTERVIEW_PROMPT_VERSION,
    answerContract: {
      binary: ['Agree', 'Unsure', 'Disagree'],
      rating: { min: 0, max: 10, step: 1 },
      multichoice: 'Use one exact question option.',
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
  assert.equal(body.reviewUrl, 'https://app.example/session/demo?mode=interview');
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
    request: new Request('https://worker.example/agent/interview-brief?slug=demo&format=json&sessionUrl=https%3A%2F%2Fapp.example%2Fsession%2Fdemo%3Fmode%3DrecordGroup%23private'),
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
  assert.equal(body.reviewUrl, 'https://app.example/session/demo?mode=interview');
  assert.equal('instructions' in body, false);
});

test('dispatchInterviewBriefRequest applies the anonymous rate limit before loading questions', async () => {
  let questionsLoaded = false;
  const response = await dispatchInterviewBriefRequest({
    request: new Request('https://worker.example/agent/interview-brief?slug=demo&sessionUrl=https://app.example/session/demo'),
    env: { RATE_LIMITS: 'binding' },
    deps: {
      resolveRequestSlugWithoutToken: () => ({ ok: true, explicitSlugProvided: true, slug: 'demo' }),
      getSessionConfig: async () => ({ limits: { perWalletPerDay: 10 } }),
      getCorsContext: async () => ({ ok: true, headers: {} }),
      resolveAnonymousRateIdentity: () => 'anon:example',
      checkRateLimit: async (value) => {
        assert.deepEqual(value, {
          env: { RATE_LIMITS: 'binding' },
          slug: 'demo',
          address: 'anon:example',
          limit: 10,
          route: 'interview-brief',
        });
        return false;
      },
      loadPublicInterviewQuestions: async () => {
        questionsLoaded = true;
        return [];
      },
      json,
    },
  });
  assert.equal(response.status, 429);
  assert.equal(questionsLoaded, false);
});

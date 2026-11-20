import test from 'node:test';
import assert from 'node:assert/strict';
import { createInterviewPrefill } from './interviewPrefill.mjs';
import { parseSessionLink } from './sessionLinks.mjs';

const WORKER = 'https://w.example.workers.dev';
const PAGE = 'https://contextengine.sh/session/forum-a';
const HASH = 'a'.repeat(64);
const LINK = `${PAGE}?worker=${encodeURIComponent(WORKER)}&src=flyer&joinGroup=reviewers&inv=SECRET1#groupInvite=SECRET2`;

const QUESTIONS = [
  { id: 'q-bin', prompt: 'Cities should plant more trees.', type: 'binary', options: ['Agree', 'Unsure', 'Disagree'] },
  { id: 'q-one', prompt: 'Pick one.', type: 'multichoice', options: ['Red', 'Blue'], singleSelect: true },
  { id: 'q-many', prompt: 'Pick some.', type: 'multichoice', options: ['Red', 'Blue', 'Green'], singleSelect: false },
  { id: 'q-quad', prompt: 'Spend credits.', type: 'quadratic', options: ['A', 'B', 'C'], voiceCredits: 16 },
  { id: 'q-rate', prompt: 'Rate it.', type: 'rating', options: [], scale: { min: 1, max: 5 } },
  { id: 'q-free', prompt: 'Say more.', type: 'freeform', options: [] },
];

const catalog = (overrides = {}) => ({
  type: 'context-engine.interview-question-catalog',
  version: 1,
  sessionSlug: 'forum-a',
  reviewUrl: `${PAGE}?src=flyer&joinGroup=reviewers&worker=${encodeURIComponent(WORKER)}&mode=interview`,
  questionSetHash: HASH,
  prefillPromptVersion: 'ce-interview-brief-v6',
  answerContract: { binary: ['Agree', 'Unsure', 'Disagree'], rating: { min: 0, max: 10, step: 1 } },
  questions: QUESTIONS,
  groups: [{ groupId: 'reviewers', label: 'Reviewers' }],
  groupSuggestionData: ['their stated role'],
  groupSuggestionNever: 'protected traits',
  ...overrides,
});

const harness = ({ status = 200, body = catalog(), profile = {} } = {}) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  const resolveLink = async (link) => parseSessionLink(link);
  return { calls, prefill: createInterviewPrefill({ fetchImpl, resolveLink, profile: async () => profile }) };
};

const decode = (reviewLink) => JSON.parse(Buffer.from(new URL(reviewLink).hash.slice('#prefill='.length), 'base64url').toString('utf8'));

test('reads the public catalog with no credentials, keeping only src and joinGroup from the link', async () => {
  const { calls, prefill } = harness();
  const result = await prefill.getInterviewCatalog({ link: LINK });
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(`${url.origin}${url.pathname}`, `${WORKER}/agent/interview-catalog`);
  assert.equal(url.searchParams.get('slug'), 'forum-a');
  assert.equal(url.searchParams.get('sessionUrl'), `${PAGE}?src=flyer&joinGroup=reviewers`);
  assert.doesNotMatch(url.toString(), /SECRET/);
  assert.equal(init.headers.Authorization, undefined);
  assert.equal(init.headers['x-session-slug'], 'forum-a');
  assert.equal(init.redirect, 'manual');
  assert.equal(result.session, 'forum-a');
  assert.equal(result.questions.length, QUESTIONS.length);
  assert.equal(result.groups[0].groupId, 'reviewers');
  assert.match(result.next, /make_review_link/);
});

test('makes a review link the page reads, leaving out drafts that would not fit and saying why', async () => {
  const { prefill } = harness({ profile: { modelId: 'host-model', modelIdSetBy: 'host', platform: 'Claude Desktop', platformSetBy: 'host' } });
  const draft = (questionId, answer) => ({ questionId, answer, confidence: 0.6, evidence: 'stated' });
  const result = await prefill.makeReviewLink({
    link: LINK,
    modelId: 'agent-guess',
    platform: 'ChatGPT',
    responses: [
      draft('q-bin', 'Agree'),
      draft('Q-ONE', 'Blue'),
      draft('q-many', ['Red', 'Green']),
      draft('q-quad', [2, -2, 2]),
      draft('q-rate', 4),
      { ...draft('q-free', 'More shade.'), additionalComments: 'Mainly on hot days.', importance: 70 },
      draft('q-bin', 'Disagree'),
      draft('q-missing', 'Agree'),
      draft('q-quad-2', [4, 1, 0]),
      { questionId: 'q-many', answer: ['Purple'], confidence: 0.5, evidence: 'x' },
    ],
    groups: [{ groupId: 'reviewers', reason: 'They review.' }, { groupId: 'admins' }],
  });
  assert.equal(result.drafts, 6);
  assert.deepEqual(result.leftOut.map((item) => item.questionId), ['q-bin', 'q-missing', 'q-quad-2', 'q-many']);
  assert.match(result.leftOut[0].reason, /second draft/);
  assert.ok(result.reviewLink.startsWith(`${catalog().reviewUrl}#prefill=`));
  const packet = decode(result.reviewLink);
  assert.equal(packet.version, 1);
  assert.equal(packet.sessionSlug, 'forum-a');
  assert.equal(packet.questionSetHash, HASH);
  assert.equal(packet.promptVersion, 'ce-interview-brief-v6');
  // The host's labels win over the agent's, as they do for answers.
  assert.deepEqual(packet.source, { platform: 'claude', modelId: 'host-model', verification: 'self_reported' });
  assert.deepEqual(packet.responses.map((response) => response.questionId), ['q-bin', 'q-one', 'q-many', 'q-quad', 'q-rate', 'q-free']);
  assert.equal(packet.responses[5].additionalComments, 'Mainly on hot days.');
  assert.deepEqual(packet.groups, [{ groupId: 'reviewers', reason: 'They review.' }]);
  assert.doesNotMatch(result.reviewLink, /SECRET/);
});

test('checks each type against the catalog, the quadratic budget included', async () => {
  const { prefill } = harness();
  const one = async (questionId, answer, confidence = 0.5) =>
    (await prefill.makeReviewLink({ link: LINK, responses: [{ questionId, answer, confidence, evidence: 'e' }] })).leftOut?.[0]?.reason || '';
  assert.match(await one('q-quad', [3, 3, 0]), /add up to 18; this question allows 16/);
  assert.match(await one('q-quad', [1, 1]), /3 whole-number votes/);
  assert.match(await one('q-one', ['Red', 'Blue']), /one of: Red, Blue/);
  assert.match(await one('q-many', ['Purple']), /array of the listed options/);
  assert.match(await one('q-rate', 9), /from 1 to 5/);
  assert.match(await one('q-bin', 'Yes'), /Agree, Unsure, Disagree/);
  assert.match(await one('q-free', '  '), /text/);
  assert.match(await one('q-bin', 'Agree', 2), /confidence/);
  assert.equal(await one('q-quad', [4, 0, 0]), '');
});

test('options match in any case and come out as listed, as the review page reads them', async () => {
  const { prefill } = harness();
  const draft = (questionId, answer) => ({ questionId, answer, confidence: 0.5, evidence: 'e' });
  const made = await prefill.makeReviewLink({
    link: LINK,
    responses: [draft('q-bin', ' agree '), draft('q-one', ['blue']), draft('q-many', 'green'), draft('q-free', '  Shade. ')],
  });
  assert.deepEqual(decode(made.reviewLink).responses.map((response) => response.answer), ['Agree', 'Blue', ['Green'], 'Shade.']);
});

test('a v4 catalog takes one option, and a later one that doesn’t say how many leaves the draft out', async () => {
  const many = { id: 'q-many', prompt: 'Pick some.', type: 'multichoice', options: ['Red', 'Blue'] };
  const v4 = harness({ body: catalog({ prefillPromptVersion: 'ce-interview-brief-v4', questions: [many] }) });
  const kept = await v4.prefill.makeReviewLink({ link: LINK, responses: [{ questionId: 'q-many', answer: 'Red', confidence: 0.5, evidence: 'e' }] });
  assert.equal(kept.drafts, 1);
  const two = await v4.prefill.makeReviewLink({ link: LINK, responses: [{ questionId: 'q-many', answer: ['Red', 'Blue'], confidence: 0.5, evidence: 'e' }] });
  assert.match(two.leftOut[0].reason, /one of: Red, Blue/);
  const v6 = harness({ body: catalog({ questions: [many] }) });
  const unsaid = await v6.prefill.makeReviewLink({ link: LINK, responses: [{ questionId: 'q-many', answer: 'Red', confidence: 0.5, evidence: 'e' }] });
  assert.match(unsaid.leftOut[0].reason, /one or several/);
  // A rating that lists options takes one of them, as the page does.
  const labelled = harness({ body: catalog({ questions: [{ id: 'q-r', prompt: 'Rate.', type: 'rating', options: ['Low', 'High'] }] }) });
  const rated = await labelled.prefill.makeReviewLink({ link: LINK, responses: [{ questionId: 'q-r', answer: 3, confidence: 0.5, evidence: 'e' }] });
  assert.match(rated.leftOut[0].reason, /one of: Low, High/);
});

test('short links and links without worker= give the same session page', async () => {
  const short = harness();
  await short.prefill.getInterviewCatalog({ link: `https://contextengine.sh/s/forum-a?worker=${encodeURIComponent(WORKER)}&src=flyer&joinGroup=reviewers` });
  assert.equal(short.calls[0].url.searchParams.get('sessionUrl'), `${PAGE}?src=flyer&joinGroup=reviewers`);
  const calls = [];
  const listed = createInterviewPrefill({
    fetchImpl: async (url) => {
      calls.push(new URL(url));
      return new Response(JSON.stringify(catalog({ reviewUrl: `${PAGE}?worker=${encodeURIComponent(WORKER)}&mode=interview` })), { status: 200 });
    },
    // As participant.resolveLink does for a slug its site lists.
    resolveLink: async (link) => ({ ...parseSessionLink(link), kind: undefined, workerOrigin: WORKER }),
  });
  const found = await listed.getInterviewCatalog({ link: PAGE });
  assert.equal(calls[0].origin, WORKER);
  assert.equal(calls[0].searchParams.get('sessionUrl'), PAGE);
  assert.equal(found.reviewUrl, `${PAGE}?worker=${encodeURIComponent(WORKER)}&mode=interview`);
});

test('with no drafts the link is the clean review page', async () => {
  const { prefill } = harness();
  const result = await prefill.makeReviewLink({ link: LINK, responses: [] });
  assert.equal(result.reviewLink, catalog().reviewUrl);
  assert.equal(result.drafts, 0);
});

test('refusals say what to do, and never ask for an invite code or password', async () => {
  for (const [status, error, pattern] of [
    [401, 'This session’s questions need a sign-in.', /not public \(401.*Let your AI draft your answers.*Never ask them for an invite code/],
    [403, 'Private session.', /not public \(403/],
    [404, 'Interview mode is disabled for this session.', /interview mode is off/],
    [503, 'Interview question discovery is incomplete. Retry shortly.', /can’t answer just now \(Interview question discovery is incomplete/],
    [429, 'Rate limit exceeded.', /limiting requests.*may still be public/],
  ]) {
    const { prefill } = harness({ status, body: { error } });
    await assert.rejects(prefill.getInterviewCatalog({ link: LINK }), pattern);
  }
  const { calls, prefill } = harness();
  await assert.rejects(prefill.getInterviewCatalog({ link: PAGE }), /names no Session Worker/);
  await assert.rejects(prefill.getInterviewCatalog({}), /Pass the session link/);
  assert.equal(calls.length, 0);
});

test('a catalog for another session, of another kind, or with a review link off this page is refused', async () => {
  for (const body of [
    catalog({ sessionSlug: 'forum-b' }),
    catalog({ version: 2 }),
    catalog({ prefillPromptVersion: 'ce-interview-brief-v9' }),
    catalog({ questionSetHash: 'relabelled' }),
  ]) {
    await assert.rejects(harness({ body }).prefill.getInterviewCatalog({ link: LINK }), /not one this MCP reads/);
  }
  for (const reviewUrl of [
    `${PAGE}?ticket=abc&mode=interview`,
    `${PAGE}?mode=interview#prefill=old`,
    `${PAGE}-other?mode=interview`,
    `https://elsewhere.example/session/forum-a?mode=interview`,
    `${PAGE}?inv=SECRET&mode=interview`,
    `${PAGE}?src=flyer&joinGroup=reviewers&mode=interview#`,
    `${PAGE}?src=flyer&joinGroup=reviewers&worker=${encodeURIComponent('https://other.example.workers.dev')}&mode=interview`,
    `${PAGE}?src=flyer&joinGroup=reviewers&mode=vote`,
    `${PAGE}?src=flyer&joinGroup=admins&mode=interview`,
    `${PAGE}?src=flyer&joinGroup=reviewers&mode=interview&mode=interview`,
  ]) {
    await assert.rejects(harness({ body: catalog({ reviewUrl }) }).prefill.makeReviewLink({ link: LINK, responses: [] }), /not this session’s page/);
  }
});

test('drafts too long for one link are refused rather than cut', async () => {
  const { prefill } = harness();
  const long = 'x'.repeat(4000);
  const responses = QUESTIONS.filter((question) => question.type === 'freeform').map((question) => ({ questionId: question.id, answer: long, confidence: 0.5, evidence: long }));
  await assert.rejects(
    prefill.makeReviewLink({ link: LINK, responses, responderContext: { summary: 'y'.repeat(80_000) } }),
    /too long for one link/,
  );
});

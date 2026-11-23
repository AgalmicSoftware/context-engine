import test from 'node:test';
import assert from 'node:assert/strict';
import { createInterviewPrefill } from './interviewPrefill.mjs';
import { parseSessionLink } from './sessionLinks.mjs';
import { randomBytes } from 'node:crypto';
import { decodeLinkBytes, decodeLinkUtf8, inflateLinkBytes } from '../../shared/linkPayload.mjs';

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

// `site(init)` answers the session page's /manifest.json: by default, a site that reads #prefillz=.
const harness = ({ status = 200, body = catalog(), profile = {}, readInvite, site = () => Response.json(SITE_MANIFEST), now } = {}) => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    if (new URL(url).pathname === '/manifest.json') {
      calls.push({ url: new URL(url), init, site: true });
      return site(init);
    }
    calls.push({ url: new URL(url), init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  const resolveLink = async (link) => parseSessionLink(link);
  return { calls, prefill: createInterviewPrefill({ fetchImpl, resolveLink, profile: async () => profile, ...(readInvite ? { readInvite } : {}), ...(now ? { now } : {}) }) };
};

// Read as the session page reads it (sessionInterview.ts), through the same shared code.
const decode = async (reviewLink) => {
  const params = new URLSearchParams(new URL(reviewLink).hash.slice(1));
  const packed = params.has('prefillz');
  const decoded = decodeLinkBytes(params.get(packed ? 'prefillz' : 'prefill'), { maxLength: 100_000 });
  assert.ok(decoded.ok, decoded.error);
  const text = decodeLinkUtf8(packed ? await inflateLinkBytes(decoded.bytes, 400_000) : decoded.bytes);
  assert.ok(text.ok, text.error);
  return JSON.parse(text.text);
};

const SITE_MANIFEST = { name: 'contextEngine', context_engine_review_links: ['prefill', 'prefillz'] };

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
  assert.ok(result.reviewLink.startsWith(`${catalog().reviewUrl}#prefillz=`));
  const packet = await decode(result.reviewLink);
  assert.match(result.next, /copied exactly: if one character changes or goes missing.*too long to send whole, call make_review_link again with shorter evidence and comments, or fewer drafts\. Nothing is submitted/);
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
  assert.deepEqual((await decode(made.reviewLink)).responses.map((response) => response.answer), ['Agree', 'Blue', ['Green'], 'Shade.']);
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

test('a private session’s catalog is read with the proof its invite link makes, sent as a header and shown nowhere', async () => {
  const PROOF = 'reviewers:0xPROOF';
  const asked = [];
  const { calls, prefill } = harness({ readInvite: async (info) => { asked.push(info); return PROOF; } });
  const read = await prefill.getInterviewCatalog({ link: LINK });
  assert.equal(read.privateSession, true);
  assert.equal(asked.length, 1);
  assert.equal(asked[0].groupInvite, 'SECRET2');
  assert.equal(calls[0].init.headers['X-CE-Group-Invite'], PROOF);
  assert.doesNotMatch(calls[0].url.toString(), /SECRET|PROOF/);
  assert.doesNotMatch(JSON.stringify(read), /SECRET|PROOF/);
  const made = await prefill.makeReviewLink({ link: LINK, responses: [{ questionId: 'q-bin', answer: 'Agree', confidence: 0.9, evidence: 'They said so.' }] });
  assert.doesNotMatch(JSON.stringify(made), /SECRET|PROOF|groupInvite/);
  assert.doesNotMatch(JSON.stringify(await decode(made.reviewLink)), /SECRET|PROOF/);
  assert.match(made.next, /private, and the review link carries no invite/);

  // A link without an invite asks for none, and a session that needs none sends none.
  const plain = harness({ body: catalog({ reviewUrl: `${PAGE}?worker=${encodeURIComponent(WORKER)}&mode=interview` }), readInvite: async () => { throw new Error('not asked'); } });
  await plain.prefill.getInterviewCatalog({ link: `${PAGE}?worker=${encodeURIComponent(WORKER)}` });
  assert.equal(plain.calls[0].init.headers['X-CE-Group-Invite'], undefined);
  const open = harness({ readInvite: async () => '' });
  const shown = await open.prefill.getInterviewCatalog({ link: LINK });
  assert.equal(open.calls[0].init.headers['X-CE-Group-Invite'], undefined);
  assert.equal(shown.privateSession, undefined);

  // An invite that can't read stops before anything is sent, in the reader's own words.
  const code = harness({ readInvite: async () => { throw new Error('This link’s invite is a one-use code.'); } });
  await assert.rejects(code.prefill.getInterviewCatalog({ link: LINK }), /one-use code/);
  assert.equal(code.calls.length, 0);
});

test('refusals say what to do, and never ask for a code or password by itself', async () => {
  for (const [status, error, pattern, reason] of [
    [401, 'This session’s questions need a sign-in.', /not public \(401.*group’s invite link.*Have AI draft your answers.*Never ask them to type a code or a password by itself/],
    [403, 'Private session.', /not public \(403/],
    [403, 'This session is private. Open it from your group invite link.', /Error: This session is private\. If the person has the group’s invite link/, 'private_session_invite_required'],
    [403, 'This invite link no longer opens this session.', /invite no longer opens it/, 'private_session_invite_invalid'],
    [404, 'Interview mode is disabled for this session.', /interview mode is off/],
    [503, 'Interview question discovery is incomplete. Retry shortly.', /can’t answer just now \(Interview question discovery is incomplete/],
    [429, 'Rate limit exceeded.', /limiting requests.*may still be public/],
  ]) {
    const { prefill } = harness({ status, body: { error, ...(reason ? { reason } : {}) } });
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

test('the link is deflated where the site says it reads #prefillz=, and plain anywhere else', async () => {
  const draft = { questionId: 'q-free', answer: 'More trees, and shade.', confidence: 0.5, evidence: 'said so' };
  const sites = [
    ['lists it', undefined, 'prefillz'],
    ['an older manifest', () => Response.json({ name: 'contextEngine' }), 'prefill'],
    ['no manifest', () => new Response('Not found', { status: 404 }), 'prefill'],
    ['not JSON', () => new Response('<html>', { status: 200 }), 'prefill'],
    ['a redirect', () => new Response(null, { status: 302, headers: { location: 'https://elsewhere.example/manifest.json' } }), 'prefill'],
    ['unreachable', () => Promise.reject(new TypeError('fetch failed')), 'prefill'],
  ];
  for (const [label, site, key] of sites) {
    const { prefill, calls } = harness(site ? { site } : {});
    const first = await prefill.makeReviewLink({ link: LINK, responses: [draft] });
    const second = await prefill.makeReviewLink({ link: LINK, responses: [draft] });
    for (const made of [first, second]) {
      assert.ok(made.reviewLink.startsWith(`${catalog().reviewUrl}#${key}=`), `${label}: ${made.reviewLink}`);
      assert.equal((await decode(made.reviewLink)).responses[0].answer, draft.answer);
    }
    // Asked once, of the session page's own site, with nothing of the person's.
    const asked = calls.filter((call) => call.site);
    assert.equal(asked.length, 1, label);
    assert.equal(asked[0].url.href, 'https://contextengine.sh/manifest.json');
    assert.equal(asked[0].init.credentials, 'omit');
    assert.equal(asked[0].init.redirect, 'manual');
  }
});

test('a clear answer from the site holds while the MCP runs; a failure is asked again after five minutes', async () => {
  const draft = { questionId: 'q-free', answer: 'Shade.', confidence: 0.5, evidence: 'said so' };
  for (const [label, site, again] of [
    ['a manifest', undefined, false],
    ['no manifest', () => new Response('Not found', { status: 404 }), false],
    ['a server error', () => new Response('', { status: 503 }), true],
    ['unreachable', () => Promise.reject(new TypeError('fetch failed')), true],
  ]) {
    let clock = 1_000;
    const { prefill, calls } = harness({ ...(site ? { site } : {}), now: () => clock });
    await prefill.makeReviewLink({ link: LINK, responses: [draft] });
    clock += 4 * 60_000;
    await prefill.makeReviewLink({ link: LINK, responses: [draft] });
    assert.equal(calls.filter((call) => call.site).length, 1, label);
    clock += 2 * 60_000;
    await prefill.makeReviewLink({ link: LINK, responses: [draft] });
    assert.equal(calls.filter((call) => call.site).length, again ? 2 : 1, label);
  }
});

test('a site that never answers is given the plain link after a short wait', { timeout: 10_000 }, async () => {
  const site = (init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
  const started = Date.now();
  // AbortSignal.timeout's timer doesn't hold the process open; in the MCP its stdio does.
  const hold = setTimeout(() => {}, 8_000);
  const made = await harness({ site }).prefill.makeReviewLink({
    link: LINK,
    responses: [{ questionId: 'q-free', answer: 'Shade.', confidence: 0.5, evidence: 'said so' }],
  });
  assert.ok(made.reviewLink.includes('#prefill='));
  clearTimeout(hold);
  assert.ok(Date.now() - started < 6_000);
});

test('drafts too long for one link are refused rather than cut', async () => {
  const { prefill } = harness();
  const responses = QUESTIONS.filter((question) => question.type === 'freeform').map((question) => ({ questionId: question.id, answer: 'Shade.', confidence: 0.5, evidence: 'said so' }));
  // Text that doesn't deflate makes too long a link; text that does still can't unpack past what the page reads.
  for (const summary of [randomBytes(90_000).toString('base64'), 'y'.repeat(450_000)]) {
    await assert.rejects(prefill.makeReviewLink({ link: LINK, responses, responderContext: { summary } }), /too long for one link/);
  }
  const made = await prefill.makeReviewLink({ link: LINK, responses, responderContext: { summary: 'y'.repeat(300_000) } });
  assert.ok(made.reviewLink.length < 5_000);
  // Plain, the same drafts are far too long.
  const plain = harness({ site: () => Response.json({}) }).prefill;
  await assert.rejects(plain.makeReviewLink({ link: LINK, responses, responderContext: { summary: 'y'.repeat(80_000) } }), /too long for one link/);
});

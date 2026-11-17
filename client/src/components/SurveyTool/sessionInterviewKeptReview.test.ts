import {
  KEPT_REVIEW_MAX_AGE_MS,
  SIGNED_OUT_REVIEW_MAX_AGE_MS,
  clearKeptReview,
  keptReviewOwner,
  readKeptReview,
  writeKeptReview,
  type KeptInterviewReview,
} from './sessionInterviewKeptReview';

const review = (overrides: Partial<KeptInterviewReview> = {}): KeptInterviewReview => ({
  packet: null,
  transcript: 'I said this.',
  mappedTranscript: 'I said this.',
  responderContext: '',
  drafts: [{ questionId: 'q1', answer: 'Agree' }],
  selected: { q1: true },
  removedDraftIds: {},
  editedDrafts: {},
  prefillDraftIds: [],
  suggestedQuestions: [],
  ownEvidenceIds: ['q1'],
  hidden: {},
  includeProvenance: true,
  researchSharingChoice: { contextToken: 'demo', included: false },
  includeResponderName: false,
  draftText: null,
  ...overrides,
});
const now = Date.UTC(2026, 10, 16);

beforeEach(() => window.localStorage.clear());

it('names the owner by the signed-in account, or this browser alone', () => {
  expect(keptReviewOwner('0xABC', true)).toBe('account:0xabc');
  expect(keptReviewOwner('0xABC', false)).toBe('browser');
  expect(keptReviewOwner('', true)).toBe('browser');
});

it('keeps one review per session and owner, and clears it', () => {
  writeKeptReview('Demo', 'account:0xabc', review(), now);
  expect(readKeptReview('demo', 'account:0xabc', now)).toEqual({
    owner: 'account:0xabc',
    since: now,
    review: review(),
  });
  expect(readKeptReview('demo', 'account:0xdef', now)).toBeNull();
  expect(readKeptReview('demo', 'browser', now)).toBeNull();
  expect(readKeptReview('other', 'account:0xabc', now)).toBeNull();
  clearKeptReview('demo', 'account:0xabc');
  expect(readKeptReview('demo', 'account:0xabc', now)).toBeNull();
});

it('lets an account’s review run out a day after it was first kept, and a signed-out one after an hour', () => {
  writeKeptReview('demo', 'account:0xabc', review(), now);
  writeKeptReview('demo', 'account:0xdef', review(), now - KEPT_REVIEW_MAX_AGE_MS);
  writeKeptReview('demo', 'browser', review(), now);
  expect(readKeptReview('demo', 'account:0xabc', now + SIGNED_OUT_REVIEW_MAX_AGE_MS)).not.toBeNull();
  expect(window.localStorage.getItem('ce:interview-review:v1:demo:account:0xdef')).toBeNull();
  expect(window.localStorage.getItem('ce:interview-review:v1:demo:browser')).toBeNull();
  writeKeptReview('demo', 'browser', review(), now);
  expect(readKeptReview('demo', 'browser', now + SIGNED_OUT_REVIEW_MAX_AGE_MS - 1)).not.toBeNull();
  expect(readKeptReview('demo', 'account:0xabc', now + KEPT_REVIEW_MAX_AGE_MS - 1)).not.toBeNull();
  expect(readKeptReview('demo', 'account:0xabc', now + KEPT_REVIEW_MAX_AGE_MS)).toBeNull();
  expect(window.localStorage.length).toBe(0);
});

it('ignores a kept review whose owner differs from its key, that holds nothing, or whose packet broke', () => {
  window.localStorage.setItem(
    'ce:interview-review:v1:demo:account:0xabc',
    JSON.stringify({ v: 1, owner: 'account:0xdef', savedAt: now, review: review() }),
  );
  expect(readKeptReview('demo', 'account:0xabc', now)).toBeNull();
  writeKeptReview('demo', 'browser', review({ drafts: [], transcript: ' ' }), now);
  expect(readKeptReview('demo', 'browser', now)).toBeNull();
  window.localStorage.setItem('ce:interview-review:v1:demo:browser', '{not json');
  expect(readKeptReview('demo', 'browser', now)).toBeNull();
  for (const packet of [
    { version: 1 },
    { version: 1, source: {}, responses: [] },
    { version: 1, source: { modelId: 'm' }, responses: 'x' },
    'packet',
  ]) {
    writeKeptReview('demo', 'browser', review({ packet: packet as never }), now);
    expect(readKeptReview('demo', 'browser', now)).toBeNull();
  }
  const packet = { version: 1, sessionSlug: 'demo', source: { modelId: 'm' } };
  writeKeptReview('demo', 'browser', review({ packet: packet as never }), now);
  expect(readKeptReview('demo', 'browser', now)?.review.packet).toEqual(packet);
});

it('reads back only well-formed parts of a review', () => {
  window.localStorage.setItem(
    'ce:interview-review:v1:demo:browser',
    JSON.stringify({
      v: 1,
      owner: 'browser',
      savedAt: now,
      review: {
        transcript: 'Words',
        drafts: [{ questionId: 'q1' }, { answer: 'x' }, 'bad'],
        prefillDraftIds: ['q2', 3],
        researchSharingChoice: { contextToken: 'demo', included: 'no' },
      },
    }),
  );
  expect(readKeptReview('demo', 'browser', now)?.review).toMatchObject({
    transcript: 'Words',
    drafts: [{ questionId: 'q1' }],
    prefillDraftIds: ['q2'],
    selected: {},
    packet: null,
    includeProvenance: true,
    researchSharingChoice: null,
    draftText: null,
  });
});

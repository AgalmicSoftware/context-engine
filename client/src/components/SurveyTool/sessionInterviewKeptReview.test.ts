import {
  KEPT_REVIEW_MAX_AGE_MS,
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
  leftOutIds: [],
  stillFitIds: [],
  prefillDraftIds: [],
  suggestedQuestions: [],
  ownEvidenceIds: ['q1'],
  hidden: {},
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
  expect(readKeptReview('demo', 'account:0xabc', now)?.drafts).toEqual([{ questionId: 'q1', answer: 'Agree' }]);
  expect(readKeptReview('demo', 'account:0xdef', now)).toBeNull();
  expect(readKeptReview('demo', 'browser', now)).toBeNull();
  expect(readKeptReview('other', 'account:0xabc', now)).toBeNull();
  clearKeptReview('demo', 'account:0xabc');
  expect(readKeptReview('demo', 'account:0xabc', now)).toBeNull();
});

it('lets a review run out after a day, whoever it belongs to', () => {
  writeKeptReview('demo', 'browser', review(), now);
  writeKeptReview('demo', 'account:0xabc', review(), now - KEPT_REVIEW_MAX_AGE_MS);
  expect(readKeptReview('demo', 'browser', now + KEPT_REVIEW_MAX_AGE_MS - 1)).not.toBeNull();
  expect(window.localStorage.getItem('ce:interview-review:v1:demo:account:0xabc')).toBeNull();
  expect(readKeptReview('demo', 'browser', now + KEPT_REVIEW_MAX_AGE_MS)).toBeNull();
  expect(window.localStorage.length).toBe(0);
});

it('ignores a kept review whose stored owner differs from its key, or that holds nothing', () => {
  window.localStorage.setItem(
    'ce:interview-review:v1:demo:account:0xabc',
    JSON.stringify({ v: 1, owner: 'account:0xdef', savedAt: now, review: review() }),
  );
  expect(readKeptReview('demo', 'account:0xabc', now)).toBeNull();
  writeKeptReview('demo', 'browser', review({ drafts: [], transcript: ' ' }), now);
  expect(readKeptReview('demo', 'browser', now)).toBeNull();
  window.localStorage.setItem('ce:interview-review:v1:demo:browser', '{not json');
  expect(readKeptReview('demo', 'browser', now)).toBeNull();
});

it('reads back only well-formed parts of a review', () => {
  window.localStorage.setItem(
    'ce:interview-review:v1:demo:browser',
    JSON.stringify({
      v: 1,
      owner: 'browser',
      savedAt: now,
      review: { transcript: 'Words', drafts: [{ questionId: 'q1' }, { answer: 'x' }, 'bad'], leftOutIds: ['q2', 3] },
    }),
  );
  expect(readKeptReview('demo', 'browser', now)).toMatchObject({
    transcript: 'Words',
    drafts: [{ questionId: 'q1' }],
    leftOutIds: ['q2'],
    selected: {},
    packet: null,
  });
});

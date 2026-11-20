/** @file communityWorkerListingCounts.test.ts */
import {
  countShown,
  listedResponders,
  listsEveryAnswer,
  loadWorkerListingCounts,
} from './communityWorkerListingCounts';

const A = '0x00000000000000000000000000000000000000aa';
const B = '0x00000000000000000000000000000000000000bb';
const item = (resourceId: string, extra: Record<string, unknown> = {}) => ({
  storageRef: { id: `ref-${resourceId}-${Math.random()}` },
  metadata: { resourceId, ...extra },
});

it('counts each question once however many versions are stored, and leaves hidden ones out', () => {
  expect(
    countShown([
      item('Q1'),
      item('q1'), // a later version of the same question
      item('q2'),
      item('q3'),
      { hidden: true, metadata: { resourceId: 'q3' } }, // an admin hid it
      { metadata: { hidden: true, resourceId: 'q9' } }, // hidden, and never listed otherwise
    ]),
  ).toBe(2);
  expect(countShown([])).toBe(0);
  // Without an id a stored record can only count as itself.
  expect(
    countShown([
      { storageRef: { id: 'a' }, metadata: {} },
      { storageRef: { id: 'b' }, metadata: {} },
    ]),
  ).toBe(2);
});

it('lists each responder once, by address', () => {
  expect(
    listedResponders([
      item('q1', { responder: A.toUpperCase().replace('0X', '0x') }),
      item('q2', { responder: A }),
      item('q1', { responder: B }),
      item('q1', { responder: 'telegram:1' }),
      { hidden: true, metadata: { responder: '0x00000000000000000000000000000000000000cc' } },
    ]),
  ).toEqual([A, B]);
});

type Options = {
  resource?: unknown;
  cursor?: unknown;
  sessionSlug?: unknown;
  prompt?: unknown;
  preferAnonymous?: unknown;
  limit?: unknown;
};
const everyone = { sessionSlug: 'other', sessionConfig: { slug: 'other' }, account: A, everyAnswerListed: true };

it('reads the three listings side by side, page by page, without asking for a sign-in', async () => {
  const calls: Options[] = [];
  const listPage = jest.fn(async (options: Options) => {
    calls.push(options);
    if (options.resource === 'questions') return { items: [item('q1'), item('q2')], listComplete: true };
    if (options.resource === 'surveys') return { items: [], listComplete: true };
    return options.cursor
      ? { items: [item('q2', { responder: B })], listComplete: true }
      : { items: [item('q1', { responder: A })], cursor: 'next', listComplete: false };
  });
  await expect(loadWorkerListingCounts(everyone, { listPage })).resolves.toEqual({
    questions: 2,
    surveys: 0,
    responders: [A, B],
  });
  expect(calls.map((call) => call.resource).sort()).toEqual(['questions', 'responses', 'responses', 'surveys']);
  expect(calls.every((call) => call.sessionSlug === 'other' && call.prompt === false && call.preferAnonymous)).toBe(
    true,
  );
  expect(calls.find((call) => call.resource === 'responses')?.limit).toBe(500);
});

it('keeps each count to its own listing: a refused one leaves the others standing', async () => {
  const refused = jest.fn(async (options: Options) => {
    if (options.resource === 'responses') throw new Error('Storage list failed (403).');
    return { items: [item('q1')], listComplete: true };
  });
  await expect(loadWorkerListingCounts(everyone, { listPage: refused })).resolves.toEqual({
    questions: 1,
    surveys: 1,
    responders: null,
  });
});

it('reads answers only as anyone would where the session may list a person just their own', async () => {
  type Seen = Options & { anonymousOnly?: unknown };
  // Refused to an anonymous reader: no people count, whatever a signed-in reader would have been listed.
  const refused = jest.fn(async (options: Seen) => {
    if (options.resource === 'responses') {
      expect(options.anonymousOnly).toBe(true);
      throw new Error('Storage list failed (403).');
    }
    return { items: [item('q1')], listComplete: true };
  });
  await expect(
    loadWorkerListingCounts({ ...everyone, everyAnswerListed: false }, { listPage: refused }),
  ).resolves.toEqual({ questions: 1, surveys: 1, responders: null });
  // Given to anyone: the session shows its answers to all, so the count is whole.
  const open = jest.fn(async (_options: Seen) => ({ items: [item('q1', { responder: A })], listComplete: true }));
  await expect(loadWorkerListingCounts({ ...everyone, everyAnswerListed: false }, { listPage: open })).resolves.toEqual(
    { questions: 1, surveys: 1, responders: [A] },
  );
  // Where every reader sees all answers, the held sign-in may be used.
  const member = jest.fn(async (_options: Seen) => ({ items: [], listComplete: true }));
  await loadWorkerListingCounts(everyone, { listPage: member });
  expect(member.mock.calls.every(([options]) => options.anonymousOnly === undefined)).toBe(true);

  const profile = (visibility: string) => ({ sessionModeProfile: { results: { visibility } } });
  expect(listsEveryAnswer(profile('public_full_if_storage_public'))).toBe(true);
  expect(listsEveryAnswer(profile('session_member_full'))).toBe(true);
  expect(listsEveryAnswer(profile('participant_aggregate'))).toBe(false);
  expect(listsEveryAnswer({})).toBe(false);
});

it('gives no counts at all when nothing could be read, or a listing never finishes', async () => {
  const refused = jest.fn(async (_options: Options) => {
    throw new Error('Storage list failed (401).');
  });
  await expect(loadWorkerListingCounts(everyone, { listPage: refused })).rejects.toThrow('listings_unread');
  const stuck = jest.fn(async (_options: Options) => ({ items: [], cursor: 'same', listComplete: false }));
  await expect(loadWorkerListingCounts(everyone, { listPage: stuck })).rejects.toThrow('listings_unread');
});

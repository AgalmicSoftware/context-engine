import { LegacyOwnResponseListingError } from '../../utilities/storage/storageClient';
import {
  loadSessionInterviewSavedAnswers,
  mergeInterviewSavedAnswerBaseline,
  type InterviewSavedAnswerDiffDeps,
} from './sessionInterviewSavedAnswers';
import { responseValuesEqual } from './responseValueEquality';
import { loadWorkerResponses } from '../../utilities/survey/workerResponseHydration';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
jest.mock('../../utilities/survey/workerResponseHydration', () => ({
  ...jest.requireActual<typeof import('../../utilities/survey/workerResponseHydration')>(
    '../../utilities/survey/workerResponseHydration',
  ),
  loadWorkerResponses: jest.fn(),
}));
jest.mock('../../domains/surveys/surveyQuestionReadsPort', () => ({
  surveyQuestionReadsPort: { getResponseHash: jest.fn(), getResponse: jest.fn() },
}));
const base = {
  questionIds: ['q1', 'q2'],
  account: '0xabc',
  sessionSlug: 'alpha',
  sessionConfig: {},
  signal: new AbortController().signal,
};
beforeEach(() => {
  jest.resetAllMocks();
});
it('uses strict per-account chain reads, distinguishing missing answers from failed reads', async () => {
  jest.mocked(surveyQuestionReadsPort.getResponseHash).mockResolvedValueOnce('hash').mockResolvedValueOnce(null);
  jest.mocked(surveyQuestionReadsPort.getResponse).mockResolvedValue({ answer: { value: 'latest' } });
  await expect(loadSessionInterviewSavedAnswers(base)).resolves.toEqual([
    { questionID: 'q1', answer: { value: 'latest' } },
  ]);
  expect(surveyQuestionReadsPort.getResponseHash).toHaveBeenCalledWith(
    undefined,
    '0xabc',
    'q1',
    {},
    { throwOnError: true },
  );
  jest.mocked(surveyQuestionReadsPort.getResponseHash).mockRejectedValue(new Error('RPC unavailable'));
  await expect(loadSessionInterviewSavedAnswers(base)).rejects.toThrow('RPC unavailable');
});
it('chooses the latest Hosted edit with stable same-time ordering', async () => {
  const row = {
    questionId: 'q1',
    responder: '0xabc',
    timestamp: 2,
    storageRefId: 'ref-b',
    response: { answer: 'latest' },
  };
  jest
    .mocked(loadWorkerResponses)
    .mockResolvedValue([
      row,
      { ...row, storageRefId: 'ref-a', response: { answer: 'older' } },
      { ...row, timestamp: 1, storageRefId: 'ref-z', response: { answer: 'oldest' } },
    ]);
  await expect(
    loadSessionInterviewSavedAnswers({
      ...base,
      sessionConfig: { sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE) },
    }),
  ).resolves.toEqual([{ answer: 'latest', questionID: 'q1' }]);
  expect(loadWorkerResponses).toHaveBeenCalledWith(expect.objectContaining({ ownResponses: true, account: '0xabc' }));
});
const field = (value: unknown, policy: Record<string, unknown> = {}) => ({
  value,
  encrypted: false,
  encryptionAudience: 'self',
  encryptionGateId: null,
  audienceMode: 'explicit',
  hash: '',
  encryptedPortion: '',
  ...policy,
});
const slice = ({
  answers = {},
  additionalComments = {},
  importance = {},
  conviction = {},
}: Record<string, Record<string, unknown>> = {}) => ({ answers, additionalComments, importance, conviction });
const diff: InterviewSavedAnswerDiffDeps = {
  normalizeQuestionIdKey: (questionId: string) => questionId.trim().toLowerCase(),
  valuesEqual: (a: unknown, b: unknown) => responseValuesEqual(a, b, true),
  getDefaultResponseEncryptionAudience: () => 'self',
  normalizeResponseEncryptionAudience: (audience: unknown) => audience,
  getDefaultResponseEncryptionAudienceForQid: () => 'self',
  resolveFieldEncryptionGateId: (entry) => entry?.encryptionGateId ?? null,
  normalizeFieldAudienceMode: (mode) => mode || 'explicit',
};

it('merges the saved baseline without discarding in-flight local edits or unrelated questions', () => {
  const merged = mergeInterviewSavedAnswerBaseline(
    slice({ answers: { q1: field('local edit'), q2: field('old'), q3: field('unrelated') }, importance: { q1: 0 } }),
    slice({ answers: { q1: field('old'), q2: field('old') }, importance: { q1: 0 } }),
    slice({ answers: { q1: field('saved'), q2: field('latest') }, importance: { q1: 4 } }),
    ['q1', 'q2'],
    diff,
  );
  expect(merged.slice.answers).toEqual({ q1: field('local edit'), q2: field('latest'), q3: field('unrelated') });
  expect(merged.baseline.answers).toEqual({ q1: field('saved'), q2: field('latest') });
  expect(merged.slice.importance.q1).toBe(4);
});

it('keeps a locally changed answer and comment when saved answers load', () => {
  const merged = mergeInterviewSavedAnswerBaseline(
    slice({ answers: { q1: field('Agree') }, additionalComments: { q1: field('My reason') } }),
    slice({ answers: { q1: field('Disagree') }, additionalComments: { q1: field('') } }),
    slice({ answers: { q1: field('Disagree') }, additionalComments: { q1: field('Saved reason') } }),
    ['q1'],
    diff,
  );
  expect(merged.slice.answers.q1).toEqual(field('Agree'));
  expect(merged.slice.additionalComments.q1).toEqual(field('My reason'));
  expect(merged.baseline.additionalComments.q1).toEqual(field('Saved reason'));
});

it('keeps local encryption, audience, and gate changes when the answer text is unchanged', () => {
  const plain = field('Agree');
  const encryptedSelf = field('Agree', { encrypted: true });
  const gated = (gateId: string) =>
    field('Agree', { encrypted: true, encryptionAudience: 'gate', encryptionGateId: gateId });
  const merged = mergeInterviewSavedAnswerBaseline(
    slice({ answers: { q1: encryptedSelf, q2: gated('gate-1'), q3: gated('gate-2') } }),
    slice({ answers: { q1: plain, q2: encryptedSelf, q3: gated('gate-1') } }),
    slice({ answers: { q1: plain, q2: encryptedSelf, q3: gated('gate-1') } }),
    ['q1', 'q2', 'q3'],
    diff,
  );
  expect(merged.slice.answers).toEqual({ q1: encryptedSelf, q2: gated('gate-1'), q3: gated('gate-2') });
});

it('keeps a local edit whose saved answer is missing', () => {
  const merged = mergeInterviewSavedAnswerBaseline(
    slice({ answers: { q1: field('Agree') } }),
    slice({ answers: { q1: field('Disagree') } }),
    slice(),
    ['q1'],
    diff,
  );
  expect(merged.slice.answers.q1).toEqual(field('Agree'));
  expect(merged.baseline.answers).toEqual({});
});

it('lets untouched local state, including re-derived metadata, take the refreshed saved answer', () => {
  const saved = field('Agree', { hash: '0xsaved' });
  const merged = mergeInterviewSavedAnswerBaseline(
    slice({
      answers: {
        q1: field('Disagree', { encrypted: true, encryptedPortion: 'ciphertext-b', hash: '0xlocal' }),
        q2: field('Unsure'),
      },
    }),
    slice({
      answers: { q1: field('Disagree', { encrypted: true, encryptedPortion: 'ciphertext-a' }), q2: field('Unsure') },
    }),
    slice({ answers: { q1: saved } }),
    ['q1', 'q2'],
    diff,
  );
  expect(merged.slice.answers).toEqual({ q1: saved });
  expect(merged.baseline.answers).toEqual({ q1: saved });
});

it('requests the public-cache fallback only for the verified legacy listing', async () => {
  const options = {
    ...base,
    sessionConfig: { sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE) },
  };
  jest.mocked(loadWorkerResponses).mockRejectedValueOnce(new LegacyOwnResponseListingError());
  await expect(loadSessionInterviewSavedAnswers(options)).resolves.toBeNull();
  jest
    .mocked(loadWorkerResponses)
    .mockRejectedValueOnce(new Error('This Worker could not verify your complete saved answers.'));
  await expect(loadSessionInterviewSavedAnswers(options)).rejects.toThrow('complete saved answers');
});

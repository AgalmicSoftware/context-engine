import { loadCommunityWorkerQuestions } from './communityWorkerQuestions';
import {
  loadWorkerCanonicalQuestions,
  mergeWorkerCanonicalQuestionMetadata,
} from '../../domains/surveys/workerCanonicalMetadataHydrationPort';
import { peekCacheSync } from '../../utilities/cache/cacheScripts';
import { loadWorkerResponses, mergeWorkerQuestionResponses } from '../../utilities/survey/workerResponseHydration';
import { resolveWorkerCanonicalCacheIdentity } from '../../utilities/survey/workerCanonicalCacheIdentity';

jest.mock('../../domains/surveys/workerCanonicalMetadataHydrationPort', () => ({
  loadWorkerCanonicalQuestions: jest.fn(),
  mergeWorkerCanonicalQuestionMetadata: jest.fn(),
}));
jest.mock('../../utilities/survey/workerResponseHydration', () => ({
  loadWorkerResponses: jest.fn(),
  mergeWorkerQuestionResponses: jest.fn(),
}));
jest.mock('../../utilities/cache/cacheScripts', () => ({ peekCacheSync: jest.fn() }));
const mockIdentity = {
  version: 2 as const,
  key: 'wk-identity',
  workerOrigin: 'https://worker.example',
  sessionSlug: 'wk',
  sessionId: '0x1',
  reader: '',
};
jest.mock('../../utilities/survey/workerCanonicalCacheIdentity', () => ({
  WORKER_CANONICAL_CACHE_SCOPE_KEY: 'worker',
  resolveWorkerCanonicalCacheIdentity: jest.fn(() => mockIdentity),
}));

const publicAnswers = { sessionModeProfile: { results: { visibility: 'public_full_if_storage_public' } } };
const membersOnly = { sessionModeProfile: { results: { visibility: 'session_member_full' } } };
const ownOnly = { sessionModeProfile: { results: { visibility: 'own_only' } } };
const held = { worker: { questions: { old: {} } } };
const listing = { rows: [], listedStorageRefIds: new Set<string>() };
const withQuestions = { worker: { questions: { old: {}, q1: { prompt: 'One' } } } };
const withAnswers = { worker: { questions: { q1: { prompt: 'One' } }, questionResponses: { q1: { '0x1': {} } } } };

describe('loadCommunityWorkerQuestions', () => {
  beforeEach(() => {
    jest.mocked(peekCacheSync).mockReturnValue(held);
    jest.mocked(loadWorkerCanonicalQuestions).mockResolvedValue(listing);
    jest.mocked(mergeWorkerCanonicalQuestionMetadata).mockReturnValue(withQuestions);
    jest.mocked(loadWorkerResponses).mockResolvedValue([]);
    jest.mocked(mergeWorkerQuestionResponses).mockReturnValue(withAnswers);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reads questions and public answers signed out, onto what this browser holds', async () => {
    const result = await loadCommunityWorkerQuestions({ sessionSlug: 'wk', sessionConfig: publicAnswers });

    expect(loadWorkerCanonicalQuestions).toHaveBeenCalledWith({
      sessionSlug: 'wk',
      sessionConfig: publicAnswers,
      account: '',
    });
    // Read as anyone would: the cache node it lands on is the signed-out reader's.
    expect(resolveWorkerCanonicalCacheIdentity).toHaveBeenCalledWith({
      sessionConfig: publicAnswers,
      sessionSlug: 'wk',
      reader: '',
    });
    expect(peekCacheSync).toHaveBeenCalledWith('questionsCache', 'wk', { clone: false });
    expect(mergeWorkerCanonicalQuestionMetadata).toHaveBeenCalledWith(held, listing, mockIdentity);
    expect(jest.mocked(loadWorkerResponses).mock.calls[0][0]).toMatchObject({ account: '', sessionSlug: 'wk' });
    expect(mergeWorkerQuestionResponses).toHaveBeenCalledWith(withQuestions, [], 'wk', mockIdentity);
    expect(result).toEqual({ questionsCache: withAnswers.worker, answersPublic: true });
  });

  it('reads no answers where the session does not show them to everyone', async () => {
    const result = await loadCommunityWorkerQuestions({ sessionSlug: 'wk', sessionConfig: ownOnly });

    expect(loadWorkerResponses).not.toHaveBeenCalled();
    expect(result).toEqual({ questionsCache: withQuestions.worker, answersPublic: false });
  });

  it('keeps the questions where the answers are refused to a reader not signed in', async () => {
    jest.mocked(loadWorkerResponses).mockRejectedValue(new Error('(403) members only'));

    const result = await loadCommunityWorkerQuestions({ sessionSlug: 'wk', sessionConfig: membersOnly });

    expect(result).toEqual({ questionsCache: withQuestions.worker, answersPublic: false });
  });

  it('stops when the read is called off', async () => {
    const controller = new AbortController();
    jest.mocked(loadWorkerResponses).mockImplementation(async () => {
      controller.abort();
      throw new Error('aborted');
    });

    await expect(
      loadCommunityWorkerQuestions({ sessionSlug: 'wk', sessionConfig: publicAnswers, signal: controller.signal }),
    ).rejects.toThrow('aborted');
  });

  it('fails where the questions cannot be read', async () => {
    jest.mocked(loadWorkerCanonicalQuestions).mockRejectedValue(new Error('refused'));

    await expect(loadCommunityWorkerQuestions({ sessionSlug: 'wk', sessionConfig: publicAnswers })).rejects.toThrow(
      'refused',
    );
  });
});

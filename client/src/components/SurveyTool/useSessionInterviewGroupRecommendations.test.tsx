import { act, renderHook, waitFor } from '@testing-library/react';
import {
  buildTokenCacheEnvelope,
  buildTokenCacheKey,
  clearAllTokenCaches,
  writeTokenCache,
} from '../../utilities/worker/workerAuthTokenCache';
import { useSessionInterviewGroupRecommendations } from './useSessionInterviewGroupRecommendations';
import {
  loadInterviewWorkerGroupCandidates,
  recommendInterviewGroups,
  type InterviewGroupRecommendation,
  type InterviewGroupRecommendationResult,
} from './sessionInterviewGroupRecommendations';

jest.mock('./sessionInterviewGroupRecommendations', () => {
  const actual = jest.requireActual<typeof import('./sessionInterviewGroupRecommendations')>(
    './sessionInterviewGroupRecommendations',
  );
  return {
    matchInterviewGroupsByAnswer: actual.matchInterviewGroupsByAnswer,
    matchInterviewGroupsFromPrefill: actual.matchInterviewGroupsFromPrefill,
    readCachedInterviewWorkerToken: actual.readCachedInterviewWorkerToken,
    loadInterviewWorkerGroupCandidates: jest.fn(),
    recommendInterviewGroups: jest.fn(),
  };
});

const sessionConfig = { slug: 'demo', sessionId: `0x${'1'.repeat(32)}` };
const workerUrl = 'https://worker.example';
type HookProps = Parameters<typeof useSessionInterviewGroupRecommendations>[0];

const questions = [
  {
    id: 'q1',
    prompt: 'How do you think about AI governance?',
    type: 'freeform',
    options: [],
  },
];

const request = (requestId: number, transcript: string) => ({
  requestId,
  transcript,
  prefillPacket: null,
  draftResponses: [
    {
      questionId: 'q1',
      answer: transcript,
      additionalComments: `Comment for ${transcript}`,
      evidence: `Evidence for ${transcript}`,
    },
  ],
});

const recommendation = (groupId: string): InterviewGroupRecommendation => ({
  groupId,
  reason: `Reason for ${groupId}`,
  evidence: `Evidence for ${groupId}`,
});

const readyResult = (recommendations: InterviewGroupRecommendation[]): InterviewGroupRecommendationResult => ({
  status: 'ready',
  recommendations,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

describe('useSessionInterviewGroupRecommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(loadInterviewWorkerGroupCandidates).mockResolvedValue({
      status: 'ready',
      source: 'public',
      sessionId: String(sessionConfig.sessionId),
      sessionSlug: 'demo',
      workerUrl,
      candidates: [
        {
          groupId: 'old-group',
          label: 'Old group',
          tags: [],
          joinMode: 'open',
          memberVisibility: 'session',
          requiresAuthentication: true,
          source: 'public',
        },
        {
          groupId: 'new-group',
          label: 'New group',
          tags: [],
          joinMode: 'open',
          memberVisibility: 'session',
          requiresAuthentication: true,
          source: 'public',
        },
      ],
    });
  });

  const pickedNewGroup: HookProps = {
    active: true,
    request: {
      requestId: 1,
      transcript: '',
      prefillPacket: null,
      draftResponses: [{ questionId: 'pick', answer: 'new group' }],
    },
    questions: [
      ...questions,
      { id: 'pick', prompt: 'Which?', type: 'multichoice', options: ['New group'], singleSelect: true },
    ],
    sessionConfig,
    sessionSlug: 'demo',
    workerUrl,
  };
  const choseNewGroup = { groupId: 'new-group', reason: 'You chose “new group”.', evidence: '', confidence: 1 };

  it.each([true, false])('counts the person’s own AI’s group picks only when told to (%s)', async (usePrefillPicks) => {
    jest.mocked(recommendInterviewGroups).mockResolvedValue(readyResult([]));
    // One props object, as the panel passes a request that changes only when its drafts do.
    const props: HookProps = {
      ...pickedNewGroup,
      usePrefillPicks,
      request: {
        ...pickedNewGroup.request!,
        prefillPacket: {
          version: 1,
          sessionSlug: 'demo',
          source: { platform: 'claude', modelId: 'claude-test', verification: 'self_reported' },
          responderContext: {},
          groups: [
            { groupId: 'new-group', reason: 'Already matched by name', confidence: 0.2 },
            { groupId: 'old-group', reason: 'Works on AI policy', confidence: 0.9 },
          ],
        },
      },
    };
    const { result } = renderHook(() => useSessionInterviewGroupRecommendations(props));
    await waitFor(() => expect(result.current.availability).toBe('available'));
    const picked = { groupId: 'old-group', reason: 'Your AI: Works on AI policy', evidence: '', confidence: 0.9 };
    expect(result.current.recommendations).toEqual(usePrefillPicks ? [choseNewGroup, picked] : [choseNewGroup]);
    // The session's AI is asked only about groups nothing else matched; here, none are left.
    expect(recommendInterviewGroups).toHaveBeenCalledTimes(usePrefillPicks ? 0 : 1);
  });

  it('shows the matches that need no AI call while the session’s AI is still at work', async () => {
    const ai = deferred<InterviewGroupRecommendationResult>();
    jest.mocked(recommendInterviewGroups).mockReturnValue(ai.promise);
    const { result } = renderHook(() => useSessionInterviewGroupRecommendations(pickedNewGroup));
    await waitFor(() => expect(result.current.recommendations).toEqual([choseNewGroup]));
    expect(result.current.availability).toBe('loading');
    await act(async () => {
      ai.resolve(readyResult([recommendation('old-group')]));
    });
    expect(result.current).toEqual({
      availability: 'available',
      recommendations: [choseNewGroup, recommendation('old-group')],
    });
  });

  it('lists groups with a signed-in person’s saved Worker sign-in, never asking for one', async () => {
    jest.mocked(recommendInterviewGroups).mockResolvedValue(readyResult([]));
    const address = '0x0000000000000000000000000000000000000001';
    writeTokenCache(
      buildTokenCacheKey({ workerUrl, slug: 'demo', sessionId: String(sessionConfig.sessionId), address }),
      buildTokenCacheEnvelope({
        token: 'saved-token',
        exp: Math.floor(Date.now() / 1000) + 3600,
        workerUrl,
        sessionSlug: 'demo',
        sessionId: String(sessionConfig.sessionId),
        address,
      }),
    );
    try {
      const signedIn: HookProps = { ...pickedNewGroup, account: address };
      const { result } = renderHook(() => useSessionInterviewGroupRecommendations(signedIn));
      await waitFor(() => expect(result.current.availability).toBe('available'));
      expect(loadInterviewWorkerGroupCandidates).toHaveBeenCalledWith(
        expect.objectContaining({ workerToken: 'saved-token' }),
      );
      const signedOut: HookProps = { ...pickedNewGroup, request: { ...pickedNewGroup.request!, requestId: 3 } };
      const other = renderHook(() => useSessionInterviewGroupRecommendations(signedOut));
      await waitFor(() => expect(other.result.current.availability).toBe('available'));
      expect(jest.mocked(loadInterviewWorkerGroupCandidates).mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ workerToken: '' }),
      );
    } finally {
      clearAllTokenCaches();
    }
  });

  it('lists groups through this session’s pending join link, for a signed-out person', async () => {
    jest.mocked(recommendInterviewGroups).mockResolvedValue(readyResult([]));
    sessionStorage.setItem(
      'ce:worker-group-auto-join:v1',
      JSON.stringify({
        version: 1,
        sessionSlug: 'demo',
        groupId: 'salon',
        workerOrigin: workerUrl,
        createdAt: Date.now(),
      }),
    );
    try {
      const { result } = renderHook(() => useSessionInterviewGroupRecommendations(pickedNewGroup));
      await waitFor(() => expect(result.current.availability).toBe('available'));
      expect(loadInterviewWorkerGroupCandidates).toHaveBeenCalledWith(
        expect.objectContaining({ inviteGroupId: 'salon' }),
      );
      // Another session's link shows nothing here.
      const otherProps: HookProps = {
        ...pickedNewGroup,
        sessionSlug: 'other',
        request: { ...pickedNewGroup.request!, requestId: 2 },
      };
      const other = renderHook(() => useSessionInterviewGroupRecommendations(otherProps));
      await waitFor(() => expect(other.result.current.availability).toBe('available'));
      expect(jest.mocked(loadInterviewWorkerGroupCandidates).mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({ sessionSlug: 'other', inviteGroupId: '' }),
      );
    } finally {
      sessionStorage.clear();
    }
  });

  it('suggests a group named like a chosen option first, and asks the AI only about the others', async () => {
    jest.mocked(recommendInterviewGroups).mockResolvedValue(readyResult([recommendation('old-group')]));
    const { result } = renderHook(() => useSessionInterviewGroupRecommendations(pickedNewGroup));
    await waitFor(() => expect(result.current.availability).toBe('available'));
    expect(result.current.recommendations).toEqual([choseNewGroup, recommendation('old-group')]);
    expect(jest.mocked(recommendInterviewGroups).mock.calls[0][0].candidates.map(({ groupId }) => groupId)).toEqual([
      'old-group',
    ]);
  });

  it('still suggests exact matches when the AI suggestions fail or time out', async () => {
    jest
      .mocked(recommendInterviewGroups)
      .mockResolvedValue({ status: 'unavailable', recommendations: [], reason: 'ai_recommendation_failed' });
    const { result } = renderHook(() => useSessionInterviewGroupRecommendations(pickedNewGroup));
    await waitFor(() => expect(result.current.availability).toBe('available'));
    expect(result.current.recommendations).toEqual([choseNewGroup]);
  });

  it('skips the AI when every open group matches a chosen option', async () => {
    const pick = { prompt: 'Which?', type: 'multichoice', options: ['Old group', 'New group'], singleSelect: true };
    const props: HookProps = {
      active: true,
      request: {
        requestId: 1,
        transcript: '',
        prefillPacket: null,
        draftResponses: [
          { questionId: 'a', answer: 'Old group' },
          { questionId: 'b', answer: 'New group' },
        ],
      },
      questions: [
        { ...pick, id: 'a' },
        { ...pick, id: 'b' },
      ],
      sessionConfig,
      sessionSlug: 'demo',
      workerUrl,
    };
    const { result } = renderHook(() => useSessionInterviewGroupRecommendations(props));
    await waitFor(() => expect(result.current.availability).toBe('available'));
    expect(result.current.recommendations.map(({ groupId }) => groupId)).toEqual(['old-group', 'new-group']);
    expect(recommendInterviewGroups).not.toHaveBeenCalled();
  });

  it('keeps one lookup and one AI call while the page re-renders with new config objects', async () => {
    jest.mocked(recommendInterviewGroups).mockResolvedValue(readyResult([recommendation('old-group')]));
    const stableRequest = request(1, 'first');
    const props = (): HookProps => ({
      active: true,
      request: stableRequest,
      questions: questions.map((question) => ({ ...question })),
      sessionConfig: { ...sessionConfig },
      sessionSlug: 'demo',
      workerUrl,
    });
    const { result, rerender } = renderHook(
      (hookProps: HookProps) => useSessionInterviewGroupRecommendations(hookProps),
      {
        initialProps: props(),
      },
    );
    await waitFor(() => expect(result.current.availability).toBe('available'));
    rerender(props());
    rerender(props());
    await act(async () => {});
    expect(loadInterviewWorkerGroupCandidates).toHaveBeenCalledTimes(1);
    expect(recommendInterviewGroups).toHaveBeenCalledTimes(1);
    expect(result.current.recommendations).toEqual([recommendation('old-group')]);
  });

  it('returns no actionable recommendations while a changed request is loading', async () => {
    const firstRecommendation = recommendation('old-group');
    const secondRecommendation = recommendation('new-group');
    const first = deferred<InterviewGroupRecommendationResult>();
    const second = deferred<InterviewGroupRecommendationResult>();
    jest
      .mocked(recommendInterviewGroups)
      .mockImplementation(({ transcript }) => (transcript === 'first' ? first.promise : second.promise));

    const initialProps: HookProps = {
      active: true,
      request: request(1, 'first'),
      questions,
      sessionConfig,
      sessionSlug: 'demo',
      workerUrl,
    };
    const { result, rerender } = renderHook((props: HookProps) => useSessionInterviewGroupRecommendations(props), {
      initialProps,
    });

    await waitFor(() => expect(recommendInterviewGroups).toHaveBeenCalledTimes(1));
    await act(async () => {
      first.resolve(readyResult([firstRecommendation]));
    });
    await waitFor(() =>
      expect(result.current).toEqual({ availability: 'available', recommendations: [firstRecommendation] }),
    );

    rerender({
      active: true,
      request: request(2, 'second'),
      questions,
      sessionConfig,
      sessionSlug: 'demo',
      workerUrl,
    });

    expect(result.current).toEqual({ availability: 'loading', recommendations: [] });
    await waitFor(() => expect(recommendInterviewGroups).toHaveBeenCalledTimes(2));
    await act(async () => {
      second.resolve(readyResult([secondRecommendation]));
    });
    await waitFor(() =>
      expect(result.current).toEqual({ availability: 'available', recommendations: [secondRecommendation] }),
    );

    rerender({
      active: true,
      request: null,
      questions,
      sessionConfig,
      sessionSlug: 'demo',
      workerUrl,
    });

    await waitFor(() => expect(result.current).toEqual({ availability: 'available', recommendations: [] }));

    rerender({
      active: true,
      request: null,
      questions,
      sessionConfig,
      sessionSlug: 'other-session',
      workerUrl,
    });

    await waitFor(() => expect(result.current).toEqual({ availability: 'idle', recommendations: [] }));
  });

  it('reports empty availability when no configured groups are loadable', async () => {
    jest.mocked(loadInterviewWorkerGroupCandidates).mockResolvedValue({
      status: 'ready',
      source: 'public',
      sessionId: String(sessionConfig.sessionId),
      sessionSlug: 'demo',
      workerUrl,
      candidates: [],
    });

    const { result } = renderHook((props: HookProps) => useSessionInterviewGroupRecommendations(props), {
      initialProps: {
        active: true,
        request: request(1, 'first'),
        questions,
        sessionConfig,
        sessionSlug: 'demo',
        workerUrl,
      },
    });

    await waitFor(() => expect(result.current).toEqual({ availability: 'empty', recommendations: [] }));
    expect(recommendInterviewGroups).not.toHaveBeenCalled();
  });
});

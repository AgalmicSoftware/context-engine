import { act, renderHook, waitFor } from '@testing-library/react';
import { useSessionInterviewGroupRecommendations } from './useSessionInterviewGroupRecommendations';
import {
  loadJoinableInterviewGroups,
  type InterviewGroupCandidate,
  type InterviewGroupCandidateLoadResult,
  type SessionInterviewGroupRecommendationRequest,
} from './sessionInterviewGroupRecommendations';

jest.mock('./sessionInterviewGroupRecommendations', () => ({
  ...jest.requireActual<object>('./sessionInterviewGroupRecommendations'),
  loadJoinableInterviewGroups: jest.fn(),
}));

const sessionConfig = { slug: 'demo', sessionId: `0x${'1'.repeat(32)}` };
const workerUrl = 'https://worker.example';
type HookProps = Parameters<typeof useSessionInterviewGroupRecommendations>[0];

const group = (groupId: string, label: string): InterviewGroupCandidate => ({
  groupId,
  label,
  tags: [],
  joinMode: 'open',
  memberVisibility: 'session',
  requiresAuthentication: true,
  source: 'public',
});

const ready = (candidates: InterviewGroupCandidate[]): InterviewGroupCandidateLoadResult => ({
  status: 'ready',
  source: 'public',
  sessionId: sessionConfig.sessionId,
  sessionSlug: 'demo',
  workerUrl,
  candidates,
});

const questions = [
  { id: 'q1', prompt: 'How do you think about AI governance?', type: 'freeform', options: [] },
  { id: 'pick', prompt: 'Which?', type: 'multichoice', options: ['New group'], singleSelect: true },
];

const request = (
  requestId: number,
  overrides: Partial<SessionInterviewGroupRecommendationRequest> = {},
): SessionInterviewGroupRecommendationRequest => ({
  requestId,
  prefillPacket: null,
  draftResponses: [{ questionId: 'pick', answer: 'new group' }],
  draftingPicks: [],
  ...overrides,
});

const props = (overrides: Partial<HookProps> = {}): HookProps => ({
  active: true,
  request: request(1),
  questions,
  sessionConfig,
  sessionSlug: 'demo',
  workerUrl,
  ...overrides,
});

const prefillPacket = (groups: Array<{ groupId: string; reason?: string; confidence?: number }>) => ({
  version: 1 as const,
  sessionSlug: 'demo',
  source: { platform: 'claude' as const, modelId: 'claude-test', verification: 'self_reported' as const },
  responderContext: {},
  groups,
});

const choseNewGroup = { groupId: 'new-group', reason: 'You chose “new group”.', confidence: 1 };

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
    jest
      .mocked(loadJoinableInterviewGroups)
      .mockResolvedValue(
        ready([group('old-group', 'Old group'), group('new-group', 'New group'), group('third', 'Third')]),
      );
  });

  it('lists name matches, then the person’s own AI’s picks, then the session AI’s, each group once', async () => {
    // One props object, as the panel passes a request that changes only when its drafts do.
    const hookProps = props({
      request: request(1, {
        prefillPacket: prefillPacket([
          { groupId: 'new-group', reason: 'Already matched by name', confidence: 0.2 },
          { groupId: 'old-group', reason: 'Works on AI policy', confidence: 0.9 },
        ]),
        draftingPicks: [
          { groupId: 'old-group', reason: 'Their own AI got here first' },
          { groupId: 'third', reason: 'Organises locally', confidence: 0.6 },
          { groupId: 'gone', reason: 'No longer open' },
        ],
      }),
    });
    const { result } = renderHook(() => useSessionInterviewGroupRecommendations(hookProps));
    await waitFor(() => expect(result.current.availability).toBe('available'));
    expect(result.current.recommendations).toEqual([
      choseNewGroup,
      { groupId: 'old-group', reason: 'Your AI: Works on AI policy', confidence: 0.9 },
      { groupId: 'third', reason: 'Organises locally', confidence: 0.6 },
    ]);
  });

  it('suggests only groups named like an answer where the session lets an AI use nothing about people', async () => {
    const hookProps = props({
      sessionConfig: { ...sessionConfig, interviewMode: { joinMatchingGroups: true, groupSuggestionData: [] } },
      request: request(1, {
        prefillPacket: prefillPacket([{ groupId: 'old-group', reason: 'Works on AI policy', confidence: 0.9 }]),
        draftingPicks: [{ groupId: 'third', reason: 'Organises locally' }],
      }),
    });
    const { result } = renderHook(() => useSessionInterviewGroupRecommendations(hookProps));
    await waitFor(() => expect(result.current.availability).toBe('available'));
    expect(result.current.recommendations).toEqual([choseNewGroup]);
  });

  it('lists the groups the signed-in account could join', async () => {
    const address = '0x0000000000000000000000000000000000000001';
    const hookProps = props({ account: address });
    const { result } = renderHook(() => useSessionInterviewGroupRecommendations(hookProps));
    await waitFor(() => expect(result.current.availability).toBe('available'));
    expect(loadJoinableInterviewGroups).toHaveBeenCalledWith({
      sessionConfig,
      sessionSlug: 'demo',
      workerUrl,
      account: address,
    });
  });

  it('keeps one lookup while the page re-renders with new config objects', async () => {
    const stableRequest = request(1);
    const fresh = (): HookProps =>
      props({
        request: stableRequest,
        questions: questions.map((question) => ({ ...question })),
        sessionConfig: { ...sessionConfig },
      });
    const { result, rerender } = renderHook(
      (hookProps: HookProps) => useSessionInterviewGroupRecommendations(hookProps),
      {
        initialProps: fresh(),
      },
    );
    await waitFor(() => expect(result.current.availability).toBe('available'));
    rerender(fresh());
    rerender(fresh());
    await act(async () => {});
    expect(loadJoinableInterviewGroups).toHaveBeenCalledTimes(1);
    expect(result.current.recommendations).toEqual([choseNewGroup]);
  });

  it('returns no actionable recommendations while a changed request is loading', async () => {
    const second = deferred<InterviewGroupCandidateLoadResult>();
    const { result, rerender } = renderHook(
      (hookProps: HookProps) => useSessionInterviewGroupRecommendations(hookProps),
      {
        initialProps: props(),
      },
    );
    await waitFor(() =>
      expect(result.current).toEqual({ availability: 'available', recommendations: [choseNewGroup] }),
    );

    jest.mocked(loadJoinableInterviewGroups).mockReturnValue(second.promise);
    rerender(props({ request: request(2, { draftingPicks: [{ groupId: 'third', reason: 'Organises locally' }] }) }));
    expect(result.current).toEqual({ availability: 'loading', recommendations: [] });
    await act(async () => {
      second.resolve(ready([group('third', 'Third')]));
    });
    await waitFor(() =>
      expect(result.current).toEqual({
        availability: 'available',
        recommendations: [{ groupId: 'third', reason: 'Organises locally' }],
      }),
    );

    rerender(props({ request: null }));
    await waitFor(() => expect(result.current).toEqual({ availability: 'available', recommendations: [] }));
    rerender(props({ request: null, sessionSlug: 'other-session' }));
    await waitFor(() => expect(result.current).toEqual({ availability: 'idle', recommendations: [] }));
  });

  it('reports empty availability when no configured groups are loadable', async () => {
    jest.mocked(loadJoinableInterviewGroups).mockResolvedValue(ready([]));
    const hookProps = props();
    const { result } = renderHook(() => useSessionInterviewGroupRecommendations(hookProps));
    await waitFor(() => expect(result.current).toEqual({ availability: 'empty', recommendations: [] }));
  });
});

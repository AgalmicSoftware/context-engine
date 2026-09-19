import { act, renderHook, waitFor } from '@testing-library/react';
import { useSessionInterviewGroupRecommendations } from './useSessionInterviewGroupRecommendations';
import {
  loadInterviewWorkerGroupCandidates,
  recommendInterviewGroups,
  type InterviewGroupRecommendation,
  type InterviewGroupRecommendationResult,
} from './sessionInterviewGroupRecommendations';

jest.mock('./sessionInterviewGroupRecommendations', () => ({
  loadInterviewWorkerGroupCandidates: jest.fn(),
  recommendInterviewGroups: jest.fn(),
}));

const sessionConfig = { slug: 'demo', sessionId: `0x${'1'.repeat(32)}` };
const workerUrl = 'https://worker.example';
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

  it('returns no actionable recommendations while a changed request is loading', async () => {
    const firstRecommendation = recommendation('old-group');
    const secondRecommendation = recommendation('new-group');
    const first = deferred<InterviewGroupRecommendationResult>();
    const second = deferred<InterviewGroupRecommendationResult>();
    jest.mocked(recommendInterviewGroups).mockImplementation(({ transcript }) =>
      transcript === 'first' ? first.promise : second.promise,
    );

    const { result, rerender } = renderHook((props) => useSessionInterviewGroupRecommendations(props), {
      initialProps: {
        active: true,
        request: request(1, 'first'),
        questions,
        sessionConfig,
        sessionSlug: 'demo',
        workerUrl,
      },
    });

    await waitFor(() => expect(recommendInterviewGroups).toHaveBeenCalledTimes(1));
    await act(async () => {
      first.resolve(readyResult([firstRecommendation]));
    });
    await waitFor(() => expect(result.current).toEqual([firstRecommendation]));

    rerender({
      active: true,
      request: request(2, 'second'),
      questions,
      sessionConfig,
      sessionSlug: 'demo',
      workerUrl,
    });

    expect(result.current).toEqual([]);
    await waitFor(() => expect(recommendInterviewGroups).toHaveBeenCalledTimes(2));
    await act(async () => {
      second.resolve(readyResult([secondRecommendation]));
    });
    await waitFor(() => expect(result.current).toEqual([secondRecommendation]));
  });
});

import { useEffect, useMemo, useRef, useState } from 'react';
import type { InterviewDraftResponse, InterviewPrefillPacket, InterviewQuestion } from './sessionInterview';
import {
  loadInterviewWorkerGroupCandidates,
  recommendInterviewGroups,
  type InterviewGroupRecommendation,
} from './sessionInterviewGroupRecommendations';

export type SessionInterviewGroupRecommendationRequest = {
  requestId: number;
  transcript: string;
  prefillPacket: InterviewPrefillPacket | null;
  draftResponses: InterviewDraftResponse[];
};

type UseSessionInterviewGroupRecommendationsArgs = {
  active: boolean;
  request: SessionInterviewGroupRecommendationRequest | null;
  questions: InterviewQuestion[];
  sessionConfig: unknown;
  sessionSlug?: string;
  workerUrl?: string;
};

export type SessionInterviewGroupRecommendationState = {
  availability: 'idle' | 'loading' | 'available' | 'empty' | 'unsupported' | 'error';
  recommendations: InterviewGroupRecommendation[];
};

const questionPromptById = (questions: InterviewQuestion[]): Map<string, string> =>
  new Map(
    questions
      .map((question) => [String(question.id || ''), String(question.prompt || '').trim()] as const)
      .filter(([questionId, prompt]) => Boolean(questionId && prompt)),
  );

const withQuestionContext = (
  draftResponses: InterviewDraftResponse[],
  questions: InterviewQuestion[],
): InterviewDraftResponse[] => {
  const prompts = questionPromptById(questions);
  return draftResponses.map((draft) => {
    const prompt = prompts.get(draft.questionId);
    if (!prompt) return draft;
    const evidence = String(draft.evidence || '').trim();
    return {
      ...draft,
      evidence: [`Question: ${prompt}`, evidence ? `Evidence: ${evidence}` : ''].filter(Boolean).join('\n'),
    };
  });
};

export function useSessionInterviewGroupRecommendations({
  active,
  request,
  questions,
  sessionConfig,
  sessionSlug = '',
  workerUrl = '',
}: UseSessionInterviewGroupRecommendationsArgs): SessionInterviewGroupRecommendationState {
  const availabilityScopeKey = useMemo(
    () => (active ? [sessionSlug, workerUrl].map((value) => String(value || '')).join('\n') : ''),
    [active, sessionSlug, workerUrl],
  );
  const requestKey = useMemo(
    () =>
      active && request ? [request.requestId, availabilityScopeKey].map((value) => String(value || '')).join('\n') : '',
    [active, availabilityScopeKey, request],
  );
  const [recommendationState, setRecommendationState] = useState<{
    availability: SessionInterviewGroupRecommendationState['availability'];
    key: string;
    scopeKey: string;
    recommendations: InterviewGroupRecommendation[];
  }>({ availability: 'idle', key: '', scopeKey: '', recommendations: [] });
  const requestRef = useRef(0);

  useEffect(() => {
    if (!active || !request || !requestKey) return undefined;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    let canceled = false;

    const load = async () => {
      setRecommendationState({
        availability: 'loading',
        key: requestKey,
        scopeKey: availabilityScopeKey,
        recommendations: [],
      });
      const catalog = await loadInterviewWorkerGroupCandidates({ sessionConfig, sessionSlug, workerUrl });
      if (canceled || requestRef.current !== requestId) return;
      if (catalog.status !== 'ready' || !catalog.candidates.length) {
        setRecommendationState({
          availability:
            catalog.status === 'unsupported' ? 'unsupported' : catalog.status === 'error' ? 'error' : 'empty',
          key: requestKey,
          scopeKey: availabilityScopeKey,
          recommendations: [],
        });
        return;
      }
      const result = await recommendInterviewGroups({
        candidates: catalog.candidates,
        transcript: request.transcript,
        prefillPacket: request.prefillPacket,
        draftResponses: withQuestionContext(request.draftResponses, questions),
        sessionSlug,
        sessionConfig,
        workerUrl,
      });
      if (canceled || requestRef.current !== requestId) return;
      setRecommendationState({
        availability: 'available',
        key: requestKey,
        scopeKey: availabilityScopeKey,
        recommendations: result.status === 'ready' ? result.recommendations : [],
      });
    };

    void load().catch(() => {
      if (!canceled && requestRef.current === requestId)
        setRecommendationState({
          availability: 'error',
          key: requestKey,
          scopeKey: availabilityScopeKey,
          recommendations: [],
        });
    });

    return () => {
      canceled = true;
      requestRef.current += 1;
    };
  }, [active, availabilityScopeKey, questions, request, requestKey, sessionConfig, sessionSlug, workerUrl]);

  useEffect(() => {
    if (!requestKey)
      setRecommendationState((current) => {
        const preserveAvailability = current.scopeKey === availabilityScopeKey && current.availability !== 'loading';
        return {
          availability: preserveAvailability ? current.availability : 'idle',
          key: '',
          scopeKey: availabilityScopeKey,
          recommendations: [],
        };
      });
  }, [availabilityScopeKey, requestKey]);

  if (recommendationState.key !== requestKey || recommendationState.scopeKey !== availabilityScopeKey)
    return { availability: 'idle', recommendations: [] };
  return { availability: recommendationState.availability, recommendations: recommendationState.recommendations };
}

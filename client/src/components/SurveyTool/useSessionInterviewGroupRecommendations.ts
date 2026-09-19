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
}: UseSessionInterviewGroupRecommendationsArgs): InterviewGroupRecommendation[] {
  const requestKey = useMemo(
    () =>
      active && request
        ? [request.requestId, sessionSlug, workerUrl].map((value) => String(value || '')).join('\n')
        : '',
    [active, request, sessionSlug, workerUrl],
  );
  const [recommendationState, setRecommendationState] = useState<{
    key: string;
    recommendations: InterviewGroupRecommendation[];
  }>({ key: '', recommendations: [] });
  const requestRef = useRef(0);

  useEffect(() => {
    if (!active || !request || !requestKey) return undefined;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    let canceled = false;

    const load = async () => {
      const catalog = await loadInterviewWorkerGroupCandidates({ sessionConfig, sessionSlug, workerUrl });
      if (canceled || requestRef.current !== requestId || catalog.status !== 'ready' || !catalog.candidates.length) {
        if (!canceled && requestRef.current === requestId)
          setRecommendationState({ key: requestKey, recommendations: [] });
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
        key: requestKey,
        recommendations: result.status === 'ready' ? result.recommendations : [],
      });
    };

    void load().catch(() => {
      if (!canceled && requestRef.current === requestId)
        setRecommendationState({ key: requestKey, recommendations: [] });
    });

    return () => {
      canceled = true;
      requestRef.current += 1;
    };
  }, [active, questions, request, requestKey, sessionConfig, sessionSlug, workerUrl]);

  useEffect(() => {
    if (!requestKey) setRecommendationState({ key: '', recommendations: [] });
  }, [requestKey]);

  return recommendationState.key === requestKey ? recommendationState.recommendations : [];
}

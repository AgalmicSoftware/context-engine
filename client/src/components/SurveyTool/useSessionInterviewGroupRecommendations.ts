import { useEffect, useMemo, useRef, useState } from 'react';
import type { InterviewDraftResponse, InterviewPrefillPacket, InterviewQuestion } from './sessionInterview';
import {
  groupSuggestionDataFor,
  loadInterviewWorkerGroupCandidates,
  matchInterviewGroupsByAnswer,
  matchInterviewGroupsFromPrefill,
  readCachedInterviewWorkerToken,
  recommendInterviewGroups,
  type InterviewGroupRecommendation,
  type SessionInterviewGroupRecommendationRequest,
} from './sessionInterviewGroupRecommendations';
import { readInterviewInviteGroupId } from './sessionInterviewGroupInvite';

export type { SessionInterviewGroupRecommendationRequest };

type UseSessionInterviewGroupRecommendationsArgs = {
  active: boolean;
  request: SessionInterviewGroupRecommendationRequest | null;
  questions: InterviewQuestion[];
  sessionConfig: unknown;
  sessionSlug?: string;
  workerUrl?: string;
  /** The signed-in account, whose saved Worker sign-in lists the groups it may see. */
  account?: string;
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
  account = '',
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
  // The page can pass new sessionConfig and question objects on every render, so the effect
  // reads the latest ones here; otherwise each re-render would restart the lookup and its AI call.
  const inputsRef = useRef({ questions, sessionConfig, account });
  inputsRef.current = { questions, sessionConfig, account };

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
      const { questions, sessionConfig, account } = inputsRef.current;
      // A saved sign-in lists what that person may see; a join link, what its group's members see.
      const catalog = await loadInterviewWorkerGroupCandidates({
        sessionConfig,
        sessionSlug,
        workerUrl,
        workerToken: readCachedInterviewWorkerToken({ sessionConfig, sessionSlug, workerUrl, account }),
        inviteGroupId: readInterviewInviteGroupId(sessionSlug, workerUrl),
      });
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
      // Groups named like a chosen option come first, then those the person's own AI suggested,
      // without an AI call; the session's AI covers the rest.
      const exact = matchInterviewGroupsByAnswer({
        candidates: catalog.candidates,
        draftResponses: request.draftResponses,
        questions,
      });
      const unmatched = (matches: InterviewGroupRecommendation[]) =>
        catalog.candidates.filter((group) => !matches.some((match) => match.groupId === group.groupId));
      // Where the session lets an AI use nothing about people, only groups named like an answer show.
      const aiMaySuggest = groupSuggestionDataFor(sessionConfig).length > 0;
      const picked = aiMaySuggest
        ? matchInterviewGroupsFromPrefill({ candidates: unmatched(exact), picks: request.prefillPacket?.groups })
        : [];
      const others = aiMaySuggest ? unmatched([...exact, ...picked]) : [];
      // These need no AI call, so they show at once; the session's AI can take up to 30 seconds.
      if (others.length && (exact.length || picked.length))
        setRecommendationState({
          availability: 'loading',
          key: requestKey,
          scopeKey: availabilityScopeKey,
          recommendations: [...exact, ...picked],
        });
      const result = others.length
        ? await recommendInterviewGroups({
            candidates: others,
            transcript: request.transcript,
            prefillPacket: request.prefillPacket,
            draftResponses: withQuestionContext(request.draftResponses, questions),
            sessionSlug,
            sessionConfig,
            workerUrl,
          })
        : null;
      if (canceled || requestRef.current !== requestId) return;
      setRecommendationState({
        availability: 'available',
        key: requestKey,
        scopeKey: availabilityScopeKey,
        recommendations: [...exact, ...picked, ...(result?.status === 'ready' ? result.recommendations : [])],
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
  }, [active, availabilityScopeKey, request, requestKey, sessionSlug, workerUrl]);

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

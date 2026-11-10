import { useEffect, useMemo, useRef, useState } from 'react';
import type { InterviewQuestion } from './sessionInterview';
import {
  groupSuggestionDataFor,
  loadJoinableInterviewGroups,
  matchInterviewGroupsByAnswer,
  matchInterviewGroupsFromPicks,
  type InterviewGroupRecommendation,
  type SessionInterviewGroupRecommendationRequest,
} from './sessionInterviewGroupRecommendations';

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
  // reads the latest ones here; otherwise each re-render would restart the lookup.
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
      const catalog = await loadJoinableInterviewGroups({ sessionConfig, sessionSlug, workerUrl, account });
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
      // Groups named like a chosen option come first, then those the person's own AI picked in its
      // prefill, then those the session's AI picked as it drafted their answers.
      const exact = matchInterviewGroupsByAnswer({
        candidates: catalog.candidates,
        draftResponses: request.draftResponses,
        questions,
      });
      const unmatched = (matches: InterviewGroupRecommendation[]) =>
        catalog.candidates.filter((group) => !matches.some((match) => match.groupId === group.groupId));
      // Where the session lets an AI use nothing about people, only groups named like an answer show.
      const aiMaySuggest = groupSuggestionDataFor(sessionConfig).length > 0;
      const own = aiMaySuggest
        ? matchInterviewGroupsFromPicks({
            candidates: unmatched(exact),
            picks: request.prefillPacket?.groups,
            ownAi: true,
          })
        : [];
      const drafting = aiMaySuggest
        ? matchInterviewGroupsFromPicks({ candidates: unmatched([...exact, ...own]), picks: request.draftingPicks })
        : [];
      setRecommendationState({
        availability: 'available',
        key: requestKey,
        scopeKey: availabilityScopeKey,
        recommendations: [...exact, ...own, ...drafting],
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

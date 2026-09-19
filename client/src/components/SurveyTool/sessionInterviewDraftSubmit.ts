import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { InterviewDraftResponse, InterviewPrefillPacket } from './sessionInterview';

export type InterviewSubmitResult =
  { status: 'submitted' } | { status: 'login-required' } | { status: 'failed' | 'pending' | 'stale'; message?: string };

type SubmitStatusSetter = (status: string) => void;

type RunInterviewDraftSubmitInput = {
  activeSubmitContextToken: string;
  authenticatedForSubmit: boolean;
  baseSubmitContextToken: string;
  drafts: InterviewDraftResponse[];
  editedDrafts: Record<string, InterviewDraftResponse>;
  hasAiPrefill: boolean;
  includePredictionComparison: boolean;
  includeProvenance: boolean;
  includeResponderName: boolean;
  isInterviewBusy: boolean;
  researchAvailable: boolean;
  responderContext: string;
  responseStateReadyForSubmit: boolean;
  selected: Record<string, boolean>;
  transcript: string;
  applyingRef: MutableRefObject<boolean>;
  disposedRef: MutableRefObject<boolean>;
  mappingRef: MutableRefObject<boolean>;
  pendingSubmitActiveContextRef: MutableRefObject<string>;
  pendingSubmitBaseContextRef: MutableRefObject<string>;
  prefillPacket: InterviewPrefillPacket | null;
  isSubmitContextCurrent: (token: string) => boolean;
  onApplyAdditional: (questionId: string, comments: string) => void | Promise<void>;
  onApplyAnswer: (questionId: string, answer: unknown) => void | Promise<void>;
  onApplyConviction: (questionId: string, conviction: number) => void | Promise<void>;
  onApplyImportance: (questionId: string, importance: number) => void | Promise<void>;
  onRecordProvenance?: (
    drafts: InterviewDraftResponse[],
    source: InterviewPrefillPacket['source'] | null,
    packet: InterviewPrefillPacket | null,
    included: boolean,
    includePredictionComparison: boolean,
    responderName: string,
    review?: Array<InterviewDraftResponse & { selected: boolean; original: InterviewDraftResponse }>,
  ) => void | Promise<void>;
  onSubmitResponses?: () => InterviewSubmitResult | Promise<InterviewSubmitResult>;
  onRequestLogin?: () => void;
  setApplying: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setPendingSubmitAfterLogin: Dispatch<SetStateAction<boolean>>;
  setStatus: SubmitStatusSetter;
};

const clearPendingSubmit = ({
  pendingSubmitActiveContextRef,
  pendingSubmitBaseContextRef,
  setPendingSubmitAfterLogin,
}: Pick<
  RunInterviewDraftSubmitInput,
  'pendingSubmitActiveContextRef' | 'pendingSubmitBaseContextRef' | 'setPendingSubmitAfterLogin'
>) => {
  pendingSubmitBaseContextRef.current = '';
  pendingSubmitActiveContextRef.current = '';
  setPendingSubmitAfterLogin(false);
};

export const runInterviewDraftSubmit = async ({
  activeSubmitContextToken,
  authenticatedForSubmit,
  baseSubmitContextToken,
  drafts,
  editedDrafts,
  hasAiPrefill,
  includePredictionComparison,
  includeProvenance,
  includeResponderName,
  isInterviewBusy,
  researchAvailable,
  responderContext,
  responseStateReadyForSubmit,
  selected,
  transcript,
  applyingRef,
  disposedRef,
  mappingRef,
  pendingSubmitActiveContextRef,
  pendingSubmitBaseContextRef,
  prefillPacket,
  isSubmitContextCurrent,
  onApplyAdditional,
  onApplyAnswer,
  onApplyConviction,
  onApplyImportance,
  onRecordProvenance,
  onSubmitResponses,
  onRequestLogin,
  setApplying,
  setError,
  setPendingSubmitAfterLogin,
  setStatus,
}: RunInterviewDraftSubmitInput) => {
  if (applyingRef.current || isInterviewBusy || mappingRef.current) return;
  const applied = drafts.filter((draft) => selected[draft.questionId]);
  if (!applied.length) return;
  applyingRef.current = true;
  const attemptToken = activeSubmitContextToken;
  setApplying(true);
  setError('');

  if (!authenticatedForSubmit) {
    pendingSubmitBaseContextRef.current = baseSubmitContextToken;
    pendingSubmitActiveContextRef.current = '';
    setStatus('Log in to submit…');
    setPendingSubmitAfterLogin(true);
    onRequestLogin?.();
    try {
      await onSubmitResponses?.();
      if (!isSubmitContextCurrent(attemptToken)) return;
    } catch (loginError) {
      if (isSubmitContextCurrent(attemptToken)) {
        clearPendingSubmit({
          pendingSubmitActiveContextRef,
          pendingSubmitBaseContextRef,
          setPendingSubmitAfterLogin,
        });
        setError(loginError instanceof Error ? loginError.message : 'Could not open login. Try again.');
        setStatus('Login required');
      }
    } finally {
      applyingRef.current = false;
      if (!disposedRef.current) setApplying(false);
    }
    return;
  }

  if (!responseStateReadyForSubmit) {
    pendingSubmitBaseContextRef.current = baseSubmitContextToken;
    pendingSubmitActiveContextRef.current = attemptToken;
    setPendingSubmitAfterLogin(true);
    setStatus('Waiting for session data…');
    applyingRef.current = false;
    if (!disposedRef.current) setApplying(false);
    return;
  }

  setStatus('Preparing submission…');
  try {
    for (const original of applied) {
      if (!isSubmitContextCurrent(attemptToken)) return;
      const draft = editedDrafts[original.questionId] || original;
      await onApplyAnswer(draft.questionId, draft.answer);
      if (!isSubmitContextCurrent(attemptToken)) return;
      await onApplyAdditional(draft.questionId, String(draft.additionalComments || ''));
      if (!isSubmitContextCurrent(attemptToken)) return;
      if (draft.importance !== undefined) await onApplyImportance(draft.questionId, draft.importance);
      if (!isSubmitContextCurrent(attemptToken)) return;
      if (draft.conviction !== undefined) await onApplyConviction(draft.questionId, draft.conviction);
      if (!isSubmitContextCurrent(attemptToken)) return;
    }

    if (!isSubmitContextCurrent(attemptToken)) return;
    const directContextSource =
      !prefillPacket && !transcript.trim() && responderContext.trim()
        ? { platform: 'other' as const, modelId: 'direct-user-context', verification: 'self_reported' as const }
        : null;
    await onRecordProvenance?.(
      applied,
      prefillPacket?.source || directContextSource,
      prefillPacket,
      hasAiPrefill && includeProvenance,
      researchAvailable && includePredictionComparison,
      includeResponderName ? String(prefillPacket?.responderContext?.name || '').trim() : '',
      drafts.map((draft) => {
        const reviewed = editedDrafts[draft.questionId] || draft;
        return {
          ...reviewed,
          answer: reviewed.answer,
          additionalComments: String(reviewed.additionalComments || ''),
          original: draft,
          selected: Boolean(selected[draft.questionId]),
        };
      }),
    );

    if (!isSubmitContextCurrent(attemptToken)) return;
    const submitResult = await onSubmitResponses?.();
    if (!isSubmitContextCurrent(attemptToken)) return;
    if (submitResult && typeof submitResult === 'object' && submitResult.status === 'login-required') {
      pendingSubmitBaseContextRef.current = baseSubmitContextToken;
      pendingSubmitActiveContextRef.current = '';
      setPendingSubmitAfterLogin(true);
      setStatus('Log in to submit…');
      return;
    }
    if (!submitResult || typeof submitResult !== 'object' || submitResult.status !== 'submitted') {
      const message =
        submitResult && typeof submitResult === 'object' && 'message' in submitResult
          ? String(submitResult.message || '')
          : '';
      throw new Error(message || 'Could not submit the selected drafts.');
    }
    clearPendingSubmit({
      pendingSubmitActiveContextRef,
      pendingSubmitBaseContextRef,
      setPendingSubmitAfterLogin,
    });
    setStatus('Responses submitted');
  } catch (applyError) {
    if (disposedRef.current) return;
    clearPendingSubmit({
      pendingSubmitActiveContextRef,
      pendingSubmitBaseContextRef,
      setPendingSubmitAfterLogin,
    });
    setError(applyError instanceof Error ? applyError.message : 'Could not apply the selected drafts.');
    setStatus('Draft submission failed');
  } finally {
    applyingRef.current = false;
    if (!disposedRef.current) setApplying(false);
  }
};

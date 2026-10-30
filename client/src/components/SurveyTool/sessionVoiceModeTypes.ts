import type React from 'react';
import type { InterviewQuestionControls } from './SessionInterviewDraftCard';
import type SessionInterviewSuggestions from './SessionInterviewSuggestions';
import type { InterviewSubmitResult } from './sessionInterviewDraftSubmit';
import type { InterviewConsentOverrides } from './sessionInterviewConsent';
import type { InterviewSavedAnswerLoader } from './useInterviewSavedAnswers';
import type { InterviewDraftResponse, InterviewPrefillPacket, SessionVoiceMode } from './sessionInterview';
import type { SessionInterviewModalRecord } from './sessionInterviewModalState';

type InterviewDraftApplicationProps = InterviewQuestionControls & {
  questionCreatorProps?: React.ComponentProps<typeof SessionInterviewSuggestions>['creatorProps'];
  onSubmitResponses?: (questionIds?: string[]) => InterviewSubmitResult | Promise<InterviewSubmitResult>;
  onViewResults?: () => void;
  onClose: () => void;
  onApplyAnswer: (questionId: string, answer: unknown) => void | Promise<void>;
  onApplyAdditional: (questionId: string, comments: string) => void | Promise<void>;
  onApplyImportance: (questionId: string, importance: number) => void | Promise<void>;
  onApplyConviction: (questionId: string, conviction: number) => void | Promise<void>;
  onCaptureResponses?: (questionIds: string[]) => () => void | Promise<void>;
  onRecordProvenance?: (
    drafts: InterviewDraftResponse[],
    source: InterviewPrefillPacket['source'] | null,
    packet: InterviewPrefillPacket | null,
    included: boolean,
    includePredictionComparison: boolean,
    responderName: string,
    review?: Array<InterviewDraftResponse & { selected: boolean; original: InterviewDraftResponse }>,
    consentOverrides?: InterviewConsentOverrides,
  ) => void | Promise<void>;
};

export type SessionInterviewPanelBaseProps = InterviewDraftApplicationProps & {
  sessionSlug?: string;
  sessionConfig?: SessionInterviewModalRecord | null;
  context?: unknown;
  workerUrl?: string;
  existingResponseSlice?: SessionInterviewModalRecord | null;
  pendingInterviewProvenance?: SessionInterviewModalRecord;
  onLoadSavedResponses?: InterviewSavedAnswerLoader;
  prefillPacket?: InterviewPrefillPacket | null;
  initialError?: string;
  account?: unknown;
  provider?: unknown;
  network?: unknown;
  loginComplete?: boolean;
  loginModalToggled?: boolean;
  toggleLoginModal?: (open?: boolean) => void;
  isResponsesCacheReady?: boolean;
  responseReadinessContextToken?: string;
  submitContextToken?: string;
};

export type SessionVoiceModeModalProps = SessionInterviewPanelBaseProps & {
  isOpen: boolean;
  onInterviewProgressChange?: (inProgress: boolean) => void;
  mode: SessionVoiceMode | null;
  onSelectMode: (mode: SessionVoiceMode) => void;
  questionPool?: unknown[];
};

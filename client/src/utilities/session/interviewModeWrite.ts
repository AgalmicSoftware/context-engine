import { DEFAULT_INTERVIEW_SETTINGS } from '../../../../shared/interviewSettings.mjs';
import {
  DEFAULT_REALTIME_INTERVIEW_MODEL,
  isRealtimeInterviewModel,
} from '../../../../shared/realtimeInterviewConfig.mjs';

// Session Workers reject interviewMode keys they do not recognize, and these keys
// are newer than some deployed Workers. Leave each out at its shared default, which readers
// treat the same as a missing key, so other interview settings still save to them.
const NEWER_INTERVIEW_KEYS = [
  'shareDraftChangesByDefault',
  'researchDetail',
  'keepDraftTextForAdmins',
  'hiddenDraftShare',
  'showFidelityScore',
  'suggestGroups',
  'joinMatchingGroups',
  'groupSuggestionData',
  'showFidelityResults',
  'fidelityMinimumPeople',
  'recordingQuestionCount',
  'recordingQuestionTiming',
  'dataNote',
  'voiceSessionContext',
  'questionOrder',
] as const;

export const withoutNewInterviewDefaults = (interviewMode: Record<string, unknown>): Record<string, unknown> => {
  const settings = { ...interviewMode };
  for (const key of NEWER_INTERVIEW_KEYS) {
    if (JSON.stringify(settings[key]) === JSON.stringify(DEFAULT_INTERVIEW_SETTINGS[key])) delete settings[key];
  }
  // The voice model is saved only when it isn't the default, so a session on the
  // default runs each Worker's own: gpt-live-1.1 here, gpt-live-1 on one too old
  // to take it, which would refuse every save while gpt-live-1.1 was stored.
  // A model no Worker takes is dropped too, as interviews already run the default.
  if (
    settings.realtimeModel === DEFAULT_REALTIME_INTERVIEW_MODEL ||
    !isRealtimeInterviewModel(settings.realtimeModel)
  ) {
    delete settings.realtimeModel;
  }
  // Only group suggestions read it, so while they're off it isn't saved, where no one would see it.
  if (settings.joinMatchingGroups !== true) delete settings.groupSuggestionData;
  return settings;
};

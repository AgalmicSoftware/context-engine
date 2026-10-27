// The `mode` query values that open the session voice modal. Kept apart from
// sessionInterview.ts so page routing can read them without the interview code.
export const INTERVIEW_MODE_QUERY_VALUE = 'interview';
export const GROUP_CONVERSATION_MODE_QUERY_VALUE = 'recordGroup';
// Opens the voice modal on its chooser, with no mode picked yet.
export const VOICE_CHOOSER_QUERY_VALUE = 'voice';
// Every `mode` value that opens the voice modal, cleared once the modal closes.
export const SESSION_VOICE_MODE_QUERY_VALUES = [
  INTERVIEW_MODE_QUERY_VALUE,
  GROUP_CONVERSATION_MODE_QUERY_VALUE,
  VOICE_CHOOSER_QUERY_VALUE,
];

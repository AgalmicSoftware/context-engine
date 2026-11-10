// Shared defaults for text tasks; voice and transcription use their own model settings.
// The fast model is also the Worker's fallback for a session that stores no models.
export const DEFAULT_AI_MODEL = 'gpt-6.1-terra';
export const DEFAULT_AI_MODELS = Object.freeze({ fast: DEFAULT_AI_MODEL, thinking: 'gpt-6.1-sol' });
// The Claude model for an Anthropic request that names none.
export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';
// The transcription model new sessions store. A session that stores none has
// always used whisper-1, and Session Workers allow only that for it.
export const DEFAULT_TRANSCRIPTION_MODEL = 'gpt-transcribe';
export const TRANSCRIPTION_FALLBACK_MODEL = 'whisper-1';
// The only OpenAI model that labels speakers, for group recordings. OpenAI shuts
// it down on 2027-02-26 and has named no replacement.
export const GROUP_TRANSCRIPTION_MODEL = 'gpt-4o-transcribe-diarize';

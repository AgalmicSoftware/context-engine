// Shared defaults for text tasks; voice and transcription use their own model settings.
export const DEFAULT_AI_MODEL = 'gpt-5.6-terra';
export const DEFAULT_AI_MODELS = Object.freeze({ fast: DEFAULT_AI_MODEL, thinking: DEFAULT_AI_MODEL });

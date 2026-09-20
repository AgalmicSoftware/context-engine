export const REALTIME_INTERVIEW_PROVIDER: 'openai';
export const DEFAULT_REALTIME_INTERVIEW_MODEL: 'gpt-live-1';
export function isRealtimeInterviewModel(value: unknown): boolean;
export function normalizeRealtimeInterviewModel(value: unknown): string;
export function resolveRealtimeInterviewModel(config?: unknown): string;

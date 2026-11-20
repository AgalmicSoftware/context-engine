export type UserAnalysisResponseFormat = {
  type: 'json_schema';
  json_schema: { name: string; schema: Record<string, unknown>; strict: true };
};
export type UserAnalysisOfCard = { name?: unknown; summary?: unknown; details?: unknown; figure?: unknown; reasoning?: unknown };

export function buildUserAnalysisPrompt(userData: unknown): string;
export const USER_ANALYSIS_RESPONSE_FORMAT: UserAnalysisResponseFormat;
export function buildUserAnalysisCardPrompt(userData: unknown, analysis?: UserAnalysisOfCard): string;
export const USER_ANALYSIS_CARD_RESPONSE_FORMAT: UserAnalysisResponseFormat;

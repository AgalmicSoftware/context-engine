import type { SessionContextPromptSource } from './sessionContextText.mjs';

export type SessionAgentStyle = 'general' | 'detailed';

/** Who an audience is: rules the Session Worker judges as it does a file's. */
export type SessionAgentCondition =
  | { kind: 'worker_role'; role: 'admin' }
  /** Anyone signed in to the session. */
  | { kind: 'agent_grant_scope'; scope: 'ai' }
  /** Members of any of these groups. */
  | { kind: 'worker_group'; groupIds: string[] }
  | { kind: 'sbt_onchain'; chainId: number; contract: string; anyOrAll: 'any' | 'all' };

export type SessionAgentAudience = {
  who: { match: 'any' | 'all'; conditions: SessionAgentCondition[] };
  answers: SessionAgentStyle;
};

/** In order: the first audience a person matches sets how they are answered. */
export type SessionAgentSetting = {
  audiences: SessionAgentAudience[];
  instructions?: Partial<Record<SessionAgentStyle, string>>;
};

export type SessionAgentError = { path: string; message: string };

/** One member's answer to a question: the options they chose, and what they wrote. */
export type SessionAgentMemberAnswer = { choices?: string[]; text?: string };

/** Only what this person's style may read; answers carry no names. */
export type SessionAgentMaterial = {
  sessionContext?: unknown;
  sources?: SessionContextPromptSource[];
  results?: string;
  /** `scale` says what a rating question's numbers mean. */
  answers?: Array<{ question: string; scale?: string; answers: SessionAgentMemberAnswer[] }>;
};

export const SESSION_AGENT_STYLES: readonly SessionAgentStyle[];
export const SESSION_AGENT_LIMITS: Readonly<{
  audiences: number;
  conditions: number;
  groupIds: number;
  instructionsChars: number;
  questionChars: number;
  answerWords: number;
  answerChars: number;
  contextChars: number;
  resultsChars: number;
  answersChars: number;
  answerItemChars: number;
  countedChoices: number;
  choiceChars: number;
  scaleChars: number;
}>;
export const SESSION_AGENT_DEFAULT_INSTRUCTIONS: Readonly<Record<SessionAgentStyle, string>>;
/** Sent after the instructions on every question; no setting removes them. */
export const SESSION_AGENT_RULES: readonly string[];

/** For writers: refuses anything but the stored form's fields and values; null is off. */
export function validateSessionAgent(
  value: unknown,
): { ok: true; value: SessionAgentSetting | null; errors: [] } | { ok: false; errors: SessionAgentError[] };

/** For readers: the stored setting, or null when it is off or not valid. */
export function sessionAgentSettingOf(value: unknown): SessionAgentSetting | null;

/** The instructions a style is sent: the admin's, or the default. */
export function sessionAgentInstructions(setting: SessionAgentSetting | null | undefined, style: SessionAgentStyle): string;

/** The system and user messages for one question, and how much material they carry. */
export function buildSessionAgentMessages(input: {
  setting?: SessionAgentSetting | null;
  style: SessionAgentStyle;
  question: string;
  material?: SessionAgentMaterial;
  /** Orders what members wrote; Math.random unless given. */
  random?: () => number;
}): {
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  read: { context: number; results: boolean; answers: number };
};

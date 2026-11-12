import type { SessionContextPromptSource } from './sessionContextText.mjs';

export type GroupAgentStyle = 'general' | 'detailed';

/** Who an audience is: rules the Session Worker judges as it does a file's. */
export type GroupAgentCondition =
  | { kind: 'worker_role'; role: 'admin' }
  /** Anyone signed in to the session. */
  | { kind: 'agent_grant_scope'; scope: 'ai' }
  /** Members of any of these groups. */
  | { kind: 'worker_group'; groupIds: string[] }
  | { kind: 'sbt_onchain'; chainId: number; contract: string; anyOrAll: 'any' | 'all' };

export type GroupAgentAudience = {
  who: { match: 'any' | 'all'; conditions: GroupAgentCondition[] };
  answers: GroupAgentStyle;
};

/** In order: the first audience a person matches sets how they are answered. */
export type GroupAgentSetting = {
  audiences: GroupAgentAudience[];
  instructions?: Partial<Record<GroupAgentStyle, string>>;
};

export type GroupAgentError = { path: string; message: string };

/** One member's answer to a question: the options they chose, and what they wrote. */
export type GroupAgentMemberAnswer = { choices?: string[]; text?: string };

/** Only what this person's style may read; answers carry no names. */
export type GroupAgentMaterial = {
  sessionContext?: unknown;
  sources?: SessionContextPromptSource[];
  results?: string;
  answers?: Array<{ question: string; answers: GroupAgentMemberAnswer[] }>;
};

export const GROUP_AGENT_STYLES: readonly GroupAgentStyle[];
export const GROUP_AGENT_LIMITS: Readonly<{
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
}>;
export const GROUP_AGENT_DEFAULT_INSTRUCTIONS: Readonly<Record<GroupAgentStyle, string>>;
/** Sent after the instructions on every question; no setting removes them. */
export const GROUP_AGENT_RULES: readonly string[];

/** For writers: refuses anything but the stored form's fields and values; null is off. */
export function validateGroupAgent(
  value: unknown,
): { ok: true; value: GroupAgentSetting | null; errors: [] } | { ok: false; errors: GroupAgentError[] };

/** For readers: the stored setting, or null when it is off or not valid. */
export function groupAgentSettingOf(value: unknown): GroupAgentSetting | null;

/** The instructions a style is sent: the admin's, or the default. */
export function groupAgentInstructions(setting: GroupAgentSetting | null | undefined, style: GroupAgentStyle): string;

/** The system and user messages for one question, and how much material they carry. */
export function buildGroupAgentMessages(input: {
  setting?: GroupAgentSetting | null;
  style: GroupAgentStyle;
  question: string;
  material?: GroupAgentMaterial;
}): {
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  read: { context: number; results: boolean; answers: number };
};

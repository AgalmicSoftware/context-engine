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
  /** Fewest members who must have answered a question for a non-admin to hear from it; 3 unless set, 1 is off. */
  minAnswers?: number;
  /** True lets an asker have a chat stored; absent, nothing asked or answered is kept. */
  history?: true;
  /** False stops people who aren't signed in from asking; absent, they may. */
  anyoneCanAsk?: false;
};

export type SessionAgentError = { path: string; message: string };

/** One member's answer to a question: the options they chose, and what they wrote. */
export type SessionAgentMemberAnswer = { choices?: string[]; text?: string };

/** Only what this person's style may read; answers carry no names. */
export type SessionAgentMaterial = {
  sessionContext?: unknown;
  sources?: SessionContextPromptSource[];
  results?: string;
  /** `scale` says what a rating question's numbers mean; `id` links an answer to its question and is never sent. */
  answers?: Array<{ id?: string; question: string; scale?: string; answers: SessionAgentMemberAnswer[] }>;
  /** The questions the published results cite, for linking an answer that read them. */
  resultsQuestions?: Array<{ id: string; question: string }>;
};

export const SESSION_AGENT_STYLES: readonly SessionAgentStyle[];
export const SESSION_AGENT_LIMITS: Readonly<{
  audiences: number;
  conditions: number;
  groupIds: number;
  instructionsChars: number;
  minAnswers: number;
  questionChars: number;
  nameChars: number;
  answerWords: number;
  answerChars: number;
  contextChars: number;
  contextItemChars: number;
  contextItems: number;
  resultsChars: number;
  answersChars: number;
  answerItemChars: number;
  relatedQuestions: number;
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

/** How many members must have answered a question before someone who is not an admin hears from it. */
export function sessionAgentMinAnswers(setting: SessionAgentSetting | null | undefined): number;

/** Whether someone not signed in may ask, where the session's own rules would let them in. */
export function sessionAgentOpenToAnyone(setting: SessionAgentSetting | null | undefined): boolean;

/** Whether an asker may have an exchange stored in this session. */
export function sessionAgentStoresChats(setting: SessionAgentSetting | null | undefined): boolean;

/** The instructions a style is sent: the admin's, or the default. */
export function sessionAgentInstructions(setting: SessionAgentSetting | null | undefined, style: SessionAgentStyle): string;

/** How much context one question reads: characters in all, per item, and added files and links. */
export type SessionAgentContextLimits = Readonly<{ totalChars: number; itemChars: number; items: number }>;

/** The limits for the provider that answers; a session on Cloudflare's model reads less. */
export function sessionAgentContextLimits(provider?: string): SessionAgentContextLimits;

/** The system and user messages for one question, and how much material they carry. */
export function buildSessionAgentMessages(input: {
  setting?: SessionAgentSetting | null;
  style: SessionAgentStyle;
  question: string;
  material?: SessionAgentMaterial;
  /** Orders what members wrote; Math.random unless given. */
  random?: () => number;
  /** sessionAgentContextLimits for the provider that will answer; the default provider's unless given. */
  context?: SessionAgentContextLimits;
}): {
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  read: { context: number; results: boolean; answers: number };
  /** Context items that didn't fit the block. */
  contextOmitted: number;
  /** Each context item the prompt holds: which link, note or source, by its place in its own list. */
  contextItems: Array<{ part: 'links' | 'notes' | 'sources'; index: number }>;
  /** The questions closest to the one asked, closest first. */
  related: Array<{ id: string; question: string }>;
  /** Whether `related` are questions whose answers the prompt holds, or ones the published results cite. */
  relatedFrom: 'answers' | 'results';
};

import type { InterviewSettings } from './interviewSettings.mjs';
import type { ResultsAnalysisSettings } from './resultsAnalysisSettings.mjs';

export const SESSION_TEMPLATE_FORMAT: 'ce.session-template/v1';
/** Largest template JSON accepted from a paste, an upload or a link, in UTF-8 bytes. */
export const SESSION_TEMPLATE_MAX_BYTES: number;

export type SessionTemplateModel = { provider: string; model: string };

/** A question's portable fields; its ID is derived when it is added to a session. */
export type SessionTemplateQuestion = {
  prompt: string;
  type: 'binary' | 'freeform' | 'rating' | 'multichoice' | 'quadratic';
  tags?: string[];
  /** multichoice and quadratic: at least two, none repeated. */
  options?: string[];
  /** multichoice only. */
  singleSelect?: boolean;
  /** rating only. */
  scale?: { min: number; max: number; minLabel: string; maxLabel: string };
  /** quadratic only. */
  voiceCredits?: number;
};

/** A session setup's portable fields, named as in the setup draft. */
export type SessionTemplate = {
  format: 'ce.session-template/v1';
  /** Links a shared draft to the local draft it came from; '' when unset. */
  draftId: string;
  sessionName: string;
  sessionInfo: string;
  sessionHeader: string;
  sessionEndsAt: string;
  appearance: { colorSchemeId: string };
  sessionContext: { title: string; paragraphs: string[]; links: Array<{ label: string; url: string }> };
  /** Files are listed by name and privacy only, to attach again. */
  contextFiles: Array<{ name: string; adminsOnly?: boolean }>;
  questionsGenPrompt: string;
  /** Added to the session after it is created; at most 200. */
  questions: SessionTemplateQuestion[];
  defaultTags: string;
  defaultGroupTags: string;
  groupCreationPolicy: 'participants' | 'admin_only';
  interviewModeEnabled: boolean;
  interviewMode: InterviewSettings & { realtimeModel: string };
  resultsAnalysis: ResultsAnalysisSettings;
  ai: {
    reasoningEffort: string;
    models: { fast: SessionTemplateModel; thinking: SessionTemplateModel; transcription: SessionTemplateModel };
  };
  /** Shape-checked only; validateSessionModeProfile judges it. null keeps the page's default profile. */
  sessionModeProfile: Record<string, unknown> | null;
};

export type SessionTemplateError = { path: string; message: string };
export type SessionTemplateResult =
  | { ok: true; template: SessionTemplate }
  | { ok: false; errors: SessionTemplateError[] };
export type SessionTemplateChange = { path: string; before: unknown; after: unknown };

/** Rejects unknown fields and secret-shaped text by path; missing fields take defaults. */
export function validateSessionTemplate(value: unknown): SessionTemplateResult;
/** For Import (paste or upload): size cap, JSON, prototype-key check, then validation. */
export function parseSessionTemplateJson(text: unknown): SessionTemplateResult;
/** For Export: picks the portable fields from a setup draft, then validates them. */
export function sessionTemplateFromDraft(draft: unknown): SessionTemplateResult;
/** Changed fields between two validated templates, in field order; lists compare whole. */
export function diffSessionTemplates(before: SessionTemplate, after: SessionTemplate): SessionTemplateChange[];

import type { SessionSetupConflict } from '../../../utilities/session/sessionModeRuleMessages';
import type { SessionModeProfile } from '../../../utilities/session/sessionModeProfile';

export type SetupDraft = Record<string, unknown>;

/** 'create' is /new; 'edit' is a published session's settings page. */
export type SetupMode = 'create' | 'edit';

export type SetupSectionProps = {
  draft: SetupDraft;
  onChange: (path: string[], value: unknown) => void;
  mode: SetupMode;
  open: boolean;
  onToggle: () => void;
  conflicts: SessionSetupConflict[];
};

export type SetupProfileEditor = (mutate: (profile: SessionModeProfile) => void) => void;

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const text = (value: unknown): string =>
  typeof value === 'string' ? value : value == null ? '' : String(value);

export type SetupQuestion = {
  prompt: string;
  type: string;
  tags?: string[];
  options?: string[];
  singleSelect?: boolean;
  scale?: { min: number; max: number; minLabel: string; maxLabel: string };
  voiceCredits?: number;
};

export const SETUP_QUESTION_TYPES = Object.freeze([
  { value: 'binary', label: 'Agree or disagree' },
  { value: 'freeform', label: 'Open answer' },
  { value: 'rating', label: 'Rating' },
  { value: 'multichoice', label: 'Multiple choice' },
  { value: 'quadratic', label: 'Quadratic vote' },
]);

export const setupQuestionTypeLabel = (type: string): string =>
  SETUP_QUESTION_TYPES.find((entry) => entry.value === type)?.label || type;

export const setupQuestionUsesOptions = (type: string): boolean => type === 'multichoice' || type === 'quadratic';

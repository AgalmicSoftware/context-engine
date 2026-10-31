import { normalizeInterviewSettings } from '@ce-shared/interviewSettings.mjs';
import { normalizeResultsAnalysisSettings } from '@ce-shared/resultsAnalysisSettings.mjs';
import {
  WORKER_CANONICAL_SET_CONFIG_KEYS,
  classifySessionConfigEdits,
  type SessionConfigEditClassification,
} from '@ce-shared/sessionConfigEdits.mjs';
import { compileSessionModeProfile, type SessionModeProfile } from '../../../utilities/session/sessionModeProfile';
import { listSessionModeConflicts } from '../../../utilities/session/sessionModeRuleMessages';
import { normalizeSessionAppearance } from '../../../utilities/ui/sessionColorSchemes';
import { withoutNewInterviewDefaults } from '../../../utilities/session/interviewModeWrite';
import { normalizeSessionWizardEndsAt } from '../sessionWizardSessionLifecycle';
import { normalizeSessionStorageProfileConfig } from '../sessionWizardStorageProfile';
import { canonicalizeSessionWizardJson } from '../sessionWizardCanonicalJson';
import { normalizeSessionWizardContext } from '../sessionWizardWriteNormalization';
import { asRecord, text, type SetupDraft } from '../setup/setupSectionTypes';

type Config = Record<string, unknown>;

const SET_CONFIG_KEYS = new Set<string>(WORKER_CANONICAL_SET_CONFIG_KEYS);

// The edit page saves the fields its sections edit (editedValues below), each
// one the Worker's set-config accepts. Slug, session ID, Worker URL and
// authority mode are fixed after publishing; secrets go through Admin.
const same = (left: unknown, right: unknown) =>
  JSON.stringify(canonicalizeSessionWizardJson(left ?? null)) ===
  JSON.stringify(canonicalizeSessionWizardJson(right ?? null));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? null));

/** The session's config in the shape the setup sections edit. */
export const buildSessionSettingsDraft = (config: unknown): SetupDraft => {
  const source = asRecord(config);
  return {
    sessionName: text(source.sessionName),
    sessionInfo: text(source.sessionInfo),
    sessionHeader: text(source.sessionHeaderImg || source.sessionHeader),
    appearance: normalizeSessionAppearance(source.appearance),
    sessionEndsAt: text(source.sessionEndsAt),
    sessionContext: clone(asRecord(source.sessionContext)),
    defaultTags: text(source.defaultTags),
    defaultGroupTags: text(source.defaultGroupTags),
    questionsGenPrompt: text(source.questionsGenPrompt),
    groupCreationPolicy: source.groupCreationPolicy,
    interviewModeEnabled: source.interviewModeEnabled !== false,
    interviewMode: clone(asRecord(source.interviewMode)),
    resultsAnalysis: clone(source.resultsAnalysis ?? null),
    ai: clone(asRecord(source.ai)),
    sessionModeProfile: clone(source.sessionModeProfile ?? null),
  };
};

const trimmed = (value: unknown) => text(value).trim();

// The setup page's publish normalizer; an emptied context is saved empty.
const normalizeContext = (value: unknown) =>
  normalizeSessionWizardContext(value) || { title: '', paragraphs: [], links: [] };

// interviewMode mixes content (the opening and steering prompts) and
// authority fields, so only the sub-fields the person changed move; the rest
// keep the session's stored form and the Worker classifies the same edits.
const nextInterviewMode = (before: unknown, edited: unknown, enabled: boolean): Config => {
  const stored = asRecord(before);
  const was = normalizeInterviewSettings(stored);
  const now = normalizeInterviewSettings(edited);
  const changed: Config = Object.fromEntries(
    Object.entries(now).filter(([key, value]) => !same(value, (was as Config)[key])),
  );
  // The wizard stores the voice switch in both places; keep them in step.
  if ('enabled' in stored && stored.enabled !== enabled) changed.enabled = enabled;
  return withoutNewInterviewDefaults({ ...stored, ...changed });
};

// Each editable field as the Worker would store it once the draft is saved.
const editedValues = (before: Config, draft: SetupDraft, nowMs: number): Config => {
  const values: Config = {
    sessionName: trimmed(draft.sessionName),
    sessionInfo: trimmed(draft.sessionInfo),
    sessionHeaderImg: trimmed(draft.sessionHeader),
    appearance: normalizeSessionAppearance(draft.appearance),
    sessionContext: normalizeContext(draft.sessionContext),
    defaultTags: trimmed(draft.defaultTags),
    defaultGroupTags: trimmed(draft.defaultGroupTags),
    questionsGenPrompt: trimmed(draft.questionsGenPrompt),
    groupCreationPolicy: draft.groupCreationPolicy,
    interviewModeEnabled: draft.interviewModeEnabled !== false,
    interviewMode: nextInterviewMode(before.interviewMode, draft.interviewMode, draft.interviewModeEnabled !== false),
    resultsAnalysis: normalizeResultsAnalysisSettings(draft.resultsAnalysis),
    ai: clone(asRecord(draft.ai)),
    sessionModeProfile: clone(draft.sessionModeProfile ?? null),
  };
  // A cleared end time is sent as '' so the stored one goes; an unchanged one is left alone.
  if (trimmed(draft.sessionEndsAt) !== trimmed(before.sessionEndsAt)) {
    values.sessionEndsAt = normalizeSessionWizardEndsAt(draft.sessionEndsAt, { nowMs });
  }
  return values;
};

// An empty stored field and a blank edit are the same setting.
const isBlank = (value: unknown) =>
  value === undefined || value === null || value === '' || (typeof value === 'object' && !Object.keys(value).length);

// The publish normalizer returns null for a context with nothing left in it.
const contextIsBlank = (value: unknown) => !normalizeSessionWizardContext(value);

const unchanged = (key: string, before: unknown, after: unknown) => {
  if (key === 'sessionContext')
    return same(normalizeContext(before), after) || (contextIsBlank(before) && contextIsBlank(after));
  if (key === 'resultsAnalysis') return same(normalizeResultsAnalysisSettings(before), after);
  if (key === 'appearance') return same(normalizeSessionAppearance(before), after);
  return same(before, after) || (isBlank(before) && isBlank(after));
};

export type SessionSettingsSave = {
  /** The POST /admin/set-config config: changed fields only, each one the Worker accepts. */
  patch: Config;
  /** The session's config as it will be after saving, for the preview. */
  after: Config;
  classification: SessionConfigEditClassification;
};

// Throws a plain message when a field can't be saved as entered (end time).
export const buildSessionSettingsSave = (
  beforeConfig: unknown,
  draft: SetupDraft,
  { nowMs = Date.now() }: { nowMs?: number } = {},
): SessionSettingsSave => {
  const before = asRecord(beforeConfig);
  const values = editedValues(before, draft, nowMs);
  const patch: Config = {};
  Object.entries(values).forEach(([key, value]) => {
    if (!SET_CONFIG_KEYS.has(key) || unchanged(key, before[key], value)) return;
    patch[key] = value;
  });
  // The Worker checks the profile against its storage profile, so they travel together.
  if (patch.sessionModeProfile && !listSessionModeConflicts(patch.sessionModeProfile).length) {
    patch.storageProfile = normalizeSessionStorageProfileConfig(
      compileSessionModeProfile(patch.sessionModeProfile as SessionModeProfile).storageProfile,
    );
    if (same(patch.storageProfile, before.storageProfile)) delete patch.storageProfile;
  }
  const after = { ...before, ...patch };
  return { patch, after, classification: classifySessionConfigEdits(before, after) };
};

// The template fields the edit page applies; slug, Worker and hosting stay.
const TEMPLATE_FIELDS = [
  'sessionName',
  'sessionInfo',
  'sessionHeader',
  'sessionEndsAt',
  'appearance',
  'sessionContext',
  'questionsGenPrompt',
  'defaultTags',
  'defaultGroupTags',
  'groupCreationPolicy',
  'interviewModeEnabled',
  'interviewMode',
  'resultsAnalysis',
  'ai',
  'questions',
] as const;

const authorityOf = (profile: unknown) => text(asRecord(asRecord(profile).authority).mode);

/**
 * A template's portable fields over the edit draft. Its profile is used only
 * when it keeps the session's hosting, which is fixed once published.
 */
export const applyTemplateToSessionSettingsDraft = (
  draft: SetupDraft,
  template: Record<string, unknown>,
): { draft: SetupDraft; keptHosting: boolean } => {
  const next: SetupDraft = { ...draft };
  TEMPLATE_FIELDS.forEach((key) => {
    next[key] = clone(template[key]);
  });
  const profile = template.sessionModeProfile;
  const sameHosting = !!profile && authorityOf(profile) === authorityOf(draft.sessionModeProfile);
  if (sameHosting) next.sessionModeProfile = clone(profile);
  return { draft: next, keptHosting: !!profile && !sameHosting };
};

const LABELS: Record<string, string> = {
  sessionName: 'Name',
  sessionInfo: 'Description',
  sessionContext: 'Context',
  appearance: 'Colors',
  sessionHeaderImg: 'Header image',
  sessionEndsAt: 'End time',
  defaultTags: 'Tag suggestions',
  defaultGroupTags: 'Group tags',
  questionsGenPrompt: 'Question prompt',
  interviewModeEnabled: 'Voice interviews',
  interviewMode: 'Interview settings',
  'interviewMode.openingPrompt': 'Opening question',
  'interviewMode.steeringPrompt': 'Interview guidance',
  groupCreationPolicy: 'Who can create groups',
  resultsAnalysis: 'Results analysis',
  ai: 'AI models',
  sessionModeProfile: 'Access, results and hosting',
  storageProfile: 'Storage access',
};

/** A plain name for an edited config path, such as "Interview settings". */
export const describeSessionSettingsPath = (path: string): string => LABELS[path] || LABELS[path.split('.')[0]] || path;

import { sessionAgentSettingOf, validateSessionAgent } from '@ce-shared/sessionAgent.mjs';
import { normalizeInterviewSettings } from '@ce-shared/interviewSettings.mjs';
import { isRealtimeInterviewModel } from '@ce-shared/realtimeInterviewConfig.mjs';
import { normalizeResultsAnalysisSettings } from '@ce-shared/resultsAnalysisSettings.mjs';
import { normalizeSessionContext } from '@ce-shared/sessionContext.mjs';
import {
  isWorkerGroupMemberCeiling,
  WORKER_GROUP_MEMBER_CEILING_DEFAULT,
  WORKER_GROUP_MEMBER_CEILING_MAX,
  workerOffersGroupJoinChoices,
} from '@ce-shared/workerGroupJoin.mjs';
import {
  CURATED_ID_LIST_KEYS,
  MAX_AGENT_INSTRUCTIONS_CHARS,
  MAX_CURATED_IDS,
  MAX_RESULTS_ADMINS,
  WORKER_CANONICAL_SET_CONFIG_KEYS,
  classifySessionConfigEdits,
  mergeSetConfigAi,
  validAgentInstructions,
  validCuratedIdList,
  validResultsAdminAddresses,
  type SessionConfigEditClassification,
} from '@ce-shared/sessionConfigEdits.mjs';
import {
  DEBATE_ATLAS_FIELD,
  SESSION_AGENT_READY_FIELD,
  MEMBER_RESULTS_FIELD,
  PUBLIC_WORKER_AI_FIELDS,
  SET_CONFIG_MERGES_AI_FIELD,
} from '@ce-shared/workerSessionPublicConfig.mjs';
import { compileSessionModeProfile, type SessionModeProfile } from '../../../utilities/session/sessionModeProfile';
import { listSessionModeConflicts } from '../../../utilities/session/sessionModeRuleMessages';
import { normalizeSessionAppearance } from '../../../utilities/ui/sessionColorSchemes';
import { withoutNewInterviewDefaults } from '../../../utilities/session/interviewModeWrite';
import { resolvePileAutoAdvanceEnabled } from '../../SurveyTool/surveyPileNavigation';
import { normalizeSessionWizardEndsAt } from '../sessionWizardSessionLifecycle';
import { normalizeSessionStorageProfileConfig } from '../sessionWizardStorageProfile';
import { canonicalizeSessionWizardJson } from '../sessionWizardCanonicalJson';
import { resolveSessionCapabilityProjection } from '../../../utilities/session/sessionCapabilityProjection';
import { resolveSessionWizardAutoFeatureBySessionSlug } from '../sessionWizardAiConfig';
import { normalizeSessionWizardContext } from '../sessionWizardWriteNormalization';
import { asRecord, text, type SetupDraft } from '../setup/setupSectionTypes';
import { buildSessionSettingsChainDraft, editedChainValues } from './sessionSettingsChain';

type Config = Record<string, unknown>;

const SET_CONFIG_KEYS = new Set<string>(WORKER_CANONICAL_SET_CONFIG_KEYS);

// The edit page saves the fields its sections edit (editedValues below), each
// one the Worker's set-config accepts. Slug, session ID, Worker URL and
// authority mode are fixed after publishing; secrets go through Admin.
const same = (left: unknown, right: unknown) =>
  JSON.stringify(canonicalizeSessionWizardJson(left ?? null)) ===
  JSON.stringify(canonicalizeSessionWizardJson(right ?? null));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? null));

/** True when the session's Worker merges `ai` on save, so the page may edit it. */
export const workerMergesAi = (config: unknown): boolean => asRecord(config)[SET_CONFIG_MERGES_AI_FIELD] === true;

/** True when the session's Worker builds debate atlases, so it takes a results admin list; older ones refuse it. */
export const workerTakesResultsAdmins = (config: unknown): boolean => asRecord(config)[DEBATE_ATLAS_FIELD] === true;

/** True when the session's Worker shows every answer to signed-in members; older ones refuse that visibility. */
export const workerShowsMemberResults = (config: unknown): boolean => asRecord(config)[MEMBER_RESULTS_FIELD] === true;

/** True when the session's Worker answers the Session Agent; older ones refuse its setting. */
export const workerAnswersSessionAgent = (config: unknown): boolean =>
  asRecord(config)[SESSION_AGENT_READY_FIELD] === true;

const storedResultsAdmins = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((address) => text(address).trim().toLowerCase()).filter(Boolean) : [];

// Lists are edited as text, one item per line (commas work too).
const SBT_LIST_KEYS = ['defaultFeaturedSBTs', 'featured_SBTs_LIST', 'ignored_SBTs_LIST'] as const;
const LIST_KEYS = [...CURATED_ID_LIST_KEYS, ...SBT_LIST_KEYS];
const listItem = (entry: unknown) => text(asRecord(entry).address || entry).trim();
const formatSettingsList = (value: unknown): string =>
  Array.isArray(value) ? value.map(listItem).filter(Boolean).join('\n') : '';
const parseSettingsList = (value: unknown): string[] => {
  const seen = new Set<string>();
  return text(value)
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (!entry || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

// defaultFilterState is a JSON object or a query string such as tag=ai&sort=importance.
const formatFilterState = (value: unknown): string =>
  value == null || value === '' ? '' : typeof value === 'string' ? value : JSON.stringify(value, null, 2);
const parseFilterState = (value: unknown): unknown => {
  const raw = text(value).trim();
  if (!raw) return null;
  if (!raw.startsWith('{') && !raw.startsWith('[')) return raw;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Default filters must be a JSON object or a query such as tag=housing.');
  }
  return parsed;
};

/** The session's config in the shape the setup sections edit. */
export const buildSessionSettingsDraft = (config: unknown): SetupDraft => {
  const source = asRecord(config);
  return {
    sessionName: text(source.sessionName),
    sessionInfo: text(source.sessionInfo),
    sessionHeader: text(source.sessionHeaderImg || source.sessionHeader),
    appearance: normalizeSessionAppearance(source.appearance),
    sessionEndsAt: text(source.sessionEndsAt),
    // Read leniently: what a writer would refuse is left out, so it is never resent.
    sessionContext: normalizeSessionContext(source.sessionContext),
    defaultTags: text(source.defaultTags),
    defaultGroupTags: text(source.defaultGroupTags),
    groupMemberCeiling: isWorkerGroupMemberCeiling(source.groupMemberCeiling) ? String(source.groupMemberCeiling) : '',
    questionsGenPrompt: text(source.questionsGenPrompt),
    agentInstructions: text(source.agentInstructions),
    groupCreationPolicy: source.groupCreationPolicy,
    contextAdditionPolicy: source.contextAdditionPolicy,
    interviewModeEnabled: source.interviewModeEnabled !== false,
    // Every setting, as an edit writes them, so a setting left alone takes a fresh copy's value.
    interviewMode: { ...normalizeInterviewSettings(source.interviewMode), ...clone(asRecord(source.interviewMode)) },
    resultsAnalysis: normalizeResultsAnalysisSettings(source.resultsAnalysis),
    ai: clone(asRecord(source.ai)),
    sessionModeProfile: clone(source.sessionModeProfile ?? null),
    pileAutoAdvanceEnabled: resolvePileAutoAdvanceEnabled(source),
    feedbackEnabled: source.feedbackEnabled !== false,
    defaultFilterState: formatFilterState(source.defaultFilterState),
    defaultSbtTags: text(source.defaultSbtTags),
    autoFeatureSBTsBySessionSlug: resolveSessionWizardAutoFeatureBySessionSlug(source) !== false,
    lists: Object.fromEntries(LIST_KEYS.map((key) => [key, formatSettingsList(source[key])])),
    resultsAdminAddresses: storedResultsAdmins(source.resultsAdminAddresses),
    // Off is null; a setting a writer would refuse reads as off.
    sessionAgent: sessionAgentSettingOf(source.sessionAgent),
    ...buildSessionSettingsChainDraft(source),
  };
};

const trimmed = (value: unknown) => text(value).trim();

// The setup page's publish normalizer; an emptied context is saved empty.
const normalizeContext = (value: unknown) =>
  normalizeSessionWizardContext(value) || { title: '', paragraphs: [], links: [] };
// The stored context as the draft reads it, so an untouched one is unchanged.
const storedContext = (value: unknown) => {
  const context = normalizeSessionContext(value);
  return context.title || context.html || context.paragraphs.length || context.links.length
    ? context
    : { title: '', paragraphs: [], links: [] };
};

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
  // The voice model sits outside those settings; only a supported one is saved.
  const model = trimmed(asRecord(edited).realtimeModel);
  if (isRealtimeInterviewModel(model) && model !== trimmed(stored.realtimeModel)) changed.realtimeModel = model;
  // The wizard stores the voice switch in both places; keep them in step.
  if ('enabled' in stored && stored.enabled !== enabled) changed.enabled = enabled;
  return withoutNewInterviewDefaults({ ...stored, ...changed });
};

const LIST_LABELS: Record<string, string> = {
  HIGHLIGHTED_QUESTION_IDS: 'Highlighted questions',
  BLOCKED_QUESTION_IDS: 'Hidden questions',
  HIGHLIGHTED_SURVEY_IDS: 'Highlighted surveys',
  BLOCKED_SURVEY_IDS: 'Hidden surveys',
  defaultFeaturedSBTs: 'Featured SBTs',
  featured_SBTs_LIST: 'SBT list: featured',
  ignored_SBTs_LIST: 'SBT list: ignored',
};

// A text field left as it was keeps the stored value, even one this page
// would refuse, so an untouched field never blocks a save.
const editedText = <T>(draftText: unknown, stored: unknown, format: (value: unknown) => string, parse: () => T) =>
  text(draftText) === format(stored) ? stored : parse();

const idList = (before: Config, draft: SetupDraft, key: string) =>
  editedText(asRecord(draft.lists)[key], before[key], formatSettingsList, () => {
    const ids = parseSettingsList(asRecord(draft.lists)[key]);
    if (!validCuratedIdList(ids)) {
      throw new Error(
        `${LIST_LABELS[key]}: up to ${MAX_CURATED_IDS} IDs, one per line, using letters, digits and . _ : - only.`,
      );
    }
    return ids;
  });
const addressList = (before: Config, draft: SetupDraft, key: string) =>
  editedText(asRecord(draft.lists)[key], before[key], formatSettingsList, () => {
    const addresses = parseSettingsList(asRecord(draft.lists)[key]);
    const invalid = addresses.find((address) => !ADDRESS.test(address));
    if (invalid) throw new Error(`${LIST_LABELS[key]}: “${invalid}” is not an address (0x and 40 hex digits).`);
    return addresses;
  });

// Only the parts of ai the admin changed are sent: the Worker merges them
// onto what it stores, keeping parts the public config doesn't show.
const changedAiParts = (before: unknown, edited: unknown): Config => {
  const stored = asRecord(before);
  const draft = asRecord(edited);
  return Object.fromEntries(
    PUBLIC_WORKER_AI_FIELDS.filter((key) => key in draft && !same(draft[key], stored[key])).map((key) => [
      key,
      clone(draft[key]),
    ]),
  );
};

type EditOptions = { nowMs: number; onChain: boolean };

/** True when the draft's profile lets SBTs grant access, so its SBT defaults apply. */
export const usesSbtDefaults = (draft: SetupDraft): boolean =>
  resolveSessionCapabilityProjection({ sessionModeProfile: draft.sessionModeProfile }).usesOnChainSbt;

// Each editable field as the session will store it once the draft is saved.
const editedValues = (before: Config, draft: SetupDraft, { nowMs, onChain }: EditOptions): Config => {
  const values: Config = {
    sessionName: trimmed(draft.sessionName),
    sessionInfo: trimmed(draft.sessionInfo),
    sessionHeaderImg: trimmed(draft.sessionHeader),
    appearance: normalizeSessionAppearance(draft.appearance),
    // A context left as stored isn't checked again, so one saved before a newer
    // rule (such as the secret check) never blocks an unrelated save.
    sessionContext: same(draft.sessionContext, storedContext(before.sessionContext))
      ? storedContext(before.sessionContext)
      : normalizeContext(draft.sessionContext),
    defaultTags: trimmed(draft.defaultTags),
    defaultGroupTags: trimmed(draft.defaultGroupTags),
    questionsGenPrompt: trimmed(draft.questionsGenPrompt),
    groupCreationPolicy: draft.groupCreationPolicy,
    contextAdditionPolicy: draft.contextAdditionPolicy,
    interviewModeEnabled: draft.interviewModeEnabled !== false,
    interviewMode: nextInterviewMode(before.interviewMode, draft.interviewMode, draft.interviewModeEnabled !== false),
    resultsAnalysis: normalizeResultsAnalysisSettings(draft.resultsAnalysis),
    sessionModeProfile: clone(draft.sessionModeProfile ?? null),
    defaultFilterState: editedText(draft.defaultFilterState, before.defaultFilterState, formatFilterState, () =>
      parseFilterState(draft.defaultFilterState),
    ),
  };
  // Workers that merge ai are the first to accept these lists. An older one
  // refuses a save that carries them, so they stay out of its patch.
  if (onChain || workerMergesAi(before)) {
    CURATED_ID_LIST_KEYS.forEach((key) => {
      values[key] = idList(before, draft, key);
    });
  }
  // Only a session on a Session Worker has a Session Agent; null turns it off.
  if (!onChain) {
    const sessionAgent = validateSessionAgent(draft.sessionAgent ?? null);
    if (!sessionAgent.ok) throw new Error(`Session Agent: ${sessionAgent.errors[0].message}`);
    values.sessionAgent = sessionAgent.value;
  }
  if (!onChain && workerTakesResultsAdmins(before)) {
    const resultsAdmins = storedResultsAdmins(draft.resultsAdminAddresses);
    if (!validResultsAdminAddresses(resultsAdmins)) {
      throw new Error(`Results admins: up to ${MAX_RESULTS_ADMINS} different addresses (0x and 40 hex digits).`);
    }
    values.resultsAdminAddresses = resultsAdmins;
  }
  // Worker sessions only, for now: the Worker serves them at /llms.txt.
  if (!onChain) {
    values.agentInstructions = trimmed(draft.agentInstructions);
    if (!validAgentInstructions(values.agentInstructions)) {
      throw new Error(
        `Instructions for AI agents: up to ${MAX_AGENT_INSTRUCTIONS_CHARS.toLocaleString('en-US')} characters.`,
      );
    }
  }
  // Workers with join choices only; older ones refuse it. Blank is the default, sent only to clear a stored limit.
  const ceiling = trimmed(draft.groupMemberCeiling);
  if (!onChain && workerOffersGroupJoinChoices(before) && (ceiling || before.groupMemberCeiling != null)) {
    values.groupMemberCeiling = ceiling ? Number(ceiling) : WORKER_GROUP_MEMBER_CEILING_DEFAULT;
    if (!isWorkerGroupMemberCeiling(values.groupMemberCeiling)) {
      throw new Error(
        `Most members in a group: a whole number from 1 to ${WORKER_GROUP_MEMBER_CEILING_MAX.toLocaleString('en-US')}.`,
      );
    }
  }
  // Pile navigation has a deployment default; only a changed choice is stored.
  if (draft.pileAutoAdvanceEnabled !== resolvePileAutoAdvanceEnabled(before)) {
    values.pileAutoAdvanceEnabled = draft.pileAutoAdvanceEnabled === true;
  }
  // The Feedback box is on unless turned off. Only a changed choice is stored, so a Worker too old to
  // know the setting, whose page never shows it, is sent nothing.
  if (!onChain && (draft.feedbackEnabled !== false) !== (before.feedbackEnabled !== false)) {
    values.feedbackEnabled = draft.feedbackEnabled !== false;
  }
  // A cleared end time is sent as '' so the stored one goes; an unchanged one is left alone.
  if (trimmed(draft.sessionEndsAt) !== trimmed(before.sessionEndsAt)) {
    values.sessionEndsAt = normalizeSessionWizardEndsAt(draft.sessionEndsAt, { nowMs });
  }
  // SBT defaults apply only where SBTs grant access; the Worker refuses them elsewhere.
  if (onChain || usesSbtDefaults(draft)) {
    values.defaultSbtTags = trimmed(draft.defaultSbtTags);
    values.defaultFeaturedSBTs = addressList(before, draft, 'defaultFeaturedSBTs');
    const autoFeature = draft.autoFeatureSBTsBySessionSlug !== false;
    if (autoFeature !== (resolveSessionWizardAutoFeatureBySessionSlug(before) !== false)) {
      values.autoFeatureSBTsBySessionSlug = autoFeature;
    }
  }
  if (onChain) {
    // The metadata document holds all of ai, so it is saved whole.
    values.ai = clone(asRecord(draft.ai));
    values.featured_SBTs_LIST = addressList(before, draft, 'featured_SBTs_LIST');
    values.ignored_SBTs_LIST = addressList(before, draft, 'ignored_SBTs_LIST');
    Object.assign(values, editedChainValues(before, draft));
  } else if (workerMergesAi(before)) {
    const ai = changedAiParts(before.ai, draft.ai);
    if (Object.keys(ai).length) values.ai = ai;
  }
  return values;
};

// An empty stored field and a blank edit are the same setting.
const isBlank = (value: unknown) =>
  value === undefined || value === null || value === '' || (typeof value === 'object' && !Object.keys(value).length);

// Every edit marks a profile `custom`; that label alone is not a change.
const withoutPreset = (profile: unknown) => {
  const { preset: _preset, ...rest } = asRecord(profile);
  return rest;
};

const unchanged = (key: string, before: unknown, after: unknown) => {
  if (key === 'sessionModeProfile') return same(withoutPreset(before), withoutPreset(after));
  if (key === 'sessionContext') return same(storedContext(before), after);
  if (key === 'resultsAnalysis') return same(normalizeResultsAnalysisSettings(before), after);
  if (key === 'appearance') return same(normalizeSessionAppearance(before), after);
  if (key === 'resultsAdminAddresses') return same(storedResultsAdmins(before), after);
  // Voice interviews are on unless turned off.
  if (key === 'interviewModeEnabled') return (before !== false) === after;
  if (key === 'feedbackEnabled') return (before !== false) === after;
  return same(before, after) || (isBlank(before) && isBlank(after));
};

export type SessionSettingsSave = {
  /**
   * The changed fields only. A Worker-hosted session sends them to POST
   * /admin/set-config (each one it accepts); an on-chain session writes them
   * into its metadata.
   */
  patch: Config;
  /** The session's config as it will be after saving, for the preview. */
  after: Config;
  classification: SessionConfigEditClassification;
};

// Throws a plain message when a field can't be saved as entered (end time, lists).
export const buildSessionSettingsSave = (
  beforeConfig: unknown,
  draft: SetupDraft,
  { nowMs = Date.now(), onChain = false }: { nowMs?: number; onChain?: boolean } = {},
): SessionSettingsSave => {
  const before = asRecord(beforeConfig);
  const values = editedValues(before, draft, { nowMs, onChain });
  const patch: Config = {};
  Object.entries(values).forEach(([key, value]) => {
    if ((!onChain && !SET_CONFIG_KEYS.has(key)) || unchanged(key, before[key], value)) return;
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
  if (!onChain && patch.ai) after.ai = mergeSetConfigAi(before.ai, patch.ai);
  return { patch, after, classification: classifySessionConfigEdits(before, after) };
};

// A fresh copy over an edited draft: a field the admin left alone takes the
// fresh value, an edited one stays. Records merge one level down, so editing
// one model keeps a fresh effort.
const rebaseValue = (edited: unknown, base: unknown, fresh: unknown, depth: number): unknown => {
  if (same(edited, base)) return fresh;
  const records = [edited, base, fresh].every((value) => !!value && typeof value === 'object' && !Array.isArray(value));
  if (!records || depth === 0) return edited;
  const [e, b, f] = [edited, base, fresh].map(asRecord);
  return Object.fromEntries(
    [...new Set([...Object.keys(e), ...Object.keys(b), ...Object.keys(f)])]
      .map((key) => [key, rebaseValue(e[key], b[key], f[key], depth - 1)])
      .filter(([, value]) => value !== undefined),
  );
};

/** The draft rebuilt on a fresh config, keeping the admin's edits to the old one. */
export const rebaseSessionSettingsDraft = (draft: SetupDraft, baseConfig: unknown, freshConfig: unknown): SetupDraft =>
  rebaseValue(draft, buildSessionSettingsDraft(baseConfig), buildSessionSettingsDraft(freshConfig), 2) as SetupDraft;

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
  if (sameHosting) {
    // Agent access is fixed on this page, as in its Hosting section.
    const own = asRecord(asRecord(draft.sessionModeProfile).surfaces);
    const kept = clone(asRecord(profile));
    kept.surfaces = { ...asRecord(kept.surfaces), agentHttp: own.agentHttp };
    next.sessionModeProfile = kept;
  }
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
  groupMemberCeiling: 'Most members in a group',
  questionsGenPrompt: 'Question prompt',
  agentInstructions: 'Instructions for AI agents',
  interviewModeEnabled: 'Voice interviews',
  interviewMode: 'Interview settings',
  'interviewMode.openingPrompt': 'Opening question',
  'interviewMode.steeringPrompt': 'Interview guidance',
  groupCreationPolicy: 'Who can create groups',
  contextAdditionPolicy: 'Who can add files to context',
  resultsAnalysis: 'Results analysis',
  resultsAdminAddresses: 'Results admins',
  sessionAgent: 'Session Agent',
  ai: 'AI models and effort',
  sessionModeProfile: 'Access, results and hosting',
  storageProfile: 'Storage access',
  pileAutoAdvanceEnabled: 'Next question after an answer',
  feedbackEnabled: 'Feedback box',
  defaultFilterState: 'Default filters',
  defaultSbtTags: 'SBT tags',
  autoFeatureSBTsBySessionSlug: 'Feature this session’s SBTs',
  contracts: 'Contracts',
  blockLimits: 'Block range',
  faucet: 'Test ETH faucet',
  ...LIST_LABELS,
};

/** A plain name for an edited config path, such as "Interview settings". */
export const describeSessionSettingsPath = (path: string): string => LABELS[path] || LABELS[path.split('.')[0]] || path;

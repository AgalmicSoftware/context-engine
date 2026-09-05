import type { ReactNode } from 'react';
import { t } from '../../utilities/ui/terminology.js';
import {
  isSessionWizardModeHiddenTopLevelField,
  type SessionWizardModeFieldPolicy,
} from './sessionWizardModeFieldPolicy';

type DraftLike = Record<string, unknown>;

export type SessionWizardRenderFieldOptions = {
  forceShow?: boolean;
};

export type SessionWizardRenderField = (
  key: string,
  value: unknown,
  path: string[],
  opts?: SessionWizardRenderFieldOptions,
) => ReactNode;

type SessionWizardFieldVisibilityOptions = {
  forceShow?: boolean;
  key: string;
  path?: string[];
  currentPath?: string[];
  wizardMode?: string;
  modeFieldPolicy?: SessionWizardModeFieldPolicy;
};

const pathKey = (path: string[] = []): string => path.join('.');

const NORMAL_MODE_HIDDEN_TOP_LEVEL_FIELDS = new Set(['slug', 'contracts', 'blockLimits', 'faucet', 'ai', 'lit']);

const HIDDEN_PATHS = new Set([
  'rpc.provider',
  'ai.models.transcription.rpcUrl',
  'rpc.providers.path.rpcUrl',
  'rpc.providers.path.rpcUrlsByChainId',
  'faucet.rpcUrl',
  'faucet.privateKey',
  'faucet.encryptedPrivateKey',
  'interviewMode.enabled',
  'interviewMode.provider',
]);

const TOP_LEVEL_FIELD_ORDER = [
  'networkChainId',
  'slug',
  'sessionName',
  'sessionInfo',
  'appearance',
  'groupCreationPolicy',
  'sessionModeProfile',
  'interviewModeEnabled',
  'interviewMode',
  'sessionHeader',
  'sessionEndsAt',
  'storageProfile',
  'contracts',
  'blockLimits',
  'sponsored',
  'faucet',
  'arweave',
  'ai',
  'litCredentials',
  'defaultTags',
  'defaultGroupTags',
  'defaultSbtTags',
  'defaultFeaturedSBTs',
  'autoFeatureSBTsBySessionSlug',
  'questionsGenPrompt',
  'defaultFilterState',
];

const WORKER_ONLY_DRAFT_FIELDS = new Set(['embeddedDeployHelperEnabled']);

const MORE_OPTIONS_FIELDS = new Set([
  'appearance',
  'interviewModeEnabled',
  'interviewMode',
  'groupCreationPolicy',
  'sessionEndsAt',
  'defaultTags',
  'defaultGroupTags',
  'defaultSbtTags',
  'defaultFeaturedSBTs',
  'autoFeatureSBTsBySessionSlug',
  'questionsGenPrompt',
  'defaultFilterState',
  'sponsoredSbtAddress',
]);

const FIELD_TOOLTIPS: Record<string, string> = {
  slug: 'This becomes the session URL. Leave it unlocked if you want to choose the URL yourself, or lock it to use the generated session ID as a more private link.',
  sessionName: 'The main name people will see for this session across the app.',
  sessionInfo: 'A short description people will see on the session page, cards, and headers.',
  sessionModeProfile:
    'The session mode profile controls authority, storage, identity, authorization, encryption, surfaces, results, and export behavior.',
  interviewModeEnabled:
    'Allow participants to open Interview or Group Conversation from the session microphone. Interview uses the session Worker AI key and remains review-only until normal submission.',
  interviewMode:
    'Configure the realtime voice connection used by Interview mode. The provider is OpenAI for now and can be extended without changing the session link contract.',
  'interviewMode.realtimeModel': 'OpenAI Realtime voice model used for this session. The default is gpt-realtime-2.1.',
  corsWorkerUrl: 'Base URL for the worker (AI, transcription, Arweave uploads, faucet).',
  sessionHeader: 'The banner image for this session. Use an image URL; Arweave-backed sessions can also upload a file.',
  sessionEndsAt:
    'Optional end time for this Cloudflare session. After this timestamp, participant writes stop while existing groups and results remain readable.',
  appearance: "Choose one bundled color scheme for this session's documented accents and chrome.",
  groupCreationPolicy: 'Choose whether every participant or only session admins can create groups.',
  storageProfile: 'Advanced: choose the session-owned storage profile for documents, context, and media payloads.',
  defaultTags:
    'Suggested tags for AI-assisted question tagging. They guide the model, but they do not limit which questions or surveys appear.',
  defaultGroupTags:
    'Suggested tags prefilled when an admin or participant creates a Worker-native Group for this session.',
  defaultSbtTags: `Suggested tags for ${t('sbts')} created from this session. Matching tags are prefilled in the Create ${t('sbt')} flow, and you can still change them.`,
  questionsGenPrompt: 'Extra instructions for the AI when it generates questions for this session.',
  defaultFilterState:
    'Advanced: a saved starting state for the question filter UI. Most sessions can leave this alone unless you want the page to open with a specific preset.',
  defaultFeaturedSBTs: `Manually feature specific ${t('sbtsLower')} for this session. These are surfaced first in ${t('sbt')} selectors and featured session views.`,
  autoFeatureSBTsBySessionSlug: `Automatically show ${t('sbtsLower')} created for this session in featured Groups areas when their metadata points to this session slug. In list scope, this session can also contribute those ${t('sbtsLower')} to the shared featured strip.`,
  sponsoredSbtAddress: `Legacy default ${t('sbt')} gate address. Most sessions should configure Privacy & Access instead.`,
  networkChainId: 'Primary chain id for the session.',
  contracts: 'Contract addresses + chain ids for this session.',
  blockLimits:
    'Optional start and end limits for indexing this session. Use this when the session should only read activity from a certain block range or time window.',
  perMemberSpendLimits: 'Reserved for per-member budgeting by resource.',
  arweave: 'Arweave upload credentials (can be locked).',
  rpc: 'RPC provider settings for reads.',
  faucet: 'Testnet faucet signer config (can be locked).',
  'faucet.rpcUrl': 'RPC endpoint for faucet balance checks + transfers.',
  'faucet.amountEth': 'ETH amount to send for faucet requests.',
  'faucet.balanceThresholdEth': 'Max balance eligible for faucet transfers (ETH string).',
  ai: 'AI provider settings and API keys.',
  litCredentials: 'Lit integration credentials (optional).',
};

const FIELD_LABELS: Record<string, string> = {
  slug: 'URL',
  sessionName: 'Session Name',
  sessionInfo: 'Session Description',
  sessionModeProfile: 'Session Mode',
  interviewModeEnabled: 'Voice interview modes',
  interviewMode: 'Interview voice settings',
  'interviewMode.realtimeModel': 'Realtime voice model',
  corsWorkerUrl: 'Worker URL',
  sessionHeader: 'Header Image',
  sessionEndsAt: 'Session end time',
  appearance: 'Session colors',
  groupCreationPolicy: 'Who can create groups?',
  storageProfile: 'Session Storage',
  defaultTags: 'Default Tag Suggestions',
  defaultGroupTags: 'Default Group Tags',
  defaultFeaturedSBTs: `Default ${t('sbts')}`,
  autoFeatureSBTsBySessionSlug: `Auto-feature Session ${t('sbts')}`,
  sponsoredSbtAddress: `Sponsored ${t('sbt')} Address`,
  contracts: 'Smart Contracts',
  blockLimits: 'Time Limits',
};

// Admin-only lists should move to a post-create admin UI (keep hidden in /new).
export const SESSION_WIZARD_ADMIN_ONLY_FIELDS = new Set([
  'HIGHLIGHTED_QUESTION_IDS',
  'BLOCKED_QUESTION_IDS',
  'HIGHLIGHTED_SURVEY_IDS',
  'BLOCKED_SURVEY_IDS',
  'ignored_SBTs_LIST',
  'featured_SBTs_LIST',
]);

// Future feature: per-member spend limits should stay hidden until enforced per provider.
export const SESSION_WIZARD_HIDDEN_FIELDS = new Set([
  'perMemberSpendLimits',
  'corsWorkerUrl',
  'fieldEditors',
  'sessionInfoEncrypted',
  'networkChainId',
  'rpc',
  'sponsored',
  'arweave',
  'litCredentials',
]);

export const SESSION_WIZARD_ENCRYPTED_FIELD_KEYS = new Set(['encryptedApiKey', 'encryptedJwk', 'encryptedPrivateKey']);

export const getSessionWizardFieldLabel = (keyString: string, key: string): string =>
  FIELD_LABELS[keyString] || FIELD_LABELS[key] || key;

export const getSessionWizardFieldTooltip = (path: string[], value: unknown): string => {
  const keyString = pathKey(path);
  const lastKey = path[path.length - 1];
  if (FIELD_TOOLTIPS[keyString]) return FIELD_TOOLTIPS[keyString];
  if (FIELD_TOOLTIPS[lastKey]) return FIELD_TOOLTIPS[lastKey];
  if (lastKey === 'apiKey') {
    return 'API key for this provider. Lock to store as Lit-encrypted.';
  }
  if (lastKey === 'rpcUrl' || lastKey === 'rpcUrlsByChainId') {
    return 'Private RPC endpoint(s) used by worker deploy and runtime. Credential-bearing URLs stay in worker config and are not published to the session registry.';
  }
  if (lastKey === 'address') return 'Contract address for this resource.';
  if (lastKey === 'chainId') return 'Chain id for this contract or provider.';
  if (Array.isArray(value)) return 'List of values for this setting.';
  if (typeof value === 'boolean') return 'Toggle for this setting.';
  return `Config value for ${keyString}. See docs/session-registry.md for details.`;
};

export const shouldHideSessionWizardField = ({
  forceShow = false,
  key,
  path = [],
  currentPath = [...path, key],
  wizardMode = 'advanced',
  modeFieldPolicy,
}: SessionWizardFieldVisibilityOptions): boolean => {
  if (currentPath.length === 1 && isSessionWizardModeHiddenTopLevelField(currentPath[0], modeFieldPolicy)) {
    return true;
  }
  const keyString = pathKey(currentPath);

  // These legacy faucet values are secret material, so a dedicated guided
  // control must never be able to opt them back into the public draft renderer.
  if (keyString === 'faucet.privateKey' || keyString === 'faucet.encryptedPrivateKey') {
    return true;
  }

  if (SESSION_WIZARD_ENCRYPTED_FIELD_KEYS.has(key)) {
    return true;
  }

  if (forceShow) return false;

  if (path.length === 0 && (SESSION_WIZARD_ADMIN_ONLY_FIELDS.has(key) || SESSION_WIZARD_HIDDEN_FIELDS.has(key))) {
    return true;
  }

  if (key === 'chainId' || key === 'litChain') {
    return true;
  }

  if (HIDDEN_PATHS.has(keyString)) {
    return true;
  }

  if (currentPath.length >= 2 && currentPath[0] === 'ai' && currentPath[1] === 'providers') {
    return true;
  }

  const isNormalMode = wizardMode !== 'advanced';

  if (isNormalMode && path.length === 0 && NORMAL_MODE_HIDDEN_TOP_LEVEL_FIELDS.has(key)) {
    return true;
  }

  return false;
};

export const getSessionWizardOrderedDraftEntries = (
  draft: DraftLike | null | undefined,
  modeFieldPolicy?: SessionWizardModeFieldPolicy,
): Array<[string, unknown]> => {
  const source = draft && typeof draft === 'object' ? draft : {};
  const keys = Object.keys(source).filter(
    (key) =>
      !WORKER_ONLY_DRAFT_FIELDS.has(key) &&
      !(key === 'storageProfile' && source.sessionModeProfile) &&
      !isSessionWizardModeHiddenTopLevelField(key, modeFieldPolicy),
  );
  const orderedKeys = [
    ...TOP_LEVEL_FIELD_ORDER.filter((key) => keys.includes(key)),
    ...keys.filter((key) => !TOP_LEVEL_FIELD_ORDER.includes(key)),
  ];
  return orderedKeys.map((key) => [key, source[key]]);
};

export const splitSessionWizardDraftEntries = (
  orderedDraftEntries: Array<[string, unknown]>,
  isNormalMode: boolean,
): {
  primaryEntries: Array<[string, unknown]>;
  moreOptionsEntries: Array<[string, unknown]>;
} => {
  const moreOptionsEntries = orderedDraftEntries.filter(
    ([key]) => MORE_OPTIONS_FIELDS.has(key) || (isNormalMode && key === 'blockLimits'),
  );

  return {
    primaryEntries: orderedDraftEntries.filter(
      ([key]) => !MORE_OPTIONS_FIELDS.has(key) && !(isNormalMode && key === 'blockLimits'),
    ),
    moreOptionsEntries: [
      ...moreOptionsEntries.filter(([key]) => key !== 'appearance'),
      ...moreOptionsEntries.filter(([key]) => key === 'appearance'),
    ],
  };
};

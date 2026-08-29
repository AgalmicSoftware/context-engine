import { LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH } from './sessionWizardPublishFlow';
import { buildSessionWizardDefaultTemplate } from './sessionWizardDraftState';
import { deepClone } from './sessionWizardCoreUtils';
import type { AnyRecord } from '../shellTypes';

export const LOCAL_WORKER_BUNDLE_BUILD_COMMAND = 'nvm use 20 && npm run worker:bundle';
export const LOCAL_WORKER_BUNDLE_GENERATE_HELP = `Run ${LOCAL_WORKER_BUNDLE_BUILD_COMMAND} from the repo root, then choose ${LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH}.`;
export const LOCAL_WORKER_BUNDLE_OPTIONAL_FALLBACK_HELP = `Optional fallback: ${LOCAL_WORKER_BUNDLE_GENERATE_HELP}`;
export const MANUAL_BUNDLE_URL_OVERRIDE_HELP =
  'Paste a direct worker bundle URL here if the GitHub-hosted asset is temporarily unavailable.';
export const NORMAL_MODE_MISSING_HOSTED_BUNDLE_MESSAGE = `No default hosted worker bundle URL is configured for guided setup. Provide a manual bundle URL or upload a bundle file below. ${LOCAL_WORKER_BUNDLE_OPTIONAL_FALLBACK_HELP}`;
export const NORMAL_MODE_MANUAL_BUNDLE_RETRY_MESSAGE = `Guided setup still defaults to the GitHub-hosted bundle. Retry with a manual bundle URL or upload a bundle file. ${LOCAL_WORKER_BUNDLE_OPTIONAL_FALLBACK_HELP}`;
export const SPONSORED_MANUAL_BUNDLE_RETRY_MESSAGE = `Sponsored publish still defaults to the GitHub-hosted bundle. Retry with a manual bundle URL or upload a bundle file. ${LOCAL_WORKER_BUNDLE_OPTIONAL_FALLBACK_HELP}`;

export const NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED = false;

export const METADATA_FIELD_ORDER = [
  'networkChainId',
  'sessionId',
  'sessionIdHex',
  'slug',
  'sessionName',
  'sessionInfo',
  'appearance',
  'sessionModeProfile',
  'interviewModeEnabled',
  'interviewMode',
  'groupCreationPolicy',
  'sessionHeaderImg',
  'corsWorkerUrl',
  'storageProfile',
  'defaultTags',
  'questionsGenPrompt',
  'defaultSbtTags',
  'defaultFilterState',
  'defaultFeaturedSBTs',
  'autoFeatureSBTsBySessionSlug',
  'HIGHLIGHTED_QUESTION_IDS',
  'BLOCKED_QUESTION_IDS',
  'HIGHLIGHTED_SURVEY_IDS',
  'BLOCKED_SURVEY_IDS',
  'ignored_SBTs_LIST',
  'featured_SBTs_LIST',
  'contracts',
  'blockLimits',
  'faucet',
  'ai',
  'sponsored',
  'lit',
  'litCredentials',
  'perMemberSpendLimits',
  'encryption',
  'encryptedFields',
  'encryptedFieldGates',
  'sessionInfoEncrypted',
  'fieldEditors',
];

export const SESSION_WIZARD_DEFAULT_TEMPLATE: AnyRecord = buildSessionWizardDefaultTemplate();

export const __test__getSessionWizardDefaultAiSettings = (): AnyRecord =>
  deepClone(SESSION_WIZARD_DEFAULT_TEMPLATE.ai || {});

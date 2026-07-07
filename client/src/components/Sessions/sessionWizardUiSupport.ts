import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { toStr } from '../../utilities/shared/primitives.js';

const SESSION_HEADER_IMAGE_MIME_TO_EXT = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
});

type SessionWizardUiRecord = Record<string, unknown>;

type SessionWizardReduxStoreLike = SessionWizardUiRecord & {
  getState?: () => unknown;
};

type SessionWizardFileLike = SessionWizardUiRecord & {
  name?: unknown;
  type?: unknown;
};

const isUiRecord = (value: unknown): value is SessionWizardUiRecord => value !== null && typeof value === 'object';

export const readSessionWizardTooltipsEnabled = (reduxStore: unknown): boolean => {
  const store = isUiRecord(reduxStore) ? (reduxStore as SessionWizardReduxStoreLike) : null;
  const rawState = store?.getState?.();
  const state = isUiRecord(rawState) ? rawState : {};
  const sessionState = isUiRecord(state.sessionState) ? state.sessionState : {};
  return sessionState.tooltipsEnabled !== false;
};

export const resolveSessionHeaderImageFormat = (
  fileLike: SessionWizardFileLike | File | Blob | null | undefined,
): string => {
  const fileRecord = isUiRecord(fileLike) ? (fileLike as SessionWizardFileLike) : {};
  const fileName = toStr(fileRecord.name).trim().toLowerCase();
  const fromName = fileName.split('.').pop()?.trim() || '';
  if (['png', 'jpg', 'jpeg', 'gif'].includes(fromName)) return fromName;
  const mime = toStr(fileRecord.type).trim().toLowerCase();
  return (SESSION_HEADER_IMAGE_MIME_TO_EXT as Record<string, string>)[mime] || '';
};

export const getSessionWizardSecretFieldTestId = (fieldKey: string): string | undefined => {
  if (fieldKey === 'openaiKey') return E2E_TESTIDS.WIZARD_SECRET_OPENAI_KEY;
  if (fieldKey === 'anthropicKey') return E2E_TESTIDS.WIZARD_SECRET_ANTHROPIC_KEY;
  if (fieldKey === 'openrouterKey') return E2E_TESTIDS.WIZARD_SECRET_OPENROUTER_KEY;
  if (fieldKey === 'arweaveJwk') return E2E_TESTIDS.WIZARD_SECRET_ARWEAVE_JWK;
  if (fieldKey === 'faucetPrivateKey') return E2E_TESTIDS.WIZARD_SECRET_FAUCET_PRIVATE_KEY;
  if (fieldKey === 'litApiBase') return E2E_TESTIDS.WIZARD_SECRET_LIT_API_BASE;
  if (fieldKey === 'litGroupId') return E2E_TESTIDS.WIZARD_SECRET_LIT_GROUP_ID;
  if (fieldKey === 'litPkpId') return E2E_TESTIDS.WIZARD_SECRET_LIT_PKP_ID;
  if (fieldKey === 'litActionCid') return E2E_TESTIDS.WIZARD_SECRET_LIT_ACTION_CID;
  if (fieldKey === 'litAccountApiKey') return E2E_TESTIDS.WIZARD_SECRET_LIT_ACCOUNT_API_KEY;
  if (fieldKey === 'litUsageApiKey') return E2E_TESTIDS.WIZARD_SECRET_LIT_USAGE_API_KEY;
  return undefined;
};

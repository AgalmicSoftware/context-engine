import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { toStr } from '../../utilities/shared/primitives.js';
import type { AnyRecord } from '../shellTypes';

const SESSION_HEADER_IMAGE_MIME_TO_EXT = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
});

export const readSessionWizardTooltipsEnabled = (
  reduxStore: AnyRecord | null | undefined
): boolean => (
  reduxStore?.getState?.()?.sessionState?.tooltipsEnabled !== false
);

export const resolveSessionHeaderImageFormat = (
  fileLike: AnyRecord | File | null | undefined
): string => {
  const fileName = toStr(fileLike?.name).trim().toLowerCase();
  const fromName = fileName.split('.').pop()?.trim() || '';
  if (['png', 'jpg', 'jpeg', 'gif'].includes(fromName)) return fromName;
  const mime = toStr(fileLike?.type).trim().toLowerCase();
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

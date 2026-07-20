import { toStr } from '../../utilities/shared/primitives.js';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl.js';
import { normalizeSlug } from './adminPageHelpers';

export type AdminSecretCard = {
  key: string;
  label: string;
  fields: readonly string[];
};

export type AdminSecretPresenceStatus = 'idle' | 'loading' | 'partial' | 'loaded' | 'error';
export type AdminSecretPresenceMap = Record<string, boolean>;
export type AdminSecretDraftMap = Record<string, unknown>;

export type AdminSecretStatusInput = {
  fields: readonly string[];
  secrets?: AdminSecretDraftMap;
  clearedSecretKeys?: { has?: (key: string) => boolean } | null;
  storedSecretPresence?: AdminSecretPresenceMap | null;
  secretPresenceStatus?: AdminSecretPresenceStatus;
  workerSecretsDirty?: boolean;
};

export type AdminSecretCardStatus = {
  label: string;
  iconLocked: boolean;
};

export const ADMIN_SECRET_CARDS: readonly AdminSecretCard[] = Object.freeze([
  { key: 'ai', label: 'AI', fields: ['openaiKey', 'anthropicKey', 'openrouterKey'] },
  { key: 'rpc', label: 'RPC', fields: ['customRpcUrl', 'customRpcKey'] },
  { key: 'arweave', label: 'Arweave', fields: ['arweaveJwk'] },
  { key: 'faucet', label: 'Faucet', fields: ['faucetPrivateKey'] },
  { key: 'lit', label: 'Lit', fields: ['litAccountApiKey', 'litUsageApiKey'] },
]);

export const buildAdminSecretPresenceTargetKey = ({
  slug,
  workerUrl,
}: {
  slug?: unknown;
  workerUrl?: unknown;
} = {}): string => {
  const normalizedSlug = normalizeSlug(slug);
  const normalizedWorkerUrl = normalizeWorkerUrl(workerUrl);
  return normalizedWorkerUrl ? `${normalizedSlug}\n${normalizedWorkerUrl}` : '';
};

const ADMIN_SECRET_FIELD_LABELS: Record<string, string> = Object.freeze({
  openaiKey: 'OpenAI API key',
  anthropicKey: 'Anthropic API key',
  openrouterKey: 'OpenRouter API key',
  customRpcUrl: 'Custom RPC URL',
  customRpcKey: 'Custom RPC key',
  arweaveJwk: 'Arweave JWK (JSON)',
  faucetPrivateKey: 'Faucet private key',
  litAccountApiKey: 'Lit account API key',
  litUsageApiKey: 'Lit usage API key',
});

export const getAdminSecretFieldLabel = (fieldKey: unknown): string => {
  const key = String(fieldKey);
  return ADMIN_SECRET_FIELD_LABELS[key] || key;
};

export const getAdminSecretFieldInputType = (fieldKey: unknown): 'password' | 'text' | 'textarea' => {
  const key = String(fieldKey);
  if (key === 'arweaveJwk') return 'textarea';
  if (key === 'customRpcUrl') return 'text';
  return 'password';
};

export const getAdminSecretFieldRows = (fieldKey: unknown): number | undefined =>
  getAdminSecretFieldInputType(fieldKey) === 'textarea' ? 3 : undefined;

export const buildAdminSecretRemoveTestId = (fieldKey: unknown): string =>
  `ce-admin-secret-remove-${String(fieldKey)
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()}`;

const fieldHasDraftValue = (secrets: AdminSecretDraftMap | undefined, fieldKey: string): boolean =>
  !!toStr(secrets?.[fieldKey]).trim();

const fieldIsCleared = (clearedSecretKeys: AdminSecretStatusInput['clearedSecretKeys'], fieldKey: string): boolean =>
  !!clearedSecretKeys?.has?.(fieldKey);

const fieldHasStoredPresence = (
  storedSecretPresence: AdminSecretPresenceMap | null | undefined,
  fieldKey: string,
): boolean => storedSecretPresence?.[fieldKey] === true;

const fieldHasPresenceEntry = (
  storedSecretPresence: AdminSecretPresenceMap | null | undefined,
  fieldKey: string,
): boolean => !!storedSecretPresence && Object.prototype.hasOwnProperty.call(storedSecretPresence, fieldKey);

export const normalizeAdminSecretPresence = (value: unknown): AdminSecretPresenceMap => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const out: AdminSecretPresenceMap = {};
  ADMIN_SECRET_CARDS.forEach((card) => {
    card.fields.forEach((fieldKey) => {
      out[fieldKey] = source[fieldKey] === true;
    });
  });
  return out;
};

const normalizePresencePatchValue = (value: unknown): boolean => {
  if (value === true) return true;
  if (value === false || value == null) return false;
  return !!toStr(value).trim();
};

export const normalizeAdminSecretPresencePatch = (value: unknown): AdminSecretPresenceMap => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const out: AdminSecretPresenceMap = {};
  ADMIN_SECRET_CARDS.forEach((card) => {
    card.fields.forEach((fieldKey) => {
      if (Object.prototype.hasOwnProperty.call(source, fieldKey)) {
        out[fieldKey] = normalizePresencePatchValue(source[fieldKey]);
      }
    });
  });
  return out;
};

export const getAdminSecretCardStatus = ({
  fields,
  secrets,
  clearedSecretKeys,
  storedSecretPresence,
  secretPresenceStatus = 'idle',
  workerSecretsDirty = false,
}: AdminSecretStatusInput): AdminSecretCardStatus => {
  if (workerSecretsDirty && fields.some((fieldKey) => fieldHasDraftValue(secrets, fieldKey))) {
    return { label: 'Unsaved draft', iconLocked: true };
  }
  if (fields.some((fieldKey) => fieldIsCleared(clearedSecretKeys, fieldKey))) {
    return { label: 'Will clear on save', iconLocked: true };
  }
  if (secretPresenceStatus === 'loading') return { label: 'Loading', iconLocked: false };
  if (secretPresenceStatus === 'loaded') {
    return fields.some((fieldKey) => fieldHasStoredPresence(storedSecretPresence, fieldKey))
      ? { label: 'Configured', iconLocked: true }
      : { label: 'Empty', iconLocked: false };
  }
  if (secretPresenceStatus === 'partial') {
    if (fields.some((fieldKey) => fieldHasStoredPresence(storedSecretPresence, fieldKey))) {
      return { label: 'Configured', iconLocked: true };
    }
    return fields.every(
      (fieldKey) =>
        fieldHasPresenceEntry(storedSecretPresence, fieldKey) &&
        !fieldHasStoredPresence(storedSecretPresence, fieldKey),
    )
      ? { label: 'Empty', iconLocked: false }
      : { label: 'Unknown', iconLocked: false };
  }
  return { label: 'Unknown', iconLocked: false };
};

export const getAdminSecretFieldStatusLabel = ({
  fieldKey,
  secrets,
  clearedSecretKeys,
  storedSecretPresence,
  secretPresenceStatus = 'idle',
  workerSecretsDirty = false,
}: Omit<AdminSecretStatusInput, 'fields'> & { fieldKey: string }): string => {
  if (workerSecretsDirty && fieldHasDraftValue(secrets, fieldKey)) return 'New value staged';
  if (fieldIsCleared(clearedSecretKeys, fieldKey)) return 'Will clear on save';
  if (secretPresenceStatus === 'loading') return 'Checking stored status';
  if (secretPresenceStatus === 'loaded') {
    return fieldHasStoredPresence(storedSecretPresence, fieldKey) ? 'Stored in worker; hidden' : 'No stored value';
  }
  if (secretPresenceStatus === 'partial') {
    if (!fieldHasPresenceEntry(storedSecretPresence, fieldKey)) return 'Stored status unknown';
    return fieldHasStoredPresence(storedSecretPresence, fieldKey) ? 'Stored in worker; hidden' : 'No stored value';
  }
  if (secretPresenceStatus === 'error') return 'Unable to verify';
  return 'Stored status unknown';
};

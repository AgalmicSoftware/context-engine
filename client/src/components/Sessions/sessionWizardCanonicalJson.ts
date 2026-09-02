import { sha256Utf8 } from '../../utilities/crypto/sha256';

type UnknownRecord = Record<string, unknown>;

export const canonicalizeSessionWizardJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalizeSessionWizardJson);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value as UnknownRecord)
    .sort()
    .reduce<UnknownRecord>((result, key) => {
      const entry = (value as UnknownRecord)[key];
      if (entry !== undefined) result[key] = canonicalizeSessionWizardJson(entry);
      return result;
    }, {});
};

export const fingerprintSessionWizardJson = (namespace: string, value: unknown): string =>
  sha256Utf8(`${namespace}:${JSON.stringify(canonicalizeSessionWizardJson(value))}`);

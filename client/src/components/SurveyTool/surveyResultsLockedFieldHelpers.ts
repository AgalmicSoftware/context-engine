import { stableSerializeSignatureValue } from './surveyResultsHelpers.js';

type SurveyResultsLockedFieldRecord = Record<string, unknown>;

export type SurveyResultsGateRecord = SurveyResultsLockedFieldRecord & {
  address?: unknown;
  gateId?: unknown;
  id?: unknown;
  label?: unknown;
  name?: unknown;
  sbtAddress?: unknown;
  sbtAddresses?: unknown;
  sbts?: unknown;
  title?: unknown;
};

export type SurveyResultsGateEntry = {
  address: string;
  label: string;
};

export type SurveyResultsEncryptedFieldRecord = SurveyResultsLockedFieldRecord & {
  encrypted?: unknown;
  encryptedData?: unknown;
  encryptedEnvelope?: unknown;
  encryptedPortion?: unknown;
  encryptionAudience?: unknown;
  envelope?: unknown;
  isEncrypted?: unknown;
  locked?: unknown;
  payload?: unknown;
  value?: unknown;
  valueEnvelope?: unknown;
};

export type SurveyResultsResponseRecord = SurveyResultsLockedFieldRecord & {
  additional?: SurveyResultsEncryptedFieldRecord | null;
  answer?: SurveyResultsEncryptedFieldRecord | null;
  conviction?: unknown;
  convictionEncrypted?: unknown;
  importance?: unknown;
  importanceEncrypted?: unknown;
  prompt?: unknown;
  questionID?: unknown;
  questionId?: unknown;
  timeStamp?: unknown;
  timestamp?: unknown;
  type?: unknown;
};

export const hasOwn = (obj: unknown, key: PropertyKey): boolean =>
  !!obj && Object.prototype.hasOwnProperty.call(obj, key);

export const normalizeGateSbtEntries = (gate: SurveyResultsGateRecord | null = null): SurveyResultsGateEntry[] => {
  const out: SurveyResultsGateEntry[] = [];
  const seen: Set<string> = new Set();
  const push = (address: unknown, label: unknown = ''): void => {
    const normalizedAddress =
      typeof address === 'string' ? address.trim() : address == null ? '' : String(address).trim();
    if (!normalizedAddress) return;
    const key = normalizedAddress.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      address: normalizedAddress,
      label: typeof label === 'string' ? label.trim() : '',
    });
  };

  if (Array.isArray(gate?.sbts)) {
    gate.sbts.forEach((entry: unknown) => {
      if (typeof entry === 'string') {
        push(entry);
        return;
      }
      const entryRecord = entry as SurveyResultsGateRecord | null | undefined;
      push(
        entryRecord?.address || entryRecord?.sbtAddress || '',
        entryRecord?.label || entryRecord?.name || entryRecord?.title || '',
      );
    });
  }

  if (Array.isArray(gate?.sbtAddresses)) {
    gate.sbtAddresses.forEach((address: unknown) => push(address));
  }
  if (gate?.sbtAddress) push(gate.sbtAddress);

  return out;
};

export const hasEnvelopeShape = (value: unknown): value is SurveyResultsEncryptedFieldRecord => {
  if (!value || typeof value !== 'object') return false;
  return [
    'ciphertext',
    'encryptedString',
    'encryptedData',
    'dataToEncryptHash',
    'accessControlConditions',
    'chain',
    'iv',
    'salt',
  ].some((key) => hasOwn(value, key));
};

export const extractEnvelopeCandidate = (
  field: SurveyResultsEncryptedFieldRecord | null | undefined,
): unknown | null => {
  if (!field || typeof field !== 'object') return null;

  const directEnvelope = field.encryptedPortion || field.envelope || field.encryptedEnvelope || null;
  if (typeof directEnvelope === 'string' && directEnvelope.trim()) return directEnvelope.trim();
  if (directEnvelope && typeof directEnvelope === 'object') return directEnvelope;

  if (field.payload && typeof field.payload === 'object' && hasEnvelopeShape(field.payload)) {
    return field.payload;
  }
  if (field.valueEnvelope && typeof field.valueEnvelope === 'object' && hasEnvelopeShape(field.valueEnvelope)) {
    return field.valueEnvelope;
  }

  if (hasEnvelopeShape(field)) return field;
  return null;
};

export const hasVisibleFieldValue = (field: SurveyResultsEncryptedFieldRecord | null | undefined): boolean => {
  if (!field || typeof field !== 'object' || !hasOwn(field, 'value')) return false;
  if (field.value === '*') return false;
  if (field.value === null || field.value === undefined) return false;
  return true;
};

export const isLockedEncryptedField = (field: SurveyResultsEncryptedFieldRecord | null | undefined): boolean => {
  if (!field || typeof field !== 'object') return false;
  const flaggedLocked = field.locked === true;
  const flaggedEncrypted = field.isEncrypted === true || field.encrypted === true;
  const envelope = extractEnvelopeCandidate(field);
  if (!flaggedLocked && !flaggedEncrypted && !envelope) return false;
  if (flaggedLocked) return true;
  return !hasVisibleFieldValue(field);
};

export const getFieldEncryptionAudience = (field: SurveyResultsEncryptedFieldRecord | null | undefined): string =>
  typeof field === 'object' && field
    ? String(field.encryptionAudience || '')
        .trim()
        .toLowerCase()
    : '';

export const isBannerEligibleLockedField = (field: SurveyResultsEncryptedFieldRecord | null | undefined): boolean =>
  isLockedEncryptedField(field) && getFieldEncryptionAudience(field) !== 'self';

export const normalizeGateText = (value: unknown): string => {
  const raw = (typeof value === 'string' ? value : value == null ? '' : String(value)).trim();
  if (!raw) return '';
  if (/^\[object\s+object\]$/i.test(raw)) return '';
  return raw;
};

export const buildLockedResponseSignature = (response: SurveyResultsResponseRecord = {}): string =>
  stableSerializeSignatureValue({
    questionId: response?.questionID || response?.questionId || '',
    timestamp: response?.timeStamp || response?.timestamp || 0,
    answerHash: response?.answer?.hash || '',
    additionalHash: response?.additional?.hash || '',
    answerValue: response?.answer?.value,
    additionalValue: response?.additional?.value,
    answerEncrypted: response?.answer?.encrypted,
    additionalEncrypted: response?.additional?.encrypted,
    answerEnvelope: extractEnvelopeCandidate(response?.answer),
    additionalEnvelope: extractEnvelopeCandidate(response?.additional),
    importanceEncrypted: response?.importanceEncrypted || '',
    convictionEncrypted: response?.convictionEncrypted || '',
  });

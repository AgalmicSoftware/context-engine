import { ethers } from 'ethers';

import { escapeSbtCsvField } from './sbtCsvExportHelpers';
import { sanitizeSbtClaimIdentityUrl } from './sbtClaimUrlSafety';

type ResolveSbtPagePasswordExportSelectionArgs = {
  adminGeneratedPasswords?: unknown;
  cachedPasswords?: unknown;
  includePreviousPasswords?: unknown;
};
type ResolveSbtPagePasswordExportControlsStateArgs = {
  adminGeneratedPasswordList?: unknown;
  effectiveIncludePreviousPasswords?: unknown;
  onlyCachedPasswords?: unknown;
};
type ResolveSbtPagePasswordInventoryDisplayStateArgs = {
  combinedPasswords?: unknown;
  showNoMoreInvites?: unknown;
  showPasswordGen?: unknown;
};
type SbtPageRandomBytesReader = (length: number) => Uint8Array | number[];
type SbtPageGetRandomValues = (array: Uint8Array) => Uint8Array;
type GenerateSbtPageRandomPasswordsArgs = {
  count?: unknown;
  getRandomValues?: SbtPageGetRandomValues | null;
  randomBytes?: SbtPageRandomBytesReader | null;
};
type BuildSbtPagePasswordExportRowsArgs = {
  baseUrl?: unknown;
  codeLabel?: unknown;
  demoPath?: unknown;
  encodeGroupPassword?: ((code: string) => string) | null;
  isInvite?: unknown;
  passwordsToExport?: unknown;
  sbtAddr?: unknown;
  sbtBasePathValue?: unknown;
};
type BuildSbtPagePasswordInviteLinkArgs = {
  baseUrl?: unknown;
  code?: unknown;
  demoPath?: unknown;
  encodeGroupPassword?: ((code: string) => string) | null;
  isInvite?: unknown;
  sbtAddr?: unknown;
  sbtBasePathValue?: unknown;
};
type SbtPageGroupPasswordCodec = {
  encodeGroupPasswordForUrl?: (value: string) => string;
  normalizeGroupPasswordInput?: (value: unknown) => string;
};
type BuildSbtPagePasswordExportFileArgs = {
  codeLabel?: unknown;
  date?: unknown;
  fileLabel?: unknown;
  format?: unknown;
  rows?: unknown;
  sbtSymbolOrName?: unknown;
};
type SbtPagePasswordExportSelection = {
  adminGeneratedPasswordList: string[];
  cachedPasswordList: string[];
  combinedPasswords: string[];
  effectiveIncludePreviousPasswords: unknown;
  onlyCachedPasswords: boolean;
  passwordsToExport: string[];
};
type SbtPagePasswordExportControlsState = {
  effectiveIncludePreviousPasswordsChecked: boolean;
  renderIncludePreviousCheckbox: boolean;
  showCachedPasswordsIncludedNote: boolean;
};
type SbtPagePasswordInventoryDisplayState = {
  shouldRenderGeneratedPasswordList: boolean;
  shouldRenderNoMoreInvitesEmptyState: boolean;
  shouldRenderPasswordGenerationSection: boolean;
  shouldRenderPreviousPasswordsSection: boolean;
};
export type SbtPagePasswordExportFormat = 'json' | 'csv';
export type SbtPagePasswordExportRow = Record<string, string> & {
  inviteLink: string;
};
export type SbtPagePasswordExportFile = {
  content: string;
  fileName: string;
  mimeType: string;
};

const toSbtPagePasswordStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((entry) => String(entry ?? '')) : [];

export const resolveSbtPagePasswordExportSelection = ({
  adminGeneratedPasswords = [],
  cachedPasswords = [],
  includePreviousPasswords = false,
}: ResolveSbtPagePasswordExportSelectionArgs = {}): SbtPagePasswordExportSelection => {
  const cachedPasswordList = toSbtPagePasswordStringList(cachedPasswords);
  const adminGeneratedPasswordList = toSbtPagePasswordStringList(adminGeneratedPasswords);
  const combinedPasswords = [...cachedPasswordList, ...adminGeneratedPasswordList];
  const onlyCachedPasswords = adminGeneratedPasswordList.length === 0 && combinedPasswords.length > 0;
  const effectiveIncludePreviousPasswords = onlyCachedPasswords ? true : includePreviousPasswords;
  let passwordsToExport: string[];
  if (adminGeneratedPasswordList.length > 0) {
    passwordsToExport = effectiveIncludePreviousPasswords ? combinedPasswords : adminGeneratedPasswordList;
  } else {
    passwordsToExport = combinedPasswords;
  }

  return {
    adminGeneratedPasswordList,
    cachedPasswordList,
    combinedPasswords,
    effectiveIncludePreviousPasswords,
    onlyCachedPasswords,
    passwordsToExport,
  };
};

export const resolveSbtPagePasswordExportControlsState = ({
  adminGeneratedPasswordList = [],
  effectiveIncludePreviousPasswords = false,
  onlyCachedPasswords = false,
}: ResolveSbtPagePasswordExportControlsStateArgs = {}): SbtPagePasswordExportControlsState => {
  const generatedCount = Number((adminGeneratedPasswordList as { length?: unknown })?.length || 0);
  const renderIncludePreviousCheckbox = generatedCount > 0;
  return {
    effectiveIncludePreviousPasswordsChecked: !!effectiveIncludePreviousPasswords,
    renderIncludePreviousCheckbox,
    showCachedPasswordsIncludedNote: !renderIncludePreviousCheckbox && !!onlyCachedPasswords,
  };
};

export const resolveSbtPagePasswordInventoryDisplayState = ({
  combinedPasswords = [],
  showNoMoreInvites = false,
  showPasswordGen = false,
}: ResolveSbtPagePasswordInventoryDisplayStateArgs = {}): SbtPagePasswordInventoryDisplayState => {
  const passwordCount = Number((combinedPasswords as { length?: unknown })?.length || 0);
  const hasPasswords = passwordCount > 0;
  return {
    shouldRenderGeneratedPasswordList: !!showPasswordGen && hasPasswords,
    shouldRenderNoMoreInvitesEmptyState: !!showNoMoreInvites && !hasPasswords,
    shouldRenderPasswordGenerationSection: !!showPasswordGen,
    shouldRenderPreviousPasswordsSection: !!showNoMoreInvites && hasPasswords,
  };
};

export const generateSbtPageRandomPasswords = ({
  count = 0,
  getRandomValues = null,
  randomBytes = ethers.utils.randomBytes,
}: GenerateSbtPageRandomPasswordsArgs = {}): string[] => {
  const targetCount = Number(count || 0);
  if (!Number.isFinite(targetCount) || targetCount <= 0) return [];
  const generated = new Set<string>();
  while (generated.size < targetCount) {
    let arr: Uint8Array | number[];
    if (typeof getRandomValues === 'function') {
      const next = new Uint8Array(16);
      arr = getRandomValues(next);
    } else if (typeof randomBytes === 'function') {
      arr = randomBytes(16);
    } else {
      arr = ethers.utils.randomBytes(16);
    }
    const token = Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    generated.add(token);
  }
  return Array.from(generated);
};

export const encodeSbtPageGroupPasswordForUrl = (
  code: unknown,
  codec: SbtPageGroupPasswordCodec | null | undefined = null,
): string => {
  const normalized =
    typeof codec?.normalizeGroupPasswordInput === 'function'
      ? codec.normalizeGroupPasswordInput(code)
      : String(code ?? '');
  const encoded =
    typeof codec?.encodeGroupPasswordForUrl === 'function' ? codec.encodeGroupPasswordForUrl(normalized) : normalized;
  return String(encoded || '');
};

export const buildSbtPagePasswordInviteLink = ({
  baseUrl = '',
  demoPath = '',
  isInvite = false,
  sbtAddr = '',
  sbtBasePathValue = '',
}: BuildSbtPagePasswordInviteLinkArgs = {}): string => {
  const origin = String(baseUrl || '');
  const routePath = String(demoPath || '');
  const address = String(sbtAddr || '');
  if (isInvite) {
    return `${origin}${routePath}?auto=1&sbt=${encodeURIComponent(address)}`;
  }
  return `${origin}${String(sbtBasePathValue || '')}/${address}`;
};

export const buildSbtPagePasswordExportRows = ({
  baseUrl = '',
  codeLabel = 'password',
  demoPath = '',
  isInvite = false,
  passwordsToExport = [],
  sbtAddr = '',
  sbtBasePathValue = '',
}: BuildSbtPagePasswordExportRowsArgs = {}): SbtPagePasswordExportRow[] => {
  const label = String(codeLabel || 'password');
  return toSbtPagePasswordStringList(passwordsToExport).map((code) => ({
    [label]: code,
    inviteLink: buildSbtPagePasswordInviteLink({
      baseUrl,
      demoPath,
      isInvite,
      sbtAddr,
      sbtBasePathValue,
    }),
  }));
};

export const buildSbtPagePasswordExportFile = ({
  codeLabel = 'password',
  date = '',
  fileLabel = 'passwords',
  format = null,
  rows = [],
  sbtSymbolOrName = 'SBT',
}: BuildSbtPagePasswordExportFileArgs = {}): SbtPagePasswordExportFile | null => {
  const passwordExportFormat: SbtPagePasswordExportFormat | null =
    format === 'json' || format === 'csv' ? format : null;
  if (!passwordExportFormat) return null;

  const exportRows: SbtPagePasswordExportRow[] = Array.isArray(rows)
    ? (rows as SbtPagePasswordExportRow[]).map((row): SbtPagePasswordExportRow => ({
        ...row,
        inviteLink: sanitizeSbtClaimIdentityUrl(row?.inviteLink),
      }))
    : [];
  const label = String(codeLabel || 'password');
  const fileNameBase = String(sbtSymbolOrName || 'SBT');
  const fileSuffix = String(fileLabel || 'passwords');
  const datePart = String(date || '');

  if (passwordExportFormat === 'json') {
    return {
      content: JSON.stringify(exportRows, null, 2),
      fileName: `${fileNameBase}_${fileSuffix}_${datePart}.json`,
      mimeType: 'application/json',
    };
  }

  return {
    content:
      `index,${escapeSbtCsvField(label)},inviteLink\n` +
      exportRows
        .map((item, index) => `${index},${escapeSbtCsvField(item[label])},${escapeSbtCsvField(item.inviteLink)}`)
        .join('\n'),
    fileName: `${fileNameBase}_${fileSuffix}_${datePart}.csv`,
    mimeType: 'text/csv',
  };
};

export const decodeSbtPageJsonDataUri = (uriRaw: unknown): Record<string, unknown> | null => {
  const raw = String(uriRaw || '').trim();
  if (!/^data:application\/json/i.test(raw)) return null;
  const commaIndex = raw.indexOf(',');
  if (commaIndex < 0) return null;
  const header = raw.slice(0, commaIndex).toLowerCase();
  const payload = raw.slice(commaIndex + 1);
  if (!payload) return null;
  let text = '';
  try {
    if (header.includes(';base64')) {
      if (typeof Buffer !== 'undefined') {
        text = Buffer.from(payload, 'base64').toString('utf8');
      } else if (typeof window !== 'undefined' && typeof window.atob === 'function') {
        text = decodeURIComponent(escape(window.atob(payload)));
      }
    } else {
      text = decodeURIComponent(payload);
    }
  } catch (_) {
    return null;
  }
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
};

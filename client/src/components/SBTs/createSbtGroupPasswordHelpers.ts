import { escapeSbtCsvField } from './sbtCsvExportHelpers';

export type CreateSbtPasswordExportFile = {
  content: string;
  fileName: string;
  mimeType: string;
};

type CreateSbtGroupPasswordEncoder = (code: unknown) => unknown;
type CreateSbtGetRandomValues = (array: Uint8Array) => Uint8Array | number[];
type CreateSbtRandomBytes = (length: number) => Uint8Array | number[];
type CreateSbtBytesToNonce = (bytes: Uint8Array | number[]) => string;

const isPlainCreateSbtPasswordObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const buildCreateSbtPasswordExportFile = ({
  autoJoinUrl = '',
  date = '',
  exportFormat = '',
  passwordList = [],
  sbtDistribution = {},
  sbtInviteLinks = [],
  sbtName = '',
  sbtSymbol = '',
}: {
  autoJoinUrl?: unknown;
  date?: unknown;
  exportFormat?: unknown;
  passwordList?: unknown;
  sbtDistribution?: unknown;
  sbtInviteLinks?: unknown;
  sbtName?: unknown;
  sbtSymbol?: unknown;
} = {}): CreateSbtPasswordExportFile => {
  let content = '';
  let fileName = '';
  const distribution = isPlainCreateSbtPasswordObject(sbtDistribution) ? sbtDistribution : {};
  const isInvite = !!(distribution.isLimited && distribution.distributionOption === 'groupPassword');
  const codeLabel = isInvite ? 'groupPassword' : 'password';
  const fileLabel = isInvite ? 'group-passwords' : 'passwords';
  const codes = Array.isArray(passwordList) ? passwordList.map((code: unknown) => String(code || '')) : [];
  const links = Array.isArray(sbtInviteLinks) ? sbtInviteLinks.map((link: unknown) => String(link || '')) : [];
  const fallbackLink = String(autoJoinUrl || '');
  const symbolText = String(sbtSymbol || '');
  const nameText = String(sbtName || '');
  const dateText = String(date || '');

  if (exportFormat === 'json') {
    content = JSON.stringify(
      codes.map((code, index) => ({
        index,
        [codeLabel]: code,
        inviteLink: links[index] || fallbackLink,
      })),
      null,
      2,
    );
    fileName = `${symbolText}_${nameText}_${fileLabel}_${dateText}.json`;
  } else if (exportFormat === 'csv') {
    content =
      `index,${escapeSbtCsvField(codeLabel)},inviteLink\n` +
      codes
        .map((code, index) => `${index},${escapeSbtCsvField(code)},${escapeSbtCsvField(links[index] || fallbackLink)}`)
        .join('\n');
    fileName = `${symbolText}_${nameText}_${fileLabel}_${dateText}.csv`;
  }

  return {
    content,
    fileName,
    mimeType: exportFormat === 'json' ? 'application/json' : 'text/csv',
  };
};

export const buildCreateSbtInviteLinks = ({
  base = '',
  demoPath = '',
  detailPath = '',
  encodeGroupPassword = (code: unknown) => code,
  isInvite = false,
  passwordList = [],
  sbtAddress = '',
}: {
  base?: unknown;
  demoPath?: unknown;
  detailPath?: unknown;
  encodeGroupPassword?: CreateSbtGroupPasswordEncoder | null;
  isInvite?: unknown;
  passwordList?: unknown;
  sbtAddress?: unknown;
} = {}): string[] => {
  const codes = Array.isArray(passwordList) ? passwordList.map((code: unknown) => String(code || '')) : [];
  const origin = String(base || '');
  const routePath = String(demoPath || '');
  const sbtAddressText = String(sbtAddress || '');
  const [detailPathname, detailQuery = ''] = String(detailPath || '').split('?');
  const detailQuerySuffix = detailQuery ? `?${detailQuery}` : '';
  const encoder = typeof encodeGroupPassword === 'function' ? encodeGroupPassword : (code: unknown) => code;

  return codes.map((code) =>
    isInvite
      ? `${origin}${routePath}?auto=1&sbt=${encodeURIComponent(sbtAddressText)}&gp=${encodeURIComponent(String(encoder(code)))}`
      : `${origin}${detailPathname}/${encodeURIComponent(code)}${detailQuerySuffix}`,
  );
};

export const resolveCreateSbtInviteCodeList = ({
  listOverride = null,
  passwordList = [],
}: {
  listOverride?: unknown;
  passwordList?: unknown;
} = {}): string[] => {
  const source =
    Array.isArray(listOverride) && listOverride.length > 0
      ? listOverride
      : Array.isArray(passwordList)
        ? passwordList
        : [];
  return source.map((code: unknown) => String(code || ''));
};

export const resolveCreateSbtPasswordGenerationCount = ({
  numInviteLinks = 0,
  sbtDistribution = {},
}: {
  numInviteLinks?: unknown;
  sbtDistribution?: unknown;
} = {}): number => {
  const distribution = isPlainCreateSbtPasswordObject(sbtDistribution) ? sbtDistribution : {};
  const rawCount =
    distribution.isLimited && Number(distribution.limitedNumber || 0) > 0 ? distribution.limitedNumber : numInviteLinks;
  return Math.max(0, Math.floor(Number(rawCount || 0) || 0));
};

export const resolveCreateSbtPredictablePasswordListDecision = ({
  allowStateMutation = true,
  generatePassword = null,
  passwordList = [],
  targetCount = 0,
  usesClaimCodes = false,
}: {
  allowStateMutation?: unknown;
  generatePassword?: ((length: number) => string) | null;
  passwordList?: unknown;
  targetCount?: unknown;
  usesClaimCodes?: unknown;
} = {}): {
  passwordListPatch: string[] | null;
  returnValue: string[] | null;
  shouldUpdatePasswordList: boolean;
} => {
  if (!usesClaimCodes) {
    return {
      passwordListPatch: null,
      returnValue: [],
      shouldUpdatePasswordList: false,
    };
  }

  const desiredCount = Math.max(0, Math.floor(Number(targetCount || 0) || 0));
  const current = Array.isArray(passwordList)
    ? (passwordList.filter((entry: unknown) => String(entry || '').trim()) as string[])
    : [];
  if (desiredCount > 0 && current.length === desiredCount) {
    return {
      passwordListPatch: null,
      returnValue: current,
      shouldUpdatePasswordList: false,
    };
  }

  const generator = typeof generatePassword === 'function' ? generatePassword : () => '';
  const next = Array.from({ length: desiredCount }, () => generator(32));
  const shouldUpdatePasswordList = allowStateMutation === true;
  return {
    passwordListPatch: shouldUpdatePasswordList ? next : null,
    returnValue: null,
    shouldUpdatePasswordList,
  };
};

export const generateCreateSbtRandomHexString = ({
  getRandomValues = null,
  length = 0,
  randomBytes = null,
}: {
  getRandomValues?: CreateSbtGetRandomValues | null;
  length?: unknown;
  randomBytes?: CreateSbtRandomBytes | null;
} = {}): string => {
  const targetLength = Math.max(0, Math.floor(Number(length || 0) || 0));
  const byteCount = Math.ceil(targetLength / 2);
  let arr: Uint8Array | number[];
  if (typeof getRandomValues === 'function') {
    const bytes = new Uint8Array(byteCount);
    arr = getRandomValues(bytes);
  } else if (typeof randomBytes === 'function') {
    arr = randomBytes(byteCount);
  } else {
    arr = new Uint8Array(byteCount);
  }
  const hex = Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, targetLength);
};

export const buildCreateSbtDeferredDraftCreate2Salt = ({
  prefix = 'draft/',
  randomBytes = null,
}: {
  prefix?: unknown;
  randomBytes?: CreateSbtRandomBytes | null;
} = {}): string =>
  `${String(prefix || '')}${generateCreateSbtRandomHexString({
    length: 32,
    randomBytes,
  })}`;

export const generateCreateSbtInviteNonces = ({
  bytesToNonce = (bytes: Uint8Array | number[]) =>
    Array.from(bytes)
      .map((byte) => String(byte))
      .join(''),
  count = 0,
  getRandomValues = null,
  randomBytes = null,
}: {
  bytesToNonce?: CreateSbtBytesToNonce;
  count?: unknown;
  getRandomValues?: CreateSbtGetRandomValues | null;
  randomBytes?: CreateSbtRandomBytes | null;
} = {}): string[] => {
  const raw = Number(count || 0);
  const target = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
  const nonces = new Set<string>();
  while (nonces.size < target) {
    let bytes: Uint8Array | number[];
    if (typeof getRandomValues === 'function') {
      const nextBytes = new Uint8Array(12);
      bytes = getRandomValues(nextBytes);
    } else if (typeof randomBytes === 'function') {
      bytes = randomBytes(12);
    } else {
      bytes = new Uint8Array(12);
    }
    nonces.add(String(bytesToNonce(bytes)));
  }
  return Array.from(nonces);
};

import historicalFiguresMerged from '../../variables/demo/historical_figures_merged.json';
import additionalHistoricalFigures from '../../variables/demo/additional_historical_figures.json';
import policyAtlasCouncil from '../../variables/demo/policy_atlas_council.json';
import historicalFigures from '../../variables/demo/historical_figure_users.json';
import {
  getHistoricalFigureAvatar,
  getHistoricalFigureAvatarByName,
  hasHistoricalFigureAvatar,
} from './historicalFigureAvatars.js';

type DemoAvatarInfo = {
  url: string;
  name: string;
  fallbackInitials: string;
  fallbackColor: string;
  fallbackSeed: string;
};

type DemoFigureLike = {
  id?: unknown;
  name?: unknown;
  displayName?: unknown;
  username?: unknown;
  aliases?: unknown;
  polisParticipant?: unknown;
  avatar?: unknown;
};

type AvatarRegistrationInput = {
  names?: unknown[];
  addresses?: unknown[];
  usernames?: unknown[];
  url?: unknown;
};

type HistoricalFiguresManifest = {
  figures?: DemoFigureLike[];
};

const FALLBACK_COLORS = Object.freeze(['#5affc2', '#5b8cff', '#ffb347', '#ff6bcb', '#ffd166']);

const IGNORED_INITIAL_TOKENS = new Set([
  'and',
  'da',
  'de',
  'del',
  'du',
  'ii',
  'iii',
  'iv',
  'jr',
  'sr',
  'the',
  'van',
  'von',
]);

const transliterate = (value = ''): string =>
  String(value || '')
    .replace(/ß/g, 'ss')
    .replace(/[Ææ]/g, 'ae')
    .replace(/[Œœ]/g, 'oe')
    .replace(/[Øø]/g, 'o')
    .replace(/[Ðð]/g, 'd')
    .replace(/[Þþ]/g, 'th')
    .replace(/[Łł]/g, 'l');

const stripDiacritics = (value = ''): string =>
  transliterate(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeLookupKey = (value = ''): string =>
  stripDiacritics(value)
    .replace(/&/g, 'and')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();

const normalizeAddress = (value: unknown = '') =>
  String(value || '')
    .trim()
    .toLowerCase();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const hashString = (value = ''): number => {
  let hash = 2166136261;
  const input = String(value || '');

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const deriveFallbackInitials = (name = ''): string => {
  const tokens = stripDiacritics(name)
    .split(/\s+/)
    .map((token) => token.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ''))
    .filter(Boolean);

  const significantTokens = tokens.filter((token) => !IGNORED_INITIAL_TOKENS.has(token.toLowerCase()));
  const sourceTokens = significantTokens.length > 0 ? significantTokens : tokens;

  return sourceTokens
    .slice(0, 3)
    .map((token) => token.charAt(0).toUpperCase())
    .join('');
};

const buildAvatarInfo = (name = '', url = ''): DemoAvatarInfo | null => {
  const normalizedName = String(name || '').trim();

  if (!normalizedName || !url) return null;

  return {
    url,
    name: normalizedName,
    fallbackInitials: deriveFallbackInitials(normalizedName),
    fallbackColor: FALLBACK_COLORS[hashString(normalizedName) % FALLBACK_COLORS.length],
    fallbackSeed: `demo-avatar:${normalizeLookupKey(normalizedName) || normalizedName}`,
  };
};

const avatarByAddress = new Map<string, DemoAvatarInfo>();
const avatarByName = new Map<string, DemoAvatarInfo>();

const resolveLocalAvatarUrl = ({ names = [], usernames = [] }: AvatarRegistrationInput = {}): string => {
  const normalizedUsernames = usernames.map((username) => String(username || '').trim()).filter(Boolean);

  const matchingUsername = normalizedUsernames.find((username) => hasHistoricalFigureAvatar(username));
  if (matchingUsername) {
    return getHistoricalFigureAvatar(matchingUsername) || '';
  }

  const normalizedNames = names.map((name) => String(name || '').trim()).filter(Boolean);

  const matchingName = normalizedNames.find((name) => getHistoricalFigureAvatarByName(name));
  if (!matchingName) return '';
  return getHistoricalFigureAvatarByName(matchingName) || '';
};

const registerAvatarInfo = ({
  names = [],
  addresses = [],
  usernames = [],
  url = '',
}: AvatarRegistrationInput = {}): void => {
  const normalizedNames = names.map((name) => String(name || '').trim()).filter(Boolean);

  const resolvedUrl = String(
    resolveLocalAvatarUrl({
      names: normalizedNames,
      usernames,
    }) ||
      url ||
      '',
  ).trim();

  if (normalizedNames.length === 0 || !resolvedUrl) return;

  const existingInfo = normalizedNames.map((name) => avatarByName.get(normalizeLookupKey(name))).find(Boolean);

  const avatarInfo = existingInfo || buildAvatarInfo(normalizedNames[0], resolvedUrl);

  if (!avatarInfo) return;

  normalizedNames.forEach((name) => {
    avatarByName.set(normalizeLookupKey(name), avatarInfo);
  });

  addresses
    .map((address) => normalizeAddress(address))
    .filter(Boolean)
    .forEach((address) => {
      avatarByAddress.set(address, avatarInfo);
    });
};

const mergedManifest = historicalFiguresMerged as HistoricalFiguresManifest;
const mergedFigures = Array.isArray(mergedManifest?.figures) ? mergedManifest.figures : [];

const mergedFigureByKey = new Map<string, DemoFigureLike>();

mergedFigures.forEach((figure) => {
  mergedFigureByKey.set(String(figure?.name || '').trim(), figure);

  registerAvatarInfo({
    names: [
      figure?.displayName,
      figure?.name,
      figure?.username,
      ...(Array.isArray(figure?.aliases) ? figure.aliases : []),
    ],
    addresses: [figure?.polisParticipant],
    usernames: [figure?.username, figure?.name],
    url: figure?.avatar,
  });
});

Object.entries(additionalHistoricalFigures || {}).forEach(([key, figure]) => {
  const additionalFigure: DemoFigureLike = isRecord(figure) ? figure : {};
  const mergedFigure = mergedFigureByKey.get(String(key || '').trim());

  registerAvatarInfo({
    names: [
      mergedFigure?.displayName,
      key,
      additionalFigure?.displayName,
      additionalFigure?.name,
      additionalFigure?.username,
    ],
    usernames: [additionalFigure?.username, mergedFigure?.username, key],
    url: additionalFigure?.avatar || mergedFigure?.avatar,
  });
});

(Array.isArray(historicalFigures) ? (historicalFigures as DemoFigureLike[]) : []).forEach((figure) => {
  registerAvatarInfo({
    names: [figure?.name, figure?.username],
    usernames: [figure?.username],
    url: figure?.avatar,
  });
});

(Array.isArray(policyAtlasCouncil) ? (policyAtlasCouncil as DemoFigureLike[]) : []).forEach((entry) => {
  registerAvatarInfo({
    names: [entry?.name],
    addresses: [entry?.id],
    url: entry?.avatar,
  });
});

const cloneAvatarInfo = (avatarInfo: DemoAvatarInfo | null): DemoAvatarInfo | null =>
  avatarInfo ? { ...avatarInfo } : null;

export const getDemoAvatar = (address = ''): DemoAvatarInfo | null => {
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) return null;
  return cloneAvatarInfo(avatarByAddress.get(normalizedAddress) || null);
};

export const getDemoAvatarByName = (name = ''): DemoAvatarInfo | null => {
  const normalizedName = normalizeLookupKey(name);
  if (!normalizedName) return null;
  return cloneAvatarInfo(avatarByName.get(normalizedName) || null);
};

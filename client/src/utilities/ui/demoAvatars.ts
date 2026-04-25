import historicalFiguresMerged from '../../variables/demo/historical_figures_merged.json';
import additionalHistoricalFigures from '../../variables/demo/additional_historical_figures.json';
import policyAtlasCouncil from '../../variables/demo/policy_atlas_council.json';
import historicalFigures from '../../variables/demo/historical_figure_users.json';
import {
  getHistoricalFigureAvatar,
  getHistoricalFigureAvatarByName,
  hasHistoricalFigureAvatar,
} from './historicalFigureAvatars.js';

type LooseRecord = Record<string, any>;

const FALLBACK_COLORS = Object.freeze([
  '#5affc2',
  '#5b8cff',
  '#ffb347',
  '#ff6bcb',
  '#ffd166',
]);

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

const transliterate = (value = ''): string => String(value || '')
  .replace(/ß/g, 'ss')
  .replace(/[Ææ]/g, 'ae')
  .replace(/[Œœ]/g, 'oe')
  .replace(/[Øø]/g, 'o')
  .replace(/[Ðð]/g, 'd')
  .replace(/[Þþ]/g, 'th')
  .replace(/[Łł]/g, 'l');

const stripDiacritics = (value = ''): string => transliterate(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const normalizeLookupKey = (value = ''): string => stripDiacritics(value)
  .replace(/&/g, 'and')
  .replace(/[^a-zA-Z0-9]+/g, '')
  .toLowerCase();

const normalizeAddress = (value = '') => String(value || '').trim().toLowerCase();

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

const buildAvatarInfo = (name = '', url = '') => {
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

const avatarByAddress = new Map<string, LooseRecord>();
const avatarByName = new Map<string, LooseRecord>();

const resolveLocalAvatarUrl = ({ names = [], usernames = [] }: { names?: any[]; usernames?: any[] } = {}): string => {
  const normalizedUsernames = usernames
    .map((username) => String(username || '').trim())
    .filter(Boolean);

  const matchingUsername = normalizedUsernames.find((username) => hasHistoricalFigureAvatar(username));
  if (matchingUsername) {
    return getHistoricalFigureAvatar(matchingUsername) || '';
  }

  const normalizedNames = names
    .map((name) => String(name || '').trim())
    .filter(Boolean);

  const matchingName = normalizedNames.find((name) => getHistoricalFigureAvatarByName(name));
  if (!matchingName) return '';
  return getHistoricalFigureAvatarByName(matchingName) || '';
};

const registerAvatarInfo = ({
  names = [],
  addresses = [],
  usernames = [],
  url = '',
}: {
  names?: any[];
  addresses?: any[];
  usernames?: any[];
  url?: unknown;
} = {}): void => {
  const normalizedNames = names
    .map((name) => String(name || '').trim())
    .filter(Boolean);

  const resolvedUrl = String(resolveLocalAvatarUrl({
    names: normalizedNames,
    usernames,
  }) || url || '').trim();

  if (normalizedNames.length === 0 || !resolvedUrl) return;

  const existingInfo = normalizedNames
    .map((name) => avatarByName.get(normalizeLookupKey(name)))
    .find(Boolean);

  const avatarInfo = existingInfo || buildAvatarInfo(normalizedNames[0], resolvedUrl);

  if (!avatarInfo) return;

  normalizedNames.forEach((name) => {
    avatarByName.set(normalizeLookupKey(name), avatarInfo);
  });

  addresses
    .map(normalizeAddress)
    .filter(Boolean)
    .forEach((address) => {
      avatarByAddress.set(address, avatarInfo);
    });
};

const mergedFigures = Array.isArray(historicalFiguresMerged?.figures)
  ? historicalFiguresMerged.figures
  : [];

const mergedFigureByKey = new Map();

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
  const additionalFigure = figure as any;
  const mergedFigure = mergedFigureByKey.get(String(key || '').trim()) as any;

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

(Array.isArray(historicalFigures) ? historicalFigures : []).forEach((figure) => {
  registerAvatarInfo({
    names: [figure?.name, figure?.username],
    usernames: [figure?.username],
    url: figure?.avatar,
  });
});

(Array.isArray(policyAtlasCouncil) ? policyAtlasCouncil : []).forEach((entry) => {
  registerAvatarInfo({
    names: [entry?.name],
    addresses: [entry?.id],
    url: entry?.avatar,
  });
});

const cloneAvatarInfo = (avatarInfo: LooseRecord | null): any => (avatarInfo ? { ...avatarInfo } : null);

export const getDemoAvatar = (address = ''): any => {
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) return null;
  return cloneAvatarInfo(avatarByAddress.get(normalizedAddress) || null);
};

export const getDemoAvatarByName = (name = ''): any => {
  const normalizedName = normalizeLookupKey(name);
  if (!normalizedName) return null;
  return cloneAvatarInfo(avatarByName.get(normalizedName) || null);
};

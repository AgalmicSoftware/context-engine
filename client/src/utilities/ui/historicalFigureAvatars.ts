import historicalFigureLocalPhotoManifest from './historicalFigureLocalPhotoManifest.json';
import historicalFigurePhotoManifest from './historicalFigurePhotoManifest.json';
import { generateBlockieDataUrl } from './blockieAvatars.js';
import { buildPublicUrlPath } from './publicUrl.js';

type AvatarEntry = { src?: string; name?: string };
type BlockieOptions = { fallbackSeed?: string; preferBlockie?: boolean };

const HISTORICAL_FIGURE_LOCAL_PHOTO_BY_USERNAME = Object.freeze(
  (historicalFigureLocalPhotoManifest || {}) as Record<string, AvatarEntry>,
);
const HISTORICAL_FIGURE_REMOTE_PHOTO_BY_USERNAME = Object.freeze(
  (historicalFigurePhotoManifest || {}) as Record<string, AvatarEntry>,
);
const HISTORICAL_FIGURE_PHOTO_BY_USERNAME: Record<string, AvatarEntry> = Object.freeze({
  ...HISTORICAL_FIGURE_REMOTE_PHOTO_BY_USERNAME,
  ...HISTORICAL_FIGURE_LOCAL_PHOTO_BY_USERNAME,
});
const HISTORICAL_FIGURE_USERNAMES = Object.freeze(Object.keys(HISTORICAL_FIGURE_PHOTO_BY_USERNAME));
const HISTORICAL_FIGURE_USERNAME_SET = new Set(HISTORICAL_FIGURE_USERNAMES);

const transliterate = (value = ''): string =>
  String(value || '')
    .replace(/ß/g, 'ss')
    .replace(/[Ææ]/g, 'ae')
    .replace(/[Œœ]/g, 'oe')
    .replace(/[Øø]/g, 'o')
    .replace(/[Ðð]/g, 'd')
    .replace(/[Þþ]/g, 'th')
    .replace(/[Łł]/g, 'l');

const normalizeHistoricalFigureName = (value = ''): string =>
  transliterate(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();

const HISTORICAL_FIGURE_USERNAME_BY_NORMALIZED_NAME = Object.freeze(
  HISTORICAL_FIGURE_USERNAMES.reduce<Record<string, string>>((acc, username) => {
    const entry = (HISTORICAL_FIGURE_PHOTO_BY_USERNAME[username] || {}) as AvatarEntry;
    [username, entry?.name]
      .map(normalizeHistoricalFigureName)
      .filter(Boolean)
      .forEach((normalizedName) => {
        if (!acc[normalizedName]) {
          acc[normalizedName] = username;
        }
      });
    return acc;
  }, {}),
);

const buildPublicAssetPath = (pathname = ''): string => {
  const normalizedPath = String(pathname || '').trim();
  if (!normalizedPath) return '';
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
  return buildPublicUrlPath(normalizedPath);
};

const buildHistoricalFigureBlockieSeed = (usernameIn = ''): string => {
  const username = String(usernameIn || '')
    .trim()
    .toLowerCase();
  return username ? `historical:${username}` : 'historical-figure';
};

export const getHistoricalFigureBlockie = (usernameIn = '', options: BlockieOptions = {}): string => {
  const username = String(usernameIn || '').trim();
  const fallbackSeed = HISTORICAL_FIGURE_USERNAME_SET.has(username)
    ? buildHistoricalFigureBlockieSeed(username)
    : String(options?.fallbackSeed || username || 'historical-figure');
  return generateBlockieDataUrl(fallbackSeed, 8, 4) || '';
};

export const hasHistoricalFigureAvatar = (usernameIn = ''): boolean =>
  HISTORICAL_FIGURE_USERNAME_SET.has(String(usernameIn || '').trim());

export const getHistoricalFigureAvatar = (usernameIn = ''): string => {
  const username = String(usernameIn || '').trim();
  if (!username) return '';
  return buildPublicAssetPath(HISTORICAL_FIGURE_PHOTO_BY_USERNAME[username]?.src || '');
};

export const getHistoricalFigureAvatarByName = (nameIn = ''): string => {
  const normalizedName = normalizeHistoricalFigureName(nameIn);
  if (!normalizedName) return '';
  return getHistoricalFigureAvatar(HISTORICAL_FIGURE_USERNAME_BY_NORMALIZED_NAME[normalizedName] || '');
};

export const getHistoricalFigureAvatarOrBlockie = (usernameIn = '', options: BlockieOptions = {}): string => {
  const username = String(usernameIn || '').trim();
  const preferBlockie = Boolean(options?.preferBlockie);

  if (!preferBlockie) {
    const historicalAvatar = getHistoricalFigureAvatar(username);
    if (historicalAvatar) return historicalAvatar;
  }

  return getHistoricalFigureBlockie(username, options);
};

export const getHistoricalFigureAvatarUsernames = (): string[] => HISTORICAL_FIGURE_USERNAMES.slice();

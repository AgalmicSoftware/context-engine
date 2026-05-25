import { toStr } from '../../utilities/shared/primitives.js';
import { buildPublicRoute, readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';

export const normalizeSettingsSessionSlug = (value: unknown): string => {
  const raw = toStr(value).trim().toLowerCase();
  return raw === 'general' ? '' : raw;
};

export const formatSettingsSessionSlug = (value: unknown): string => {
  const normalized = normalizeSettingsSessionSlug(value);
  return normalized || 'general';
};

export const buildSettingsSessionHref = (slugIn?: string): string => {
  const normalizedBasePath = toStr(readPublicUrlBasePath()).trim().replace(/\/+$/, '');
  const slug = normalizeSettingsSessionSlug(slugIn);
  return `${normalizedBasePath}${slug ? `/session/${encodeURIComponent(slug)}` : '/session'}`;
};

export const buildBookmarksRoutePath = (): string => buildPublicRoute('/bookmarks');

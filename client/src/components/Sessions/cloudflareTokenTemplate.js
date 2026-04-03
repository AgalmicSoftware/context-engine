import { toStr } from '../../utilities/shared/primitives.js';

export const CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS = Object.freeze([
  { key: 'workers_kv_storage', type: 'edit' },
  { key: 'workers_scripts', type: 'edit' },
  { key: 'account_settings', type: 'edit' },
]);

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const formatTokenTimestamp = (date = new Date()) => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mon = MONTHS[date.getMonth()] || 'UNK';
  const yyyy = date.getFullYear();
  const hours = date.getHours();
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const hh = String(hours % 12 || 12).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${mon}${dd}-${yyyy}-${hh}${mm}${meridiem}`;
};

const buildTokenName = (slug) => {
  const safeSlug = toStr(slug).trim() || 'general';
  return `contextEngine-corsSessionWorker-${safeSlug}-${formatTokenTimestamp()}`;
};

export const buildCloudflareTokenTemplateUrl = ({ accountId, slug } = {}) => {
  const params = new URLSearchParams();
  params.set('permissionGroupKeys', JSON.stringify(CLOUDFLARE_TOKEN_TEMPLATE_PERMISSIONS));
  params.set('accountId', toStr(accountId).trim() || '*');
  params.set('zoneId', 'all');
  params.set('name', buildTokenName(slug));
  return `https://dash.cloudflare.com/profile/api-tokens?${params.toString()}`;
};

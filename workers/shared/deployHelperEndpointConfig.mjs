export const DEFAULT_CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4';
export const CLOUDFLARE_API_BASE_URL_ENV = 'CE_CLOUDFLARE_API_BASE_URL';

const toTrimmedString = (value) => (
  typeof value === 'string'
    ? value.trim()
    : value == null
      ? ''
      : String(value).trim()
);

const stripTrailingSlashes = (value) => value.replace(/\/+$/u, '');

export const resolveCloudflareApiBaseUrl = ({
  apiBaseUrl = '',
  env = null,
} = {}) => (
  stripTrailingSlashes(toTrimmedString(apiBaseUrl)) ||
  stripTrailingSlashes(toTrimmedString(env?.[CLOUDFLARE_API_BASE_URL_ENV])) ||
  DEFAULT_CLOUDFLARE_API_BASE_URL
);

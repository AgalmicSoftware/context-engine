import { toTrimmedString } from './stringCoercion.js';

export const normalizeFetchTargetUrl = ({ url, deps } = {}) => {
  const input = toTrimmedString(url);
  if (!input) {
    return {
      ok: false,
      status: 400,
      error: 'Missing url',
      targetUrl: '',
    };
  }

  let target = null;
  try {
    target = new URL(input);
  } catch {
    return {
      ok: false,
      status: 400,
      error: 'Invalid URL',
      targetUrl: '',
    };
  }

  if (target.protocol !== 'https:') {
    return {
      ok: false,
      status: 400,
      error: 'URL must be https',
      targetUrl: target.toString(),
    };
  }

  if (deps?.isBlockedOutboundUrl?.(target.toString())) {
    return {
      ok: false,
      status: 403,
      error: 'URL target is not allowed',
      targetUrl: target.toString(),
    };
  }

  return {
    ok: true,
    status: 200,
    error: '',
    targetUrl: target.toString(),
  };
};

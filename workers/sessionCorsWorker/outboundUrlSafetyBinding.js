const toStr = (value, deps) => (
  typeof deps?.toStr === 'function'
    ? deps.toStr(value)
    : typeof value === 'string'
      ? value
      : value == null
        ? ''
        : String(value)
);

export const STRICT_HTTPS_NO_CREDENTIALS_POLICY = 'strict-https-no-credentials';

const normalizeOutboundHostname = (value, deps) => (
  toStr(value, deps).trim().toLowerCase().replace(/\.+$/, '')
);

const stripIpv6HostnameDecorators = (value, deps) => (
  normalizeOutboundHostname(value, deps)
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split('%')[0]
);

const parseIpv4Octets = (value, deps) => {
  const parts = normalizeOutboundHostname(value, deps).split('.');
  if (parts.length !== 4) return null;
  const octets = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const num = Number(part);
    if (!Number.isInteger(num) || num < 0 || num > 255) return null;
    octets.push(num);
  }
  return octets;
};

const isBlockedIpv4Octets = (octets) => {
  if (!Array.isArray(octets) || octets.length !== 4) return false;
  const [a, b, c] = octets;
  if (a === 0) return true;
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 192 && b === 31 && c === 196) return true;
  if (a === 192 && b === 52 && c === 193) return true;
  if (a === 192 && b === 88 && c === 99) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a === 192 && b === 175 && c === 48) return true;
  if (a >= 224 && a <= 239) return true;
  if (a >= 240) return true;
  return false;
};

const parseMappedIpv4OctetsFromIpv6 = (value, deps) => {
  const bare = stripIpv6HostnameDecorators(value, deps);
  if (!bare.startsWith('::ffff:')) return null;
  const suffix = bare.slice('::ffff:'.length);
  const dotted = parseIpv4Octets(suffix, deps);
  if (dotted) return dotted;
  const hexParts = suffix.split(':').filter(Boolean);
  if (hexParts.length === 1 && /^[0-9a-f]{1,8}$/i.test(hexParts[0])) {
    const raw = parseInt(hexParts[0], 16);
    return [
      (raw >>> 24) & 0xff,
      (raw >>> 16) & 0xff,
      (raw >>> 8) & 0xff,
      raw & 0xff,
    ];
  }
  if (hexParts.length === 2 && hexParts.every((part) => /^[0-9a-f]{1,4}$/i.test(part))) {
    const hi = parseInt(hexParts[0], 16);
    const lo = parseInt(hexParts[1], 16);
    return [
      (hi >>> 8) & 0xff,
      hi & 0xff,
      (lo >>> 8) & 0xff,
      lo & 0xff,
    ];
  }
  return null;
};

const getIpv6FirstHextet = (value, deps) => {
  const bare = stripIpv6HostnameDecorators(value, deps);
  if (!bare.includes(':')) return NaN;
  const first = bare.split(':').find((part) => part.length > 0);
  if (!first) return 0;
  if (!/^[0-9a-f]{1,4}$/i.test(first)) return NaN;
  return parseInt(first, 16);
};

const isBlockedIpv6Hostname = (value, deps) => {
  const bare = stripIpv6HostnameDecorators(value, deps);
  if (!bare.includes(':')) return false;
  if (bare === '::' || bare === '0:0:0:0:0:0:0:0') return true;
  if (bare === '::1' || bare === '0:0:0:0:0:0:0:1') return true;
  const mappedIpv4 = parseMappedIpv4OctetsFromIpv6(value, deps);
  if (mappedIpv4 && isBlockedIpv4Octets(mappedIpv4)) return true;
  const firstHextet = getIpv6FirstHextet(value, deps);
  if (!Number.isFinite(firstHextet)) return false;
  if ((firstHextet & 0xffc0) === 0xfe80) return true;
  if ((firstHextet & 0xfe00) === 0xfc00) return true;
  return false;
};

export const createOutboundUrlSafetyHelpersWithWorkerDeps = ({
  deps,
} = {}) => {
  const URLWithCtor = deps?.URL || URL;
  const HeadersCtor = deps?.Headers || Headers;
  const fetchImpl = deps?.fetch || globalThis.fetch;

  const isBlockedOutboundUrl = (urlString) => {
    let parsed;
    try {
      parsed = new URLWithCtor(urlString);
    } catch {
      return true;
    }
    if (!/^https?:$/.test(parsed.protocol)) return true;
    const hostname = normalizeOutboundHostname(parsed.hostname.replace(/\.+$/, ''), deps);
    if (!hostname) return true;
    if (hostname === 'localhost') return true;
    const ipv4 = parseIpv4Octets(hostname, deps);
    if (ipv4 && isBlockedIpv4Octets(ipv4)) return true;
    if (isBlockedIpv6Hostname(hostname, deps)) return true;
    if (hostname === 'metadata.google.internal') return true;
    return false;
  };

  const isBlockedByPolicy = (urlString, policy) => {
    if (isBlockedOutboundUrl(urlString)) return true;
    if (policy !== STRICT_HTTPS_NO_CREDENTIALS_POLICY) return false;
    try {
      const parsed = new URLWithCtor(urlString);
      return parsed.protocol !== 'https:' || !!parsed.username || !!parsed.password;
    } catch {
      return true;
    }
  };

  const buildSafeRedirectHeaders = (headersInit) => {
    const safeHeaders = new HeadersCtor();
    if (!headersInit) return safeHeaders;
    const headers = new HeadersCtor(headersInit);
    ['content-type', 'user-agent'].forEach((name) => {
      const value = headers.get(name);
      if (value) safeHeaders.set(name, value);
    });
    return safeHeaders;
  };

  const safeFetch = async (url, options = {}) => {
    const { outboundUrlPolicy = '', ...fetchOptions } = options;
    if (isBlockedByPolicy(url, outboundUrlPolicy)) {
      return { ok: false, error: 'Outbound target is not allowed', status: 403 };
    }
    const requestOptions = { ...fetchOptions, redirect: 'manual' };
    const r = await fetchImpl(url, requestOptions);
    if (r.status < 300 || r.status >= 400) return r;

    const location = toStr(r.headers.get('location'), deps).trim();
    let redirectUrl = '';
    if (location) {
      try {
        redirectUrl = new URLWithCtor(location, url).toString();
      } catch {
        redirectUrl = '';
      }
    }
    if (!redirectUrl || isBlockedByPolicy(redirectUrl, outboundUrlPolicy)) {
      return { ok: false, error: 'Redirect to blocked target', status: 403 };
    }

    const redirectOptions = {
      ...requestOptions,
      headers: buildSafeRedirectHeaders(requestOptions.headers),
    };
    const r2 = await fetchImpl(redirectUrl, redirectOptions);
    if (r2.status >= 300 && r2.status < 400) {
      return { ok: false, error: 'Too many redirects', status: 403 };
    }
    return r2;
  };

  return {
    normalizeOutboundHostname: (value) => normalizeOutboundHostname(value, deps),
    parseIpv4Octets: (value) => parseIpv4Octets(value, deps),
    isBlockedIpv4Octets,
    parseMappedIpv4OctetsFromIpv6: (value) => parseMappedIpv4OctetsFromIpv6(value, deps),
    isBlockedIpv6Hostname: (value) => isBlockedIpv6Hostname(value, deps),
    isBlockedOutboundUrl,
    buildSafeRedirectHeaders,
    safeFetch,
  };
};

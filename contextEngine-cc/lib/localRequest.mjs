function toStr(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeIpv6(address) {
  return toStr(address).trim().toLowerCase().split('%')[0];
}

export function isLoopbackAddress(address) {
  const normalized = normalizeIpv6(address);
  if (!normalized) return false;
  if (normalized === '::1') return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    return /^127\.\d+\.\d+\.\d+$/.test(mapped);
  }
  return /^127\.\d+\.\d+\.\d+$/.test(normalized);
}

export function extractHostnameFromHostHeader(hostHeader) {
  const raw = toStr(hostHeader).trim();
  if (!raw) return '';
  if (raw.startsWith('[')) {
    const endIdx = raw.indexOf(']');
    if (endIdx > 1) return raw.slice(1, endIdx).toLowerCase();
  }
  const idx = raw.indexOf(':');
  if (idx > 0) return raw.slice(0, idx).toLowerCase();
  return raw.toLowerCase();
}

export function isLoopbackHost(hostname) {
  const host = toStr(hostname).trim().toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host === '::1') return true;
  return /^127\.\d+\.\d+\.\d+$/.test(host);
}

export function isLoopbackOrigin(originLike) {
  const raw = toStr(originLike).trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return isLoopbackHost(parsed.hostname);
  } catch {
    return false;
  }
}

export function isTrustedLocalRequest(req) {
  const remoteAddress = req?.socket?.remoteAddress || req?.connection?.remoteAddress || '';
  if (!isLoopbackAddress(remoteAddress)) {
    return {
      ok: false,
      reason: `Rejected non-loopback remote address: ${toStr(remoteAddress) || 'unknown'}`,
    };
  }

  const hostHeader = req?.headers?.host || '';
  const hostName = extractHostnameFromHostHeader(hostHeader);
  if (!isLoopbackHost(hostName)) {
    return {
      ok: false,
      reason: `Rejected non-loopback host header: ${toStr(hostHeader) || 'missing'}`,
    };
  }

  const origin = toStr(req?.headers?.origin).trim();
  if (origin && !isLoopbackOrigin(origin)) {
    return {
      ok: false,
      reason: `Rejected non-loopback Origin: ${origin}`,
    };
  }

  const referer = toStr(req?.headers?.referer).trim();
  if (referer && !isLoopbackOrigin(referer)) {
    return {
      ok: false,
      reason: `Rejected non-loopback Referer: ${referer}`,
    };
  }

  return { ok: true, hostName, remoteAddress };
}

export function resolveCorsAllowOrigin(req) {
  const origin = toStr(req?.headers?.origin).trim();
  if (!origin) return null;
  return isLoopbackOrigin(origin) ? origin : null;
}

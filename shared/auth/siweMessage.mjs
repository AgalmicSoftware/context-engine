// Pure sign-in wire rules shared by the browser and MCP. Runtime defaults
// (browser location, clocks and session-slug aliases) stay with the callers.
export const normalizeSessionIdHex = (value) => {
  if (typeof value !== 'string' || value !== value.trim()) return '';
  const lower = value.toLowerCase();
  const hex = lower.startsWith('0x') ? lower.slice(2) : lower;
  if (/^[0-9a-f]{32}$/.test(hex) && !/^0+$/.test(hex)) return `0x${hex}`;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(lower)) {
    const uuidHex = lower.replace(/-/g, '');
    return /^0+$/.test(uuidHex) ? '' : `0x${uuidHex}`;
  }
  return '';
};

/** @param {Record<string, unknown>} options */
export const buildSiweMessage = ({
  address, nonce, chainId, domain, uri, statement, issuedAt, expirationTime,
  workerUrl, sessionId, sessionSlug,
}) => {
  const id = String(sessionId || '').trim().toLowerCase();
  const slug = sessionSlug === 'general' ? '' : String(sessionSlug || '');
  const sessionResource = id
    ? `urn:context-engine:session:id:${encodeURIComponent(id)}`
    : `urn:context-engine:session:slug:${encodeURIComponent(slug)}`;
  const resources = workerUrl
    ? `\nResources:\n- ${new URL(String(workerUrl)).origin}\n- ${sessionResource}`
    : '';
  return `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n${statement}\n\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expirationTime}${resources}`;
};

const ADMIN_ACTION_DOMAIN_FIELDS = Object.freeze([
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
]);

const ADMIN_ACTION_STRUCT_FIELDS = Object.freeze([
  { name: 'action', type: 'string' },
  { name: 'slug', type: 'string' },
  { name: 'bodyHash', type: 'bytes32' },
  { name: 'nonce', type: 'string' },
  { name: 'audience', type: 'string' },
  { name: 'expiration', type: 'uint256' },
]);

export const ADMIN_ACTION_DOMAIN = Object.freeze({
  name: 'ContextEngineAdmin',
  version: '1',
});

export const ADMIN_ACTION_TYPES = Object.freeze({
  AdminAction: ADMIN_ACTION_STRUCT_FIELDS,
});

export const ADMIN_ACTION_AUTH_FIELDS = Object.freeze([
  'address',
  'signature',
  'action',
  'slug',
  'bodyHash',
  'nonce',
  'audience',
  'expiration',
]);

const toTrimmedString = (value) =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

export const buildAdminActionMessage = ({ action, slug, bodyHash, nonce, audience, expiration } = {}) => ({
  action: toTrimmedString(action),
  slug: toTrimmedString(slug),
  bodyHash: toTrimmedString(bodyHash),
  nonce: toTrimmedString(nonce),
  audience: toTrimmedString(audience),
  expiration: Number.isFinite(Number(expiration)) ? Number(expiration) : 0,
});

export const buildAdminActionTypedData = (params = {}) => ({
  domain: ADMIN_ACTION_DOMAIN,
  primaryType: 'AdminAction',
  types: {
    EIP712Domain: ADMIN_ACTION_DOMAIN_FIELDS,
    ...ADMIN_ACTION_TYPES,
  },
  message: buildAdminActionMessage(params),
});

export const stripAdminActionAuthFields = (body = {}) => {
  const source = body && typeof body === 'object' ? body : {};
  return Object.entries(source).reduce((acc, [key, value]) => {
    if (ADMIN_ACTION_AUTH_FIELDS.includes(key)) return acc;
    acc[key] = value;
    return acc;
  }, {});
};

// Hashing stays injected so importing these rules never selects an ethers
// version for a caller. The client supplies v5 utilities; the Worker uses v6.
export const createAdminActionBodyHash = ({ keccak256, toUtf8Bytes }) => (body = {}) => {
  if (typeof keccak256 !== 'function' || typeof toUtf8Bytes !== 'function') {
    throw new Error('ethers utils unavailable for admin action hashing.');
  }
  return keccak256(toUtf8Bytes(JSON.stringify(stripAdminActionAuthFields(body))));
};

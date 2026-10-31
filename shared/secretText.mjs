// Secret-shaped text: provider keys, Cloudflare API tokens, private keys and
// other 32-byte hex secrets (not hashes in a link's path), JSON Web Keys, PEM
// keys, bearer tokens and credentials in links, including a setup link's #k=.
// Every repeat is bounded or anchored by a literal, so scans stay linear.
const SECRET_PATTERNS = [
  /\bsk-[\w-]{16,}/,
  /\bAIza[\w-]{30,}/,
  /\b(?:gsk|ghp|gho|ghu|ghs|ghr|github_pat|glpat|xox[abpr])[-_][\w-]{16,}/,
  /-----BEGIN [A-Z ]{0,40}PRIVATE KEY-----/,
  /"kty"\s*:/,
  /\bBearer\s+[\w.~+/=-]{16,}/i,
  /\b[a-z][a-z\d+.-]{0,31}:\/\/[^\s/?#@]*@/i,
  /[?&#](?:access_token|api[_-]?key|key|token|secret|password|sig|signature|auth)=[^&#\s]/i,
  /#(?:[^\s#]*&)?k=[^&#\s]/,
];
// 64 hex digits outside a link's path: a private key's shape, and a
// transaction hash's, which belongs in an explorer link instead.
const HEX_KEY = /(?<![/\w])(?:0x)?[0-9a-f]{64,}\b/i;
// A 40-character run mixing cases and digits, unless it starts a segment of a
// link's path, where page names and IDs live.
const TOKEN_RUN = /(?<![\w/-])[\w-]{40}(?![\w-])/g;

/** Completes "<the field> …" when hasHexKey is true. */
export const HEX_KEY_HINT =
  'has 64 hex digits, the shape of a private key. To cite a transaction, link to it in a block explorer instead.';

/** True for 64 hex digits outside a link's path. */
export const hasHexKey = (text) => typeof text === 'string' && HEX_KEY.test(text);

/** True for text that looks like a key, token or password. */
export const looksSecret = (text) =>
  typeof text === 'string' &&
  (hasHexKey(text) ||
    SECRET_PATTERNS.some((pattern) => pattern.test(text)) ||
    (text.match(TOKEN_RUN) || []).some((run) => /[A-Z]/.test(run) && /[a-z]/.test(run) && /\d/.test(run)));

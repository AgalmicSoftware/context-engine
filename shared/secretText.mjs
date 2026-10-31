// Secret-shaped text: provider keys, Cloudflare API tokens, private keys and
// other 32-byte hex secrets (not hashes in a link's path), JSON Web Keys, PEM
// keys, bearer tokens and credentials in links, including a setup link's #k=.
// Every repeat is bounded or anchored by a literal, so scans stay linear.
const SECRET_PATTERNS = [
  /\bsk-[\w-]{16,}/,
  /\bAIza[\w-]{30,}/,
  /\b(?:gsk|ghp|gho|ghu|ghs|ghr|github_pat|glpat|xox[abpr])[-_][\w-]{16,}/,
  /(?<![/\w])(?:0x)?[0-9a-f]{64,}\b/i,
  /-----BEGIN [A-Z ]{0,40}PRIVATE KEY-----/,
  /"kty"\s*:/,
  /\bBearer\s+[\w.~+/=-]{16,}/i,
  /\b[a-z][a-z\d+.-]{0,31}:\/\/[^\s/?#@]*@/i,
  /[?&#](?:access_token|api[_-]?key|key|token|secret|password|sig|signature|auth)=[^&#\s]/i,
  /#(?:[^\s#]*&)?k=[^&#\s]/,
];
const TOKEN_RUN = /(?<![\w-])[\w-]{40}(?![\w-])/g;

/** True for text that looks like a key, token or password. */
export const looksSecret = (text) =>
  typeof text === 'string' &&
  (SECRET_PATTERNS.some((pattern) => pattern.test(text)) ||
    (text.match(TOKEN_RUN) || []).some((run) => /[A-Z]/.test(run) && /[a-z]/.test(run) && /\d/.test(run)));

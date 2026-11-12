// The site's own origins. Session Workers trust them for sign-in, and new
// sessions and the deploy helper allow them, by default.
export const SITE_ORIGINS = Object.freeze([
  'https://contextengine.sh',
  'https://www.contextengine.sh',
]);

// Local development servers. A Worker trusts them only when it opts in
// (`CE_ALLOW_LOCAL_ORIGINS=true`) or lists them in `ADMIN_TRUSTED_ORIGINS`.
export const LOCAL_DEV_ORIGINS = Object.freeze([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:7391',
  'http://127.0.0.1:7391',
]);

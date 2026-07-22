// Shared default allowlist for worker/deploy-helper CORS. Keep this stable:
// Session Wizard `/new`, admin tooling, and deploy-helper publish automation all
// read from this module so the default self-host story stays aligned.
export const DEFAULT_WORKER_ALLOWED_ORIGINS = [
  'https://contextengine.sh',
  'https://www.contextengine.sh',
  'https://contextengine.xyz',
  'https://www.contextengine.xyz',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:7391',
  'http://127.0.0.1:7391',
];

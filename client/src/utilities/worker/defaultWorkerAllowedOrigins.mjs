// Default allowlist for Session Worker and deploy-helper CORS: the site's own
// origins. `/new` also adds the page's current origin, which covers local dev.
import { SITE_ORIGINS } from '../../../../shared/workerTrustedOrigins.mjs';

export const DEFAULT_WORKER_ALLOWED_ORIGINS = [...SITE_ORIGINS];

// NOTE: The demo session uses a project-hosted worker hard-coded by default as https://demo-worker-030226.agalmic.workers.dev.
// All other OSS sessions are bring-your-own-worker.
// DEFAULT_SHARED_WORKER_URL still remains env-overridable; the hard-coded value is only the default.
// Native Cloudflare deployment is the default `/new` path. The deploy-helper
// endpoint remains available only for the explicitly labeled legacy fallback.
// All public deployment URLs below remain env-overridable via REACT_APP_CE_* variables.

import { readPublicBoolEnv, readPublicEnv } from './publicEnv.js';
import { buildPublicRepoLatestReleaseAssetUrl } from './publicRepoMetadata.js';
import {
  buildCloudflareNativeDeployUrl,
  normalizeCloudflareNativeDeployCommit,
} from '../utilities/worker/cloudflareNativeDeploy.js';

const EMPTY_PUBLIC_DEPLOYMENT_ENDPOINT = '';
const DEFAULT_PROJECT_DEPLOY_HELPER_URL = 'https://ce-deploy-helper.agalmic.workers.dev/';
const DEFAULT_DEMO_WORKER_URL = 'https://demo-worker-030226.agalmic.workers.dev';

export const DEFAULT_SHARED_WORKER_URL = readPublicEnv('REACT_APP_CE_SHARED_WORKER_URL', DEFAULT_DEMO_WORKER_URL);

export const DEPLOY_HELPER_URL = readPublicEnv('REACT_APP_CE_DEPLOY_HELPER_URL', DEFAULT_PROJECT_DEPLOY_HELPER_URL);

export const HEALTHCHECK_WORKER_URL = readPublicEnv('REACT_APP_CE_HEALTHCHECK_WORKER_URL', DEFAULT_DEMO_WORKER_URL);

export const WORKER_BUNDLE_URL = readPublicEnv(
  'REACT_APP_CE_WORKER_BUNDLE_URL',
  buildPublicRepoLatestReleaseAssetUrl('sessionCorsWorker.bundle.js'),
);

export const DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED = readPublicBoolEnv(
  'REACT_APP_CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED',
  true,
);

export const CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT = normalizeCloudflareNativeDeployCommit(
  readPublicEnv('REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT', ''),
);

export const CLOUDFLARE_NATIVE_DEPLOY_URL = buildCloudflareNativeDeployUrl({
  commit: CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT,
});

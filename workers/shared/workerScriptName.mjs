// Cloudflare serves version previews at <8-character version>-<Worker name>.<subdomain>.workers.dev.
// That first DNS label is capped at 63 characters, so Cloudflare rejects a
// Worker name longer than 54 characters while previews are enabled, which is
// the default whenever workers.dev is on.
export const MAX_WORKER_SCRIPT_NAME_LENGTH = 54;
const DEPLOYMENT_SUFFIX_LENGTH = 12;

// A readable prefix plus a deployment-derived suffix, so every retry of one
// deployment converges on the same physical script. Names that already fit
// are unchanged, which keeps previously deployed Workers addressable.
export const buildDeploymentWorkerName = (prefix, deploymentId, fallbackPrefix) => {
  const readable = String(prefix || '')
    .slice(0, MAX_WORKER_SCRIPT_NAME_LENGTH - DEPLOYMENT_SUFFIX_LENGTH - 1)
    .replace(/-+$/, '');
  return `${readable || fallbackPrefix}-${String(deploymentId || '').slice(0, DEPLOYMENT_SUFFIX_LENGTH)}`;
};

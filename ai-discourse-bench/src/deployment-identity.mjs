export const deploymentIdentityErrors = (runs) => {
  const identitiesByModel = new Map();
  runs.forEach((run) => {
    const metadata = run?.responseMetadata || {};
    if (!identitiesByModel.has(run.modelId)) {
      identitiesByModel.set(run.modelId, {
        providers: new Set(), models: new Set(), fingerprints: new Set(), endpoints: new Set(),
      });
    }
    const identity = identitiesByModel.get(run.modelId);
    const provider = String(metadata.resolvedProvider || metadata.provider || run?.provider || '').trim();
    const model = String(metadata.resolvedModel || run?.model || '').trim();
    const fingerprint = String(metadata.systemFingerprint || '').trim();
    const endpoint = String(metadata.endpoint || '').trim();
    if (provider) identity.providers.add(provider);
    if (model) identity.models.add(model);
    if (fingerprint) identity.fingerprints.add(fingerprint);
    if (endpoint) identity.endpoints.add(endpoint);
  });
  const errors = [];
  identitiesByModel.forEach((identity, modelId) => {
    if (identity.providers.size > 1 || identity.models.size > 1 || identity.fingerprints.size > 1 || identity.endpoints.size > 1) {
      errors.push(`model ${modelId} resolved to multiple deployment identities`);
    }
  });
  return errors;
};

export const assertConsistentDeployments = (runs) => {
  const errors = deploymentIdentityErrors(runs);
  if (errors.length) throw new Error(`${errors[0]}; start a new run artifact instead of resuming`);
};

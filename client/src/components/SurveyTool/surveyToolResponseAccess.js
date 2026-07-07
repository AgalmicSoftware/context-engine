export const buildCanDecryptOtherResponsesSnapshot = ({
  account = '',
  loginComplete = false,
  singleQuestionMode = false,
  isStandalone = false,
  policy = null,
  slug = '',
  sbtCacheRevision = 0,
  cfg = null,
} = {}) => {
  const normalizedAccount = String(account || '').trim();
  const loggedIn = !!(loginComplete && normalizedAccount);
  const recipients = Array.isArray(policy?.recipients) ? policy.recipients : [];
  const primaryResource =
    String(
      policy?.primaryResource || (singleQuestionMode || isStandalone ? 'questionResponses' : 'surveyResponses'),
    ).trim() || 'default';
  const resourceKeysToCheck = Array.from(new Set([primaryResource, 'default'].filter(Boolean)));
  const resourceKeysSig = resourceKeysToCheck.join(',');
  const baseParts = [
    String(slug || ''),
    resourceKeysSig,
    String(sbtCacheRevision || 0),
    String(cfg?.__registry?.updatedAt || ''),
    String(cfg?.__registry?.gateAuthority || ''),
    String(recipients.length),
  ];

  return {
    loggedIn,
    account: normalizedAccount,
    recipients,
    resourceKeysToCheck,
    key: [normalizedAccount.toLowerCase(), ...baseParts].join('|'),
    signature: [loggedIn ? normalizedAccount.toLowerCase() : '<anon>', ...baseParts].join('|'),
  };
};

export const buildResponseGateConfigSignature = (cfg = {}) => {
  const normText = (value) =>
    String(value == null ? '' : value)
      .trim()
      .toLowerCase();
  const normChain = (value) => {
    const normalizedValue = Number(value || 0);
    return Number.isFinite(normalizedValue) && normalizedValue > 0 ? String(normalizedValue) : '';
  };
  const normAddresses = (...sources) =>
    Array.from(
      new Set(
        sources
          .flat()
          .map((address) =>
            String(address || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    )
      .sort()
      .join(',');
  const readObj = (value) => (value && typeof value === 'object' ? value : {});
  const stablePairs = (obj, mapper) =>
    Object.keys(readObj(obj))
      .sort()
      .map((key) => `${key}:${mapper(readObj(obj)[key], key)}`)
      .join('|');
  const gateSnapshot = (gate = {}) => {
    const nextGate = readObj(gate);
    return [
      normText(nextGate.gateId || nextGate.id),
      normText(nextGate.label || nextGate.name || nextGate.title),
      normChain(nextGate.chainId),
      normText(nextGate.litChain || nextGate.chain),
      normText(nextGate.mode || nextGate.operator || nextGate.gateMode || nextGate.requireAll),
      normAddresses(nextGate.sbtAddress, nextGate.sbtAddresses),
      normText(nextGate.lookupStatus),
    ].join(',');
  };
  const resourceSnapshot = (resource = {}) => {
    const nextResource = readObj(resource);
    return [
      normText(nextResource.status),
      normText(nextResource.gateId || nextResource.id),
      normText(nextResource.mode || nextResource.operator),
      normText(nextResource.allowFallback),
      gateSnapshot(nextResource.gate),
    ].join(',');
  };

  const sponsoredGates = cfg?.sponsored?.gates && typeof cfg.sponsored.gates === 'object' ? cfg.sponsored.gates : {};
  const sponsoredResources =
    cfg?.sponsored?.resources && typeof cfg.sponsored.resources === 'object' ? cfg.sponsored.resources : {};
  const registryGates =
    cfg?.__registry?.gatesByResource && typeof cfg.__registry.gatesByResource === 'object'
      ? cfg.__registry.gatesByResource
      : {};

  return [
    Number(cfg?.networkChainId || 0) || 0,
    String(cfg?.sponsored?.defaultGateId || ''),
    String(cfg?.__registry?.updatedAt || ''),
    String(cfg?.__registry?.gateAuthority || ''),
    stablePairs(sponsoredGates, (gate) => gateSnapshot(gate)),
    stablePairs(sponsoredResources, (resource) => resourceSnapshot(resource)),
    stablePairs(registryGates, (gate) => gateSnapshot(gate)),
  ].join('|');
};

export const resolveCanDecryptOtherResponsesVerdict = (verdicts = []) => {
  const statuses = verdicts.map((verdict) => String(verdict?.status || 'unknown'));
  const canDecrypt = statuses.includes('granted');
  const status = canDecrypt
    ? 'granted'
    : statuses.includes('unknown') || statuses.includes('error')
      ? 'unknown'
      : statuses.includes('denied')
        ? 'denied'
        : statuses.includes('invalid-gate')
          ? 'invalid-gate'
          : statuses.includes('no-gate')
            ? 'no-gate'
            : statuses[0] || 'unknown';

  return {
    canDecrypt,
    status,
  };
};

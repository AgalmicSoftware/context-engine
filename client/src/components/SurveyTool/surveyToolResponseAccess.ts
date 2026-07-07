type UnknownRecord = Record<string, unknown>;

type ResponseAccessPolicy = {
  recipients?: unknown;
  primaryResource?: unknown;
};

type ResponseAccessConfig = {
  networkChainId?: unknown;
  sponsored?: {
    defaultGateId?: unknown;
    gates?: unknown;
    resources?: unknown;
  } | null;
  __registry?: {
    updatedAt?: unknown;
    gateAuthority?: unknown;
    gatesByResource?: unknown;
  } | null;
};

export const buildCanDecryptOtherResponsesSnapshot = ({
  account = '',
  loginComplete = false,
  singleQuestionMode = false,
  isStandalone = false,
  policy = null,
  slug = '',
  sbtCacheRevision = 0,
  cfg = null,
}: {
  account?: unknown;
  loginComplete?: unknown;
  singleQuestionMode?: unknown;
  isStandalone?: unknown;
  policy?: ResponseAccessPolicy | null;
  slug?: unknown;
  sbtCacheRevision?: unknown;
  cfg?: ResponseAccessConfig | null;
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

const readObj = (value: unknown): UnknownRecord => (value && typeof value === 'object' ? (value as UnknownRecord) : {});

export const buildResponseGateConfigSignature = (cfg: ResponseAccessConfig = {}) => {
  const normText = (value: unknown) =>
    String(value == null ? '' : value)
      .trim()
      .toLowerCase();
  const normChain = (value: unknown) => {
    const normalizedValue = Number(value || 0);
    return Number.isFinite(normalizedValue) && normalizedValue > 0 ? String(normalizedValue) : '';
  };
  const normAddresses = (...sources: unknown[]) =>
    Array.from(
      new Set(
        sources
          .flat()
          .map((address: unknown) =>
            String(address || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    )
      .sort()
      .join(',');
  const stablePairs = (obj: unknown, mapper: (value: unknown, key: string) => string) => {
    const record = readObj(obj);
    return Object.keys(record)
      .sort()
      .map((key) => `${key}:${mapper(record[key], key)}`)
      .join('|');
  };
  const gateSnapshot = (gate: unknown = {}) => {
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
  const resourceSnapshot = (resource: unknown = {}) => {
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

export const resolveCanDecryptOtherResponsesVerdict = (verdicts: Array<{ status?: unknown }> = []) => {
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

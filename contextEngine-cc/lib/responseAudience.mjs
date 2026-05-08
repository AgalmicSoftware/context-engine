const normalizeText = (value) => String(value || '').trim();

const normalizeChoice = (value, { allowFollow = false } = {}) => {
  const raw = normalizeText(value).toLowerCase();
  if (!raw) return '';
  if (allowFollow && (raw === 'follow' || raw === 'inherit' || raw === 'follow-answer')) return 'follow';
  if (raw === 'gate' || raw === 'session' || raw === 'sbt') return 'gate';
  if (raw === 'self' || raw === 'me' || raw === 'only-me' || raw === 'only me') return 'self';
  if (
    raw === 'none' ||
    raw === 'plaintext' ||
    raw === 'public' ||
    raw === 'off' ||
    raw === 'not-encrypted' ||
    raw === 'not encrypted'
  ) {
    return 'none';
  }
  return '';
};

const getGateAddresses = (gate = {}) => {
  const out = [];
  const seen = new Set();
  const push = (value) => {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalizeText(value));
  };
  (Array.isArray(gate?.sbtAddresses) ? gate.sbtAddresses : []).forEach(push);
  push(gate?.sbtAddress);
  return out;
};

const getGateLabel = (gate = {}, fallback = '') => (
  normalizeText(gate?.label) ||
  normalizeText(gate?.name) ||
  normalizeText(gate?.title) ||
  normalizeText(gate?.gateId) ||
  normalizeText(gate?.id) ||
  fallback ||
  'Gate'
);

const normalizeGateId = (gateId, gateOptions = []) => {
  const normalized = normalizeText(gateId);
  if (!normalized) return '';
  if (!Array.isArray(gateOptions) || gateOptions.length === 0) return normalized;
  return gateOptions.some((option) => option.gateId === normalized) ? normalized : '';
};

export function deriveResponseGateOptionsFromMetadata(
  metadata,
  { isQuestionResponseFlow = true } = {}
) {
  const sponsored = metadata?.sponsored && typeof metadata.sponsored === 'object'
    ? metadata.sponsored
    : {};
  const resources = sponsored.resources && typeof sponsored.resources === 'object'
    ? sponsored.resources
    : {};
  const gates = sponsored.gates && typeof sponsored.gates === 'object'
    ? sponsored.gates
    : {};
  const primaryResource = isQuestionResponseFlow ? 'questionResponses' : 'surveyResponses';

  const gateIds = [];
  const pushGateId = (value) => {
    const normalized = normalizeText(value);
    if (!normalized || gateIds.includes(normalized)) return;
    gateIds.push(normalized);
  };

  const primaryResourceConfig = resources?.[primaryResource] && typeof resources[primaryResource] === 'object'
    ? resources[primaryResource]
    : {};
  const defaultResourceConfig = resources?.default && typeof resources.default === 'object'
    ? resources.default
    : {};

  (Array.isArray(primaryResourceConfig.gateIds) ? primaryResourceConfig.gateIds : []).forEach(pushGateId);
  pushGateId(primaryResourceConfig.gateId);
  (Array.isArray(defaultResourceConfig.gateIds) ? defaultResourceConfig.gateIds : []).forEach(pushGateId);
  pushGateId(defaultResourceConfig.gateId);
  pushGateId(sponsored.defaultGateId);

  if (gateIds.length === 0) {
    Object.keys(gates).forEach(pushGateId);
  }

  const options = gateIds
    .map((gateId) => {
      const gate = gates?.[gateId];
      if (!gate || typeof gate !== 'object') return null;
      const sbtAddresses = getGateAddresses(gate);
      if (!sbtAddresses.length) return null;
      return {
        gateId,
        label: getGateLabel(gate, gateId),
        sbtAddresses,
        sbtSummary: sbtAddresses.join(', '),
        chainId: gate?.chainId || null,
        litChain: normalizeText(gate?.litChain || gate?.chain) || null,
        mode: normalizeText(gate?.mode || gate?.operator || gate?.gateMode) || 'any',
      };
    })
    .filter(Boolean);

  return {
    primaryResource,
    gateOptions: options,
    defaultGateId: options[0]?.gateId || '',
  };
}

export function normalizeResponseAudienceSelections({
  answerAudience,
  answerGateId,
  additionalAudience,
  additionalGateId,
  encryptRequested = false,
  encryptAdditionalRequested = null,
  hasAdditionalText = false,
  gateOptions = [],
} = {}) {
  const defaultGateId = gateOptions[0]?.gateId || '';

  const explicitAnswerChoice = normalizeChoice(answerAudience);
  // Regression guard: legacy boolean encrypt flags must stay wallet-only.
  // Silent promotion to a session gate broadens visibility for existing callers.
  const resolvedAnswerAudience = explicitAnswerChoice
    || (encryptRequested ? 'self' : 'none');
  const resolvedAnswerGateId = resolvedAnswerAudience === 'gate'
    ? (normalizeGateId(answerGateId, gateOptions) || defaultGateId || null)
    : null;

  const explicitAdditionalChoice = normalizeChoice(additionalAudience, { allowFollow: true });
  let resolvedAdditionalAudience = 'none';
  let resolvedAdditionalGateId = null;
  let additionalAudienceMode = 'explicit';

  if (explicitAdditionalChoice === 'follow') {
    additionalAudienceMode = 'inherit';
    resolvedAdditionalAudience = resolvedAnswerAudience;
    resolvedAdditionalGateId = resolvedAnswerGateId;
  } else if (explicitAdditionalChoice) {
    resolvedAdditionalAudience = explicitAdditionalChoice;
    resolvedAdditionalGateId = explicitAdditionalChoice === 'gate'
      ? (normalizeGateId(additionalGateId, gateOptions) || defaultGateId || null)
      : null;
  } else if (encryptAdditionalRequested === true || encryptAdditionalRequested === false) {
    resolvedAdditionalAudience = encryptAdditionalRequested ? 'self' : 'none';
    resolvedAdditionalGateId = resolvedAdditionalAudience === 'gate' ? (defaultGateId || null) : null;
  } else if (hasAdditionalText) {
    additionalAudienceMode = 'inherit';
    resolvedAdditionalAudience = resolvedAnswerAudience;
    resolvedAdditionalGateId = resolvedAnswerGateId;
  }

  return {
    answerEncryptionAudience: resolvedAnswerAudience,
    answerEncryptionGateId: resolvedAnswerGateId,
    additionalEncryptionAudience: resolvedAdditionalAudience,
    additionalEncryptionGateId: resolvedAdditionalGateId,
    additionalAudienceMode,
  };
}

export function isEncryptedAudience(value) {
  const normalized = normalizeChoice(value, { allowFollow: false });
  return normalized === 'self' || normalized === 'gate';
}

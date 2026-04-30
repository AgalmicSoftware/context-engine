import { buildSbtAccessControlConditions, resolveLitChain } from '../../utilities/crypto/litProtocol.js';
import { normalizeGateLabelText as normalizeGateLabelTextCore } from './surveyToolAudienceDerivationController';
import { normalizeQuestionIdKey as normalizeQuestionIdKeyCore } from './surveyToolSignatures';

type GateLabelArgs = {
  gate?: any;
  resourceKey?: string;
  sbtAddresses?: string[];
};

export type ResponseGateDeps = {
  resolveSessionChainId: () => number | null;
  normalizeGateLabelText: (value: any) => string;
  normalizeQuestionIdKey: (value: unknown) => string;
  resolveSbtGateLabel: (address: string, preferredSlug?: string) => string;
  getShortenedAddress: (address: string, full: boolean) => string;
  t: (key: string) => string;
  buildSbtDetailPath: (address: string, sessionSlug: string) => string;
  getQuestionById: (questionId: string) => any;
  getQuestionEncryptionGates: (question: any) => any[];
  buildRecipientsFromGates: (gates: any[]) => any[];
  resolveConfiguredGateLabel: (opts?: GateLabelArgs) => string;
  resolveGateDisplayLabel: (gate?: any, fallbackSbt?: string) => string;
  buildGateAudienceSbtItems: (sbtAddresses?: any[], sessionSlug?: string) => any[];
  getQuestionGateOptions: (questionId?: string | null) => any[];
  getResponseGatePolicy: () => any;
  isQuestionLockedForResponse: (qid: string) => boolean;
  resolveLockAudienceSessionName: () => string;
  getResponseGateOptions: (questionId?: string | null) => any[];
  getResponseGateOptionById: (questionId?: string | null, gateId?: string) => any;
  resolveFieldEncryptionAudience: (field: any, qid: string | null, fieldKey: string) => string;
  resolveFieldEncryptionGateId: (field: any, questionId: string | null, fieldKey: string) => string | null;
  getEffectiveRecipientsForQid: (qid: string) => any[];
  getEffectiveDraftSlug: (() => string) | null;
  resolveEffectiveSlug: () => string;
  resolveEffectiveResponseGateConfig: (slug: string) => any;
  responseGatePolicyCacheCfg: (() => any) | any;
  resolveSlugForIds: (opts: any) => string;
  resolveLockAudienceSessionNameContext: (slug: string) => any;
  props: any;
};

const normalizeQuestionId = (
  value: unknown,
  deps?: Partial<Pick<ResponseGateDeps, 'normalizeQuestionIdKey'>>,
): string => (
  typeof deps?.normalizeQuestionIdKey === 'function'
    ? deps.normalizeQuestionIdKey(value)
    : normalizeQuestionIdKeyCore(value)
);

const normalizeGateLabel = (
  value: any,
  deps?: Partial<Pick<ResponseGateDeps, 'normalizeGateLabelText'>>,
): string => (
  typeof deps?.normalizeGateLabelText === 'function'
    ? deps.normalizeGateLabelText(value)
    : normalizeGateLabelTextCore(value)
);

const collectUniqueSbtAddresses = (gate: any = {}): string[] => (
  Array.from(new Set(
    [
      ...(Array.isArray(gate?.sbtAddresses) ? gate.sbtAddresses : []),
      gate?.sbtAddress,
    ]
      .map((address) => String(address || '').trim())
      .filter(Boolean)
  ))
);

const buildSbtSummary = (
  sbtAddresses: string[] = [],
  deps: Pick<ResponseGateDeps, 'resolveSbtGateLabel' | 'getShortenedAddress'>,
): string => (
  sbtAddresses.length > 0
    ? sbtAddresses
      .map((address) => deps.resolveSbtGateLabel(address) || deps.getShortenedAddress(address, false))
      .join(', ')
    : 'none'
);

const resolveResponseGateSessionSlug = (
  deps: Pick<ResponseGateDeps, 'getEffectiveDraftSlug' | 'resolveEffectiveSlug'>,
): string => (
  typeof deps.getEffectiveDraftSlug === 'function'
    ? deps.getEffectiveDraftSlug() || ''
    : deps.resolveEffectiveSlug() || ''
);

const resolveResponseGatePolicyCacheCfg = (
  deps: Pick<ResponseGateDeps, 'responseGatePolicyCacheCfg'>,
): any => (
  typeof deps.responseGatePolicyCacheCfg === 'function'
    ? deps.responseGatePolicyCacheCfg()
    : deps.responseGatePolicyCacheCfg
);

export const buildRecipientsFromGates = (
  gates: any[] = [],
  deps: Pick<ResponseGateDeps, 'resolveSessionChainId'>,
): any[] => {
  const list = Array.isArray(gates) ? gates : [];
  const out: any[] = [];
  const dedupe = new Set();

  list.forEach((gate) => {
    if (!gate || typeof gate !== 'object') return;

    const chainId = Number(
      gate.chainId ||
      deps.resolveSessionChainId()
    ) || null;
    const chain = resolveLitChain({ chainId, litChain: gate.litChain, chain: gate.chain });
    const sbtAddresses = collectUniqueSbtAddresses(gate);
    if (!sbtAddresses.length) return;

    const accessControlConditions = buildSbtAccessControlConditions({
      sbtAddresses,
      chainId,
      litChain: chain,
      mode: gate.mode || 'any',
    });
    if (!accessControlConditions) return;

    const recipient = { accessControlConditions, chain };
    const sig = JSON.stringify(recipient);
    if (dedupe.has(sig)) return;
    dedupe.add(sig);
    out.push(recipient);
  });

  return out;
};

export const resolveGateDisplayLabel = (
  gate: any = {},
  fallbackSbt = '',
  deps: Pick<ResponseGateDeps, 'normalizeGateLabelText' | 'resolveSbtGateLabel' | 'getShortenedAddress' | 't'>,
): string => {
  const readText = (value: any) => normalizeGateLabel(value, deps);
  const readAny = (value: any) => {
    if (typeof value === 'string') return readText(value);
    if (!value || typeof value !== 'object') return '';
    return (
      readText(value.label) ||
      readText(value.name) ||
      readText(value.title) ||
      readText(value.value) ||
      readText(value.text) ||
      readText(value.id) ||
      readText(value.gateId)
    );
  };

  const label = (
    readAny(gate?.label) ||
    readAny(gate?.name) ||
    readAny(gate?.title) ||
    readText(gate?.gateId) ||
    readText(gate?.id)
  );
  if (label) return label;

  if (fallbackSbt) {
    const sbtName = deps.resolveSbtGateLabel(fallbackSbt);
    return `${deps.t('sbt')} ${sbtName || deps.getShortenedAddress(fallbackSbt, false)}`;
  }

  return `default ${deps.t('gateLower')}`;
};

export function resolveConfiguredGateLabel(
  opts: GateLabelArgs | undefined,
  deps: Pick<ResponseGateDeps, 'responseGatePolicyCacheCfg' | 'normalizeGateLabelText' | 'resolveGateDisplayLabel'>,
): string;
export function resolveConfiguredGateLabel(
  opts: GateLabelArgs | undefined,
  cfg: any,
  deps: Pick<ResponseGateDeps, 'normalizeGateLabelText' | 'resolveGateDisplayLabel'>,
): string;
export function resolveConfiguredGateLabel(
  {
    gate = {},
    resourceKey = '',
    sbtAddresses = [],
  }: GateLabelArgs = {},
  cfgOrDeps: any = {},
  maybeDeps?: any,
): string {
  const deps = (maybeDeps || cfgOrDeps || {}) as Pick<
    ResponseGateDeps,
    'responseGatePolicyCacheCfg' | 'normalizeGateLabelText' | 'resolveGateDisplayLabel'
  >;
  const cfg = maybeDeps ? cfgOrDeps : resolveResponseGatePolicyCacheCfg(deps);
  const safeCfg = cfg && typeof cfg === 'object' ? cfg : {};
  const sponsored = (safeCfg?.sponsored && typeof safeCfg.sponsored === 'object') ? safeCfg.sponsored : {};
  const resources = (sponsored?.resources && typeof sponsored.resources === 'object') ? sponsored.resources : {};
  const gatesById = (sponsored?.gates && typeof sponsored.gates === 'object') ? sponsored.gates : {};

  const selectedResource = (resources?.[resourceKey] && typeof resources[resourceKey] === 'object')
    ? resources[resourceKey]
    : null;
  const defaultResource = (resources?.default && typeof resources.default === 'object')
    ? resources.default
    : null;

  const resourceGateIds = Array.isArray(selectedResource?.gateIds)
    ? selectedResource.gateIds.map((value: any) => normalizeGateLabel(value, deps)).filter(Boolean)
    : [];
  if (resourceGateIds.length > 1) {
    const labels = resourceGateIds
      .map((gateId: string) => {
        const configuredGate = gatesById?.[gateId];
        if (!configuredGate || typeof configuredGate !== 'object') return '';
        return deps.resolveGateDisplayLabel(configuredGate, sbtAddresses[0] || '');
      })
      .map((label: any) => normalizeGateLabel(label, deps))
      .filter((label: string) => label && label !== 'default gate');
    if (labels.length) return labels.join(' + ');
    return resourceGateIds.join(' + ');
  }

  const candidateGateIds = [
    selectedResource?.gateId,
    gate?.gateId,
    gate?.id,
    sponsored?.defaultGateId,
    defaultResource?.gateId,
  ].map((value) => normalizeGateLabel(value, deps)).filter(Boolean);

  for (const gateId of candidateGateIds) {
    const configuredGate = gatesById?.[gateId];
    if (!configuredGate || typeof configuredGate !== 'object') continue;
    const label = deps.resolveGateDisplayLabel(configuredGate, sbtAddresses[0] || '');
    if (label && label !== 'default gate') return label;
  }

  const targetSbtKey = Array.from(new Set(
    (Array.isArray(sbtAddresses) ? sbtAddresses : [])
      .map((address) => String(address || '').toLowerCase())
      .filter(Boolean)
  )).sort().join('|');

  if (targetSbtKey) {
    const configuredGates = Object.values(gatesById || {});
    for (const configuredGate of configuredGates) {
      if (!configuredGate || typeof configuredGate !== 'object') continue;
      const cg = configuredGate as any;
      const configuredSbtKey = Array.from(new Set(
        [
          ...(Array.isArray(cg.sbtAddresses) ? cg.sbtAddresses : []),
          cg.sbtAddress,
        ]
          .map((address) => String(address || '').toLowerCase())
          .filter(Boolean)
      )).sort().join('|');
      if (!configuredSbtKey || configuredSbtKey !== targetSbtKey) continue;
      const label = deps.resolveGateDisplayLabel(cg, sbtAddresses[0] || '');
      if (label && label !== 'default gate') return label;
    }
  }

  return '';
}

export const buildGateAudienceSbtItems = (
  sbtAddresses: any[] = [],
  sessionSlug = '',
  deps: Pick<ResponseGateDeps, 'resolveSbtGateLabel' | 'getShortenedAddress' | 'buildSbtDetailPath'>,
): any[] => (
  Array.from(new Set(
    (Array.isArray(sbtAddresses) ? sbtAddresses : [])
      .map((address) => String(address || '').trim())
      .filter(Boolean)
  )).map((address) => ({
    address,
    label: deps.resolveSbtGateLabel(address) || deps.getShortenedAddress(address, false),
    meta: deps.getShortenedAddress(address, false),
    href: deps.buildSbtDetailPath(address, sessionSlug),
  }))
);

export const getQuestionGateOptions = (
  questionId: string | null,
  deps: Pick<
    ResponseGateDeps,
    | 'getQuestionById'
    | 'getQuestionEncryptionGates'
    | 'buildRecipientsFromGates'
    | 'normalizeGateLabelText'
    | 'resolveConfiguredGateLabel'
    | 'resolveGateDisplayLabel'
    | 'buildGateAudienceSbtItems'
    | 'resolveSbtGateLabel'
    | 'getShortenedAddress'
    | 'normalizeQuestionIdKey'
  >,
): any[] => {
  const qid = normalizeQuestionId(questionId, deps);
  if (!qid) return [];

  const question = deps.getQuestionById(qid);
  const gates = deps.getQuestionEncryptionGates(question);
  if (!gates.length) return [];

  const out: any[] = [];
  const dedupe = new Set();
  gates.forEach((gate: any, gateIndex: number) => {
    const recipients = deps.buildRecipientsFromGates([gate]);
    if (!Array.isArray(recipients) || recipients.length === 0) return;

    const sbtAddresses = collectUniqueSbtAddresses(gate);
    const gateId = normalizeGateLabel(gate?.gateId || gate?.id || '') || `question-gate-${gateIndex}`;
    const dedupeKey = JSON.stringify({
      gateId,
      recipients,
    });
    if (dedupe.has(dedupeKey)) return;
    dedupe.add(dedupeKey);

    const label = deps.resolveConfiguredGateLabel({
      gate,
      resourceKey: gate?.resourceKey || '',
      sbtAddresses,
    }) || deps.resolveGateDisplayLabel(gate, sbtAddresses[0] || '');

    out.push({
      gateId,
      label: label || `Question gate ${gateIndex + 1}`,
      sbtAddresses,
      sbtItems: deps.buildGateAudienceSbtItems(sbtAddresses, question?.sessionSlug || ''),
      sbtSummary: buildSbtSummary(sbtAddresses, deps),
      recipients,
    });
  });

  return out;
};

export const getResponseGateOptions = (
  questionId: string | null = null,
  deps: Pick<
    ResponseGateDeps,
    | 'normalizeQuestionIdKey'
    | 'isQuestionLockedForResponse'
    | 'getQuestionGateOptions'
    | 'getResponseGatePolicy'
    | 'buildRecipientsFromGates'
    | 'resolveLockAudienceSessionName'
    | 'resolveConfiguredGateLabel'
    | 'resolveGateDisplayLabel'
    | 'buildGateAudienceSbtItems'
    | 'resolveSbtGateLabel'
    | 'getShortenedAddress'
    | 't'
    | 'getEffectiveDraftSlug'
    | 'resolveEffectiveSlug'
  >,
): any[] => {
  const qid = normalizeQuestionId(questionId, deps);
  if (qid && deps.isQuestionLockedForResponse(qid)) {
    return deps.getQuestionGateOptions(qid);
  }

  const policy = deps.getResponseGatePolicy();
  const gates = Array.isArray(policy?.gates) ? policy.gates : [];
  const recipients = Array.isArray(policy?.recipients) ? policy.recipients : [];
  if (!gates.length) return [];

  const sessionLabel = deps.resolveLockAudienceSessionName();
  const responseGateSessionSlug = resolveResponseGateSessionSlug(deps);
  const out: any[] = [];
  const dedupe = new Set();

  gates.forEach((gate: any, gateIndex: number) => {
    const gateRecipients = recipients[gateIndex]
      ? [recipients[gateIndex]]
      : deps.buildRecipientsFromGates([gate]);
    if (!Array.isArray(gateRecipients) || gateRecipients.length === 0) return;

    const sbtAddresses = collectUniqueSbtAddresses(gate);
    const gateId = normalizeGateLabel(gate?.gateId || gate?.id || gate?.resourceKey) || `gate-${gateIndex}`;
    const dedupeKey = JSON.stringify({
      gateId,
      recipients: gateRecipients,
    });
    if (dedupe.has(dedupeKey)) return;
    dedupe.add(dedupeKey);

    const configuredLabel = deps.resolveConfiguredGateLabel({
      gate,
      resourceKey: gate?.resourceKey || '',
      sbtAddresses,
    }) || deps.resolveGateDisplayLabel(gate, sbtAddresses[0] || '');
    const label = sessionLabel || configuredLabel;

    out.push({
      gateId,
      label: label || `${deps.t('gate')} ${gateIndex + 1}`,
      sbtAddresses,
      sbtItems: deps.buildGateAudienceSbtItems(sbtAddresses, responseGateSessionSlug || ''),
      sbtSummary: buildSbtSummary(sbtAddresses, deps),
      recipients: gateRecipients,
    });
  });

  return out;
};

export const getResponseGateOptionById = (
  questionId: string | null = null,
  gateId = '',
  deps: Pick<ResponseGateDeps, 'normalizeGateLabelText' | 'getResponseGateOptions'>,
): any => {
  const normalizedGateId = normalizeGateLabel(gateId, deps);
  const options = deps.getResponseGateOptions(questionId);
  if (!options.length) return null;
  if (!normalizedGateId) return options[0];
  return options.find((option) => option.gateId === normalizedGateId) || options[0];
};

export const resolveFieldEncryptionGateId = (
  field: any = {},
  questionId: string | null = null,
  fieldKey = 'answer',
  deps: Pick<
    ResponseGateDeps,
    | 'resolveFieldEncryptionAudience'
    | 'normalizeGateLabelText'
    | 'getResponseGateOptionById'
  >,
): string | null => {
  const qid = normalizeQuestionIdKeyCore(questionId);
  const audience = deps.resolveFieldEncryptionAudience(field, qid || null, fieldKey);
  if (audience !== 'gate') return null;

  const explicitGateId = normalizeGateLabel(field?.encryptionGateId || '', deps);
  const matchingOption = deps.getResponseGateOptionById(qid || null, explicitGateId);
  return matchingOption?.gateId || null;
};

export const getEffectiveRecipientsForField = (
  {
    questionId,
    fieldKey = 'answer',
    field = null,
  }: {
    questionId?: string | null;
    fieldKey?: string;
    field?: any;
  } = {},
  deps: Pick<
    ResponseGateDeps,
    | 'normalizeQuestionIdKey'
    | 'isQuestionLockedForResponse'
    | 'getEffectiveRecipientsForQid'
    | 'resolveFieldEncryptionAudience'
    | 'resolveFieldEncryptionGateId'
    | 'getResponseGateOptionById'
  >,
): any[] => {
  const qid = normalizeQuestionId(questionId, deps);
  if (!qid) return [];

  if (deps.isQuestionLockedForResponse(qid)) {
    return deps.getEffectiveRecipientsForQid(qid);
  }

  const audience = deps.resolveFieldEncryptionAudience(field || {}, qid, fieldKey);
  if (audience !== 'gate') return [];

  const gateId = deps.resolveFieldEncryptionGateId(field || {}, qid, fieldKey);
  const gateOption = deps.getResponseGateOptionById(qid, gateId ?? undefined);
  if (gateOption?.recipients?.length) return gateOption.recipients;

  return deps.getEffectiveRecipientsForQid(qid);
};

export const resolveGatedPromptGateNames = (
  question: any,
  deps: Pick<
    ResponseGateDeps,
    | 'normalizeGateLabelText'
    | 'resolveGateDisplayLabel'
    | 'getQuestionEncryptionGates'
    | 'getEffectiveDraftSlug'
    | 'resolveEffectiveSlug'
    | 'resolveEffectiveResponseGateConfig'
  >,
): string[] => {
  const normalize = (value: any) => normalizeGateLabel(value, deps);
  const readGateNames = (gateList: any[]): string[] => (
    Array.from(new Set(
      (Array.isArray(gateList) ? gateList : [])
        .map((gate) => {
          if (!gate || typeof gate !== 'object') return '';
          const sbtAddresses = collectUniqueSbtAddresses(gate);
          const label = deps.resolveGateDisplayLabel(gate, sbtAddresses[0] || '');
          return normalize(label);
        })
        .filter((label) => label && label !== 'default gate')
    ))
  );

  const fromQuestion = readGateNames(deps.getQuestionEncryptionGates(question));
  if (fromQuestion.length) return fromQuestion;

  const slug = resolveResponseGateSessionSlug(deps);
  const cfg = deps.resolveEffectiveResponseGateConfig(slug);

  const defaultGateSBTs = Array.isArray(cfg?.defaultGateSBTs) ? cfg.defaultGateSBTs : [];
  const fromDefaultGateSBTs = Array.from(new Set<string>(
    defaultGateSBTs
      .map((entry: any) => {
        if (typeof entry === 'string') return normalize(entry);
        if (!entry || typeof entry !== 'object') return '';
        return normalize(entry.name || entry.label || entry.title || entry.address);
      })
      .filter(Boolean)
  ));
  if (fromDefaultGateSBTs.length) return fromDefaultGateSBTs;

  const isPlainObject = (value: any) => !!value && typeof value === 'object' && !Array.isArray(value);
  const encryptionGateMap = isPlainObject(cfg?.encryption?.gates) ? cfg.encryption.gates : null;
  const sponsoredGateMap = isPlainObject(cfg?.sponsored?.gates) ? cfg.sponsored.gates : null;
  const gateMap = (encryptionGateMap && Object.keys(encryptionGateMap).length)
    ? encryptionGateMap
    : (sponsoredGateMap && Object.keys(sponsoredGateMap).length ? sponsoredGateMap : null);
  const gateIds = gateMap ? Object.keys(gateMap).filter(Boolean).sort() : [];

  const candidateDefaults = [
    cfg?.lit?.defaultGateId,
    cfg?.encryption?.defaultGateId,
    cfg?.encryption?.primaryGateId,
    cfg?.sponsored?.defaultGateId,
    gateIds[0],
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  const defaultGateId = candidateDefaults.find((gateId) => gateIds.includes(gateId)) || (gateIds[0] || '');

  if (defaultGateId && gateMap?.[defaultGateId] && typeof gateMap[defaultGateId] === 'object') {
    const gate = gateMap[defaultGateId];
    const fallbackLabel = normalize(gate?.label || gate?.name || gate?.title || defaultGateId);
    const resolvedLabel = normalize(deps.resolveGateDisplayLabel({ ...gate, gateId: defaultGateId }, ''));
    const best = resolvedLabel && resolvedLabel !== 'default gate' ? resolvedLabel : fallbackLabel;
    if (best && best !== 'default gate') return [best];
  }

  const legacyGate = cfg?.encryption?.gate;
  const fromLegacy = readGateNames(
    legacyGate && typeof legacyGate === 'object' && !Array.isArray(legacyGate) ? [legacyGate] : []
  );
  if (fromLegacy.length) return fromLegacy;

  return [];
};

export const resolveLockAudienceSessionName = (
  deps: Pick<
    ResponseGateDeps,
    | 'normalizeGateLabelText'
    | 'props'
    | 'responseGatePolicyCacheCfg'
    | 'resolveSlugForIds'
    | 'resolveLockAudienceSessionNameContext'
  >,
): string => {
  const props = deps.props || {};
  const fromProps = normalizeGateLabel(props.sessionName, deps);
  if (fromProps) return fromProps;

  const policyCfg = resolveResponseGatePolicyCacheCfg(deps);
  const fromPolicyCfg = normalizeGateLabel(policyCfg?.sessionName, deps);
  if (fromPolicyCfg) return fromPolicyCfg;

  try {
    const isQuestionResponseFlow = !!(props.singleQuestionMode || props.isStandalone);
    const slug = isQuestionResponseFlow
      ? deps.resolveSlugForIds({
          questionId: props.singleQuestionMode ? props.questionID : null,
          props,
          network: props.network,
        })
      : deps.resolveSlugForIds({
          surveyId: props.surveyId,
          props,
          network: props.network,
        });
    const lockAudienceContext = deps.resolveLockAudienceSessionNameContext(slug);
    const fromCfg = normalizeGateLabel(lockAudienceContext?.sessionName, deps);
    if (fromCfg) return fromCfg;
  } catch (e) {
    console.warn('SurveyTool: lock audience session name fallback', e);
  }

  return 'session';
};

import { buildSbtAccessControlConditions, resolveLitChain } from '../../utilities/crypto/litProtocol.js';
import { normalizeGateLabelText as normalizeGateLabelTextCore } from './surveyToolAudienceDerivationController';
import { normalizeQuestionIdKey as normalizeQuestionIdKeyCore } from './surveyToolSignatures';

type CacheRecord = Record<string, unknown>;
type GateConfig = CacheRecord & {
  gateId?: unknown;
  id?: unknown;
  label?: unknown;
  name?: unknown;
  title?: unknown;
  value?: unknown;
  text?: unknown;
  sbtAddress?: unknown;
  sbtAddresses?: unknown;
  chainId?: unknown;
  litChain?: unknown;
  chain?: unknown;
  mode?: unknown;
  resourceKey?: unknown;
};
type GatePolicyConfig = CacheRecord & {
  gates?: unknown;
  recipients?: unknown;
  sponsored?: unknown;
  encryption?: unknown;
  lit?: unknown;
  defaultGateSBTs?: unknown;
};
type GateAudienceSbtItem = {
  address: string;
  label: string;
  meta: string;
  href: string;
};
type GateRecipient = unknown;
type GateOption = CacheRecord & {
  gateId?: string;
  label?: string;
  sbtAddresses?: string[];
  sbtItems?: GateAudienceSbtItem[];
  sbtSummary?: string;
  recipients?: GateRecipient[];
};
type QuestionRecord = CacheRecord & {
  sessionSlug?: string;
};

type GateLabelArgs = {
  gate?: GateConfig;
  resourceKey?: string;
  sbtAddresses?: string[];
};

export type ResponseGateDeps = {
  resolveSessionChainId: () => number | null;
  normalizeGateLabelText: (value: unknown) => string;
  normalizeQuestionIdKey: (value: unknown) => string;
  resolveSbtGateLabel: (address: string, preferredSlug?: string) => string;
  getShortenedAddress: (address: string, full: boolean) => string;
  t: (key: string) => string;
  buildSbtDetailPath: (address: string, sessionSlug: string) => string;
  getQuestionById: (questionId: string) => QuestionRecord | null | undefined;
  getQuestionEncryptionGates: (question: unknown) => GateConfig[];
  buildRecipientsFromGates: (gates: GateConfig[]) => GateRecipient[];
  resolveConfiguredGateLabel: (opts?: GateLabelArgs) => string;
  resolveGateDisplayLabel: (gate?: GateConfig, fallbackSbt?: string) => string;
  buildGateAudienceSbtItems: (sbtAddresses?: unknown[], sessionSlug?: string) => GateAudienceSbtItem[];
  getQuestionGateOptions: (questionId?: string | null) => GateOption[];
  getResponseGatePolicy: () => GatePolicyConfig;
  isQuestionLockedForResponse: (qid: string) => boolean;
  resolveLockAudienceSessionName: () => string;
  getResponseGateOptions: (questionId?: string | null) => GateOption[];
  getResponseGateOptionById: (questionId?: string | null, gateId?: string) => GateOption | null;
  resolveFieldEncryptionAudience: (field: unknown, qid: string | null, fieldKey: string) => string;
  resolveFieldEncryptionGateId: (field: unknown, questionId: string | null, fieldKey: string) => string | null;
  getEffectiveRecipientsForQid: (qid: string) => GateRecipient[];
  getEffectiveDraftSlug: (() => string) | null;
  resolveEffectiveSlug: () => string;
  resolveEffectiveResponseGateConfig: (slug: string) => GatePolicyConfig;
  responseGatePolicyCacheCfg: (() => GatePolicyConfig) | GatePolicyConfig;
  resolveSlugForIds: (opts: CacheRecord) => string;
  resolveLockAudienceSessionNameContext: (slug: string) => CacheRecord | null | undefined;
  props: CacheRecord;
};

const isPlainObject = (value: unknown): value is CacheRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const asGateConfig = (value: unknown): GateConfig | null => (isPlainObject(value) ? (value as GateConfig) : null);

const normalizeQuestionId = (
  value: unknown,
  deps?: Partial<Pick<ResponseGateDeps, 'normalizeQuestionIdKey'>>,
): string =>
  typeof deps?.normalizeQuestionIdKey === 'function'
    ? deps.normalizeQuestionIdKey(value)
    : normalizeQuestionIdKeyCore(value);

const normalizeGateLabel = (
  value: unknown,
  deps?: Partial<Pick<ResponseGateDeps, 'normalizeGateLabelText'>>,
): string =>
  typeof deps?.normalizeGateLabelText === 'function'
    ? deps.normalizeGateLabelText(value)
    : normalizeGateLabelTextCore(value);

const collectUniqueSbtAddresses = (gate: GateConfig | null | undefined = {}): string[] =>
  Array.from(
    new Set(
      [...(Array.isArray(gate?.sbtAddresses) ? gate.sbtAddresses : []), gate?.sbtAddress]
        .map((address) => String(address || '').trim())
        .filter(Boolean),
    ),
  );

const buildSbtSummary = (
  sbtAddresses: string[] = [],
  deps: Pick<ResponseGateDeps, 'resolveSbtGateLabel' | 'getShortenedAddress'>,
): string =>
  sbtAddresses.length > 0
    ? sbtAddresses
        .map((address) => deps.resolveSbtGateLabel(address) || deps.getShortenedAddress(address, false))
        .join(', ')
    : 'none';

const resolveResponseGateSessionSlug = (
  deps: Pick<ResponseGateDeps, 'getEffectiveDraftSlug' | 'resolveEffectiveSlug'>,
): string =>
  typeof deps.getEffectiveDraftSlug === 'function'
    ? deps.getEffectiveDraftSlug() || ''
    : deps.resolveEffectiveSlug() || '';

const resolveResponseGatePolicyCacheCfg = (
  deps: Pick<ResponseGateDeps, 'responseGatePolicyCacheCfg'>,
): GatePolicyConfig =>
  typeof deps.responseGatePolicyCacheCfg === 'function'
    ? deps.responseGatePolicyCacheCfg()
    : deps.responseGatePolicyCacheCfg;

export const buildRecipientsFromGates = (
  gates: GateConfig[] = [],
  deps: Pick<ResponseGateDeps, 'resolveSessionChainId'>,
): GateRecipient[] => {
  const list = Array.isArray(gates) ? gates : [];
  const out: GateRecipient[] = [];
  const dedupe = new Set();

  list.forEach((gate) => {
    if (!asGateConfig(gate)) return;

    const chainId = Number(gate.chainId || deps.resolveSessionChainId()) || null;
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
  gate: GateConfig = {},
  fallbackSbt = '',
  deps: Pick<ResponseGateDeps, 'normalizeGateLabelText' | 'resolveSbtGateLabel' | 'getShortenedAddress' | 't'>,
): string => {
  const readText = (value: unknown) => normalizeGateLabel(value, deps);
  const readAny = (value: unknown) => {
    if (typeof value === 'string') return readText(value);
    const record = asGateConfig(value);
    if (!record) return '';
    return (
      readText(record.label) ||
      readText(record.name) ||
      readText(record.title) ||
      readText(record.value) ||
      readText(record.text) ||
      readText(record.id) ||
      readText(record.gateId)
    );
  };

  const label =
    readAny(gate?.label) || readAny(gate?.name) || readAny(gate?.title) || readText(gate?.gateId) || readText(gate?.id);
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
  cfg: unknown,
  deps: Pick<ResponseGateDeps, 'normalizeGateLabelText' | 'resolveGateDisplayLabel'>,
): string;
export function resolveConfiguredGateLabel(
  { gate = {}, resourceKey = '', sbtAddresses = [] }: GateLabelArgs = {},
  cfgOrDeps: unknown = {},
  maybeDeps?: Pick<ResponseGateDeps, 'normalizeGateLabelText' | 'resolveGateDisplayLabel'>,
): string {
  const deps = (maybeDeps || cfgOrDeps || {}) as Pick<
    ResponseGateDeps,
    'responseGatePolicyCacheCfg' | 'normalizeGateLabelText' | 'resolveGateDisplayLabel'
  >;
  const cfg = maybeDeps ? cfgOrDeps : resolveResponseGatePolicyCacheCfg(deps);
  const safeCfg = isPlainObject(cfg) ? cfg : {};
  const sponsored = isPlainObject(safeCfg.sponsored) ? safeCfg.sponsored : {};
  const resources = isPlainObject(sponsored.resources) ? sponsored.resources : {};
  const gatesById = isPlainObject(sponsored.gates) ? sponsored.gates : {};

  const selectedResource = isPlainObject(resources[resourceKey]) ? resources[resourceKey] : null;
  const defaultResource = isPlainObject(resources.default) ? resources.default : null;

  const resourceGateIds = Array.isArray(selectedResource?.gateIds)
    ? selectedResource.gateIds.map((value) => normalizeGateLabel(value, deps)).filter(Boolean)
    : [];
  if (resourceGateIds.length > 1) {
    const labels = resourceGateIds
      .map((gateId: string) => {
        const configuredGate = asGateConfig(gatesById[gateId]);
        if (!configuredGate) return '';
        return deps.resolveGateDisplayLabel(configuredGate, sbtAddresses[0] || '');
      })
      .map((label) => normalizeGateLabel(label, deps))
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
  ]
    .map((value) => normalizeGateLabel(value, deps))
    .filter(Boolean);

  for (const gateId of candidateGateIds) {
    const configuredGate = asGateConfig(gatesById[gateId]);
    if (!configuredGate) continue;
    const label = deps.resolveGateDisplayLabel(configuredGate, sbtAddresses[0] || '');
    if (label && label !== 'default gate') return label;
  }

  const targetSbtKey = Array.from(
    new Set(
      (Array.isArray(sbtAddresses) ? sbtAddresses : [])
        .map((address) => String(address || '').toLowerCase())
        .filter(Boolean),
    ),
  )
    .sort()
    .join('|');

  if (targetSbtKey) {
    const configuredGates = Object.values(gatesById || {});
    for (const configuredGate of configuredGates) {
      const cg = asGateConfig(configuredGate);
      if (!cg) continue;
      const configuredSbtKey = Array.from(
        new Set(
          [...(Array.isArray(cg.sbtAddresses) ? cg.sbtAddresses : []), cg.sbtAddress]
            .map((address) => String(address || '').toLowerCase())
            .filter(Boolean),
        ),
      )
        .sort()
        .join('|');
      if (!configuredSbtKey || configuredSbtKey !== targetSbtKey) continue;
      const label = deps.resolveGateDisplayLabel(cg, sbtAddresses[0] || '');
      if (label && label !== 'default gate') return label;
    }
  }

  return '';
}

export const buildGateAudienceSbtItems = (
  sbtAddresses: unknown[] = [],
  sessionSlug = '',
  deps: Pick<ResponseGateDeps, 'resolveSbtGateLabel' | 'getShortenedAddress' | 'buildSbtDetailPath'>,
): GateAudienceSbtItem[] =>
  Array.from(
    new Set(
      (Array.isArray(sbtAddresses) ? sbtAddresses : []).map((address) => String(address || '').trim()).filter(Boolean),
    ),
  ).map((address) => ({
    address,
    label: deps.resolveSbtGateLabel(address) || deps.getShortenedAddress(address, false),
    meta: deps.getShortenedAddress(address, false),
    href: deps.buildSbtDetailPath(address, sessionSlug),
  }));

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
): GateOption[] => {
  const qid = normalizeQuestionId(questionId, deps);
  if (!qid) return [];

  const question = deps.getQuestionById(qid);
  const gates = deps.getQuestionEncryptionGates(question);
  if (!gates.length) return [];

  const out: GateOption[] = [];
  const dedupe = new Set();
  gates.forEach((gate: GateConfig, gateIndex: number) => {
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

    const label =
      deps.resolveConfiguredGateLabel({
        gate,
        resourceKey: String(gate?.resourceKey || ''),
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
): GateOption[] => {
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
  const out: GateOption[] = [];
  const dedupe = new Set();

  gates.forEach((gate: GateConfig, gateIndex: number) => {
    const gateRecipients = recipients[gateIndex] ? [recipients[gateIndex]] : deps.buildRecipientsFromGates([gate]);
    if (!Array.isArray(gateRecipients) || gateRecipients.length === 0) return;

    const sbtAddresses = collectUniqueSbtAddresses(gate);
    const gateId = normalizeGateLabel(gate?.gateId || gate?.id || gate?.resourceKey) || `gate-${gateIndex}`;
    const dedupeKey = JSON.stringify({
      gateId,
      recipients: gateRecipients,
    });
    if (dedupe.has(dedupeKey)) return;
    dedupe.add(dedupeKey);

    const configuredLabel =
      deps.resolveConfiguredGateLabel({
        gate,
        resourceKey: String(gate?.resourceKey || ''),
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
): GateOption | null => {
  const normalizedGateId = normalizeGateLabel(gateId, deps);
  const options = deps.getResponseGateOptions(questionId);
  if (!options.length) return null;
  if (!normalizedGateId) return options[0];
  return options.find((option) => option.gateId === normalizedGateId) || options[0];
};

export const resolveFieldEncryptionGateId = (
  field: unknown = {},
  questionId: string | null = null,
  fieldKey = 'answer',
  deps: Pick<
    ResponseGateDeps,
    'resolveFieldEncryptionAudience' | 'normalizeGateLabelText' | 'getResponseGateOptionById'
  >,
): string | null => {
  const qid = normalizeQuestionIdKeyCore(questionId);
  const audience = deps.resolveFieldEncryptionAudience(field, qid || null, fieldKey);
  if (audience !== 'gate') return null;

  const fieldRecord = isPlainObject(field) ? field : {};
  const explicitGateId = normalizeGateLabel(fieldRecord.encryptionGateId || '', deps);
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
    field?: unknown;
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
): GateRecipient[] => {
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
  question: unknown,
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
  const normalize = (value: unknown) => normalizeGateLabel(value, deps);
  const readGateNames = (gateList: GateConfig[]): string[] =>
    Array.from(
      new Set(
        (Array.isArray(gateList) ? gateList : [])
          .map((gate) => {
            if (!gate || typeof gate !== 'object') return '';
            const sbtAddresses = collectUniqueSbtAddresses(gate);
            const label = deps.resolveGateDisplayLabel(gate, sbtAddresses[0] || '');
            return normalize(label);
          })
          .filter((label) => label && label !== 'default gate'),
      ),
    );

  const fromQuestion = readGateNames(deps.getQuestionEncryptionGates(question));
  if (fromQuestion.length) return fromQuestion;

  const slug = resolveResponseGateSessionSlug(deps);
  const cfg = deps.resolveEffectiveResponseGateConfig(slug);

  const defaultGateSBTs = Array.isArray(cfg?.defaultGateSBTs) ? cfg.defaultGateSBTs : [];
  const fromDefaultGateSBTs = Array.from(
    new Set<string>(
      defaultGateSBTs
        .map((entry: unknown) => {
          if (typeof entry === 'string') return normalize(entry);
          if (!isPlainObject(entry)) return '';
          return normalize(entry.name || entry.label || entry.title || entry.address);
        })
        .filter(Boolean),
    ),
  );
  if (fromDefaultGateSBTs.length) return fromDefaultGateSBTs;

  const encryptionCfg = isPlainObject(cfg.encryption) ? cfg.encryption : {};
  const sponsoredCfg = isPlainObject(cfg.sponsored) ? cfg.sponsored : {};
  const litCfg = isPlainObject(cfg.lit) ? cfg.lit : {};
  const encryptionGateMap = isPlainObject(encryptionCfg.gates) ? encryptionCfg.gates : null;
  const sponsoredGateMap = isPlainObject(sponsoredCfg.gates) ? sponsoredCfg.gates : null;
  const gateMap =
    encryptionGateMap && Object.keys(encryptionGateMap).length
      ? encryptionGateMap
      : sponsoredGateMap && Object.keys(sponsoredGateMap).length
        ? sponsoredGateMap
        : null;
  const gateIds = gateMap ? Object.keys(gateMap).filter(Boolean).sort() : [];

  const candidateDefaults = [
    litCfg.defaultGateId,
    encryptionCfg.defaultGateId,
    encryptionCfg.primaryGateId,
    sponsoredCfg.defaultGateId,
    gateIds[0],
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  const defaultGateId = candidateDefaults.find((gateId) => gateIds.includes(gateId)) || gateIds[0] || '';

  if (defaultGateId && gateMap?.[defaultGateId] && typeof gateMap[defaultGateId] === 'object') {
    const gate = asGateConfig(gateMap[defaultGateId]);
    if (gate) {
      const fallbackLabel = normalize(gate?.label || gate?.name || gate?.title || defaultGateId);
      const resolvedLabel = normalize(deps.resolveGateDisplayLabel({ ...gate, gateId: defaultGateId }, ''));
      const best = resolvedLabel && resolvedLabel !== 'default gate' ? resolvedLabel : fallbackLabel;
      if (best && best !== 'default gate') return [best];
    }
  }

  const legacyGate = encryptionCfg.gate;
  const fromLegacy = readGateNames(
    legacyGate && typeof legacyGate === 'object' && !Array.isArray(legacyGate) ? [legacyGate as GateConfig] : [],
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

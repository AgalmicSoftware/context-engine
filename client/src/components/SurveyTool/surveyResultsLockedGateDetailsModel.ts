type SurveyResultsLockedGateRecord = Record<string, unknown>;

export type SurveyResultsLockedGateEntry = {
  address?: unknown;
  label?: unknown;
};

export type SurveyResultsLockedGateContextInput = {
  configuredGateMap?: unknown;
  defaultPolicy?: unknown;
  fallbackChainId?: unknown;
  slug?: unknown;
};

export type SurveyResultsLockedGateDetailModel = {
  address: string;
  href: string;
  label: unknown;
};

export type BuildSurveyResultsLockedGateDetailsArgs = {
  baseSlug?: unknown;
  buildSbtDetailPath?: ((address: string, slug: string) => string) | null;
  getQuestionEncryptionGates?: ((question: unknown) => unknown[]) | null;
  getShortenedAddress?: ((address: string, compact?: boolean) => unknown) | null;
  lockedRows?: unknown;
  normalizeGateSbtEntries?: ((gate: unknown) => SurveyResultsLockedGateEntry[]) | null;
  normalizeGateText?: ((value: unknown) => string) | null;
  questionLookup?: unknown;
  readSessionGateContext?: ((questionSlug?: unknown) => SurveyResultsLockedGateContextInput) | null;
  resolveSbtDisplayLabel?:
    ((args: { address: string; chainId?: unknown; fallback?: string; preferredSlug?: unknown }) => unknown) | null;
};

export type SurveyResultsLockedGateDetailsResult = {
  gateDetails: SurveyResultsLockedGateDetailModel[];
  hasGenericGateMessage: boolean;
};

const toRecord = (value: unknown): SurveyResultsLockedGateRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as SurveyResultsLockedGateRecord) : {};

const defaultContext = (): SurveyResultsLockedGateContextInput => ({
  configuredGateMap: {},
  defaultPolicy: {},
  fallbackChainId: null,
  slug: '',
});

const defaultNormalizeGateText = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

export const buildSurveyResultsLockedGateDetails = ({
  baseSlug = '',
  buildSbtDetailPath = null,
  getQuestionEncryptionGates = null,
  getShortenedAddress = null,
  lockedRows = [],
  normalizeGateSbtEntries = null,
  normalizeGateText = defaultNormalizeGateText,
  questionLookup = {},
  readSessionGateContext = defaultContext,
  resolveSbtDisplayLabel = null,
}: BuildSurveyResultsLockedGateDetailsArgs = {}): SurveyResultsLockedGateDetailsResult => {
  const rows = Array.isArray(lockedRows) ? lockedRows.map(toRecord) : [];
  if (rows.length === 0) {
    return { gateDetails: [], hasGenericGateMessage: false };
  }

  const contextPort = typeof readSessionGateContext === 'function' ? readSessionGateContext : defaultContext;
  const questionGatePort = typeof getQuestionEncryptionGates === 'function' ? getQuestionEncryptionGates : () => [];
  const gateEntriesPort = typeof normalizeGateSbtEntries === 'function' ? normalizeGateSbtEntries : () => [];
  const gateTextPort = typeof normalizeGateText === 'function' ? normalizeGateText : defaultNormalizeGateText;
  const displayLabelPort = typeof resolveSbtDisplayLabel === 'function' ? resolveSbtDisplayLabel : () => '';
  const shortenedAddressPort =
    typeof getShortenedAddress === 'function' ? getShortenedAddress : (address: string) => address;
  const detailPathPort = typeof buildSbtDetailPath === 'function' ? buildSbtDetailPath : (address: string) => address;

  const detailsByAddress = new Map<string, SurveyResultsLockedGateDetailModel>();
  let hasGenericGateMessage = false;

  const addGate = (gateInput: unknown, contextInput: SurveyResultsLockedGateContextInput): void => {
    const gate = toRecord(gateInput);
    const context = toRecord(contextInput);
    const configuredGateMap = toRecord(context.configuredGateMap);
    const configuredGate = configuredGateMap[gateTextPort(gate.gateId || gate.id)] || null;
    const gateEntries = [...gateEntriesPort(configuredGate), ...gateEntriesPort(gate)];
    if (!gateEntries.length) {
      hasGenericGateMessage = true;
      return;
    }
    gateEntries.forEach((entry) => {
      const address = String(entry.address || '').trim();
      const key = address.toLowerCase();
      if (!key) return;
      if (detailsByAddress.has(key)) return;
      const slug = String(context.slug || '').trim();
      const displayLabel = displayLabelPort({
        address,
        preferredSlug: slug,
        chainId: context.fallbackChainId,
        fallback: 'short',
      });
      detailsByAddress.set(key, {
        address,
        label: displayLabel || entry.label || shortenedAddressPort(address, true),
        href: detailPathPort(address, slug),
      });
    });
  };

  const questionsById = toRecord(questionLookup);
  rows.forEach((row) => {
    const qid = String(row.questionId || '')
      .trim()
      .toLowerCase();
    const question = toRecord(questionsById[qid]);
    const gateContext = contextPort(question.sessionSlug || baseSlug);
    const questionGates = questionGatePort(Object.keys(question).length ? question : null);
    if (questionGates.length > 0) {
      const beforeSize = detailsByAddress.size;
      questionGates.forEach((gate) => addGate(gate, gateContext));
      if (detailsByAddress.size > beforeSize) return;
    }
    const defaultGates = Array.isArray(toRecord(gateContext.defaultPolicy).gates)
      ? (toRecord(gateContext.defaultPolicy).gates as unknown[])
      : [];
    if (defaultGates.length > 0) {
      const beforeSize = detailsByAddress.size;
      defaultGates.forEach((gate) => addGate(gate, gateContext));
      if (detailsByAddress.size > beforeSize) return;
    }
    hasGenericGateMessage = true;
  });

  return {
    gateDetails: Array.from(detailsByAddress.values()),
    hasGenericGateMessage,
  };
};

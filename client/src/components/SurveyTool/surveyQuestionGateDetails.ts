type GateDetailRecord = Record<string, any>;

type BuildLockedQuestionGateDetailsArgs = {
  hiddenMaskedQuestionIds?: unknown;
  pool?: unknown;
  slug?: unknown;
  getQuestionEncryptionGates?: (question: unknown) => GateDetailRecord[];
  normalizeGateLabelText?: (value: unknown) => string;
  resolveConfiguredGateLabel?: (args: {
    gate: GateDetailRecord;
    resourceKey: string;
    sbtAddresses: string[];
  }) => string;
  resolveSbtGateLabel?: (address: string, preferredSlug?: string) => string;
  getShortenedAddress?: (address: string, full: boolean) => string;
  buildSbtDetailPath?: (address: string, sessionSlug: string) => string;
  normalizeSessionSlug?: (value: unknown) => string;
  getChecksumAddress?: (address: string) => string;
  translate?: (key: string) => string;
};

type LockedQuestionGateDetailDraft = {
  id: string;
  label: string;
  sbtAddresses: string[];
  questionIds: Set<string>;
  sessionSlug: string;
};

const normalizeLabelDefault = (value: unknown): string => String(value || '').trim();
const normalizeSessionSlugDefault = (value: unknown): string => String(value || '').trim().toLowerCase();
const identityChecksum = (address: string): string => address;
const fallbackShortAddress = (address: string): string => address;
const fallbackDetailPath = (address: string, sessionSlug: string): string => (
  sessionSlug ? `/sbt/${sessionSlug}/${address}` : `/sbt/${address}`
);
const fallbackTranslate = (key: string): string => key;

export const isGenericResourceGateLabel = (value: unknown): boolean => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  return [
    'questionresponses',
    'surveyresponses',
    'responses',
    'questionresponse',
    'surveyresponse',
    'default',
    'default gate',
  ].includes(normalized);
};

const collectUniqueGateSbtAddresses = (gate: GateDetailRecord = {}): string[] => (
  Array.from(new Set(
    [
      ...(Array.isArray(gate?.sbtAddresses) ? gate.sbtAddresses : []),
      gate?.sbtAddress,
    ]
      .map((addr) => String(addr || '').trim())
      .filter(Boolean)
  ))
);

export const buildLockedQuestionGateDetailsFromPool = ({
  hiddenMaskedQuestionIds = [],
  pool = [],
  slug = '',
  getQuestionEncryptionGates = () => [],
  normalizeGateLabelText = normalizeLabelDefault,
  resolveConfiguredGateLabel = () => '',
  resolveSbtGateLabel = () => '',
  getShortenedAddress = fallbackShortAddress,
  buildSbtDetailPath = fallbackDetailPath,
  normalizeSessionSlug = normalizeSessionSlugDefault,
  getChecksumAddress = identityChecksum,
  translate = fallbackTranslate,
}: BuildLockedQuestionGateDetailsArgs = {}) => {
  const hiddenIds = new Set(
    (Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : [])
      .map((qid) => String(qid || '').trim().toLowerCase())
      .filter(Boolean)
  );
  if (hiddenIds.size === 0) return [];

  const normalizedSlug = String(slug || '').trim().toLowerCase();
  const detailsByKey = new Map<string, LockedQuestionGateDetailDraft>();

  (Array.isArray(pool) ? pool : []).forEach((question) => {
    const questionRecord = (question && typeof question === 'object') ? question as GateDetailRecord : {};
    const questionId = String(questionRecord?.id || '').trim().toLowerCase();
    if (!hiddenIds.has(questionId)) return;
    const gates = getQuestionEncryptionGates(questionRecord);
    const questionSessionSlug = normalizeSessionSlug(questionRecord?.sessionSlug || normalizedSlug);

    gates.forEach((gate, gateIndex) => {
      const gateRecord = (gate && typeof gate === 'object') ? gate : {};
      const sbtAddresses = collectUniqueGateSbtAddresses(gateRecord);
      const configuredLabel = normalizeGateLabelText(
        resolveConfiguredGateLabel({
          gate: gateRecord,
          resourceKey: String(gateRecord?.resourceKey || ''),
          sbtAddresses,
        })
      );
      const explicitLabel = normalizeGateLabelText(
        gateRecord?.label || gateRecord?.name || gateRecord?.title || ''
      );
      const maybeGateId = normalizeGateLabelText(gateRecord?.gateId || gateRecord?.id || '');
      const sbtLabelFallback = sbtAddresses.length > 0
        ? `${resolveSbtGateLabel(sbtAddresses[0], normalizedSlug) || getShortenedAddress(sbtAddresses[0], false)} gate`
        : 'Question gate';
      const label = !isGenericResourceGateLabel(configuredLabel)
        ? configuredLabel
        : !isGenericResourceGateLabel(explicitLabel)
          ? explicitLabel
          : (!isGenericResourceGateLabel(maybeGateId) ? maybeGateId : sbtLabelFallback);
      const key = `${String(label || `gate-${gateIndex}`).toLowerCase()}|${sbtAddresses
        .map((addr) => String(addr).toLowerCase())
        .sort()
        .join('|')}`;

      if (!detailsByKey.has(key)) {
        detailsByKey.set(key, {
          id: key || `${questionId}:${gateIndex}`,
          label: label || translate('gate'),
          sbtAddresses: [],
          questionIds: new Set(),
          sessionSlug: questionSessionSlug,
        });
      }

      const detail = detailsByKey.get(key);
      if (!detail) return;
      detail.questionIds.add(questionId);
      if (!detail.sessionSlug && questionSessionSlug) detail.sessionSlug = questionSessionSlug;
      sbtAddresses.forEach((address) => {
        const checksum = getChecksumAddress(address);
        if (!detail.sbtAddresses.includes(checksum)) detail.sbtAddresses.push(checksum);
      });
    });
  });

  return Array.from(detailsByKey.values()).map((detail) => ({
    ...detail,
    questionCount: detail.questionIds.size,
    sbts: detail.sbtAddresses.map((address) => ({
      address,
      label: resolveSbtGateLabel(address, detail.sessionSlug || normalizedSlug) || getShortenedAddress(address, false),
      href: buildSbtDetailPath(address, detail.sessionSlug || normalizedSlug),
    })),
  }));
};

export const buildLockedGateRequirementSentence = (
  lockedGateDetails: unknown = [],
  {
    translate = fallbackTranslate,
  }: {
    translate?: (key: string) => string;
  } = {},
): string => {
  const labels = Array.from(new Set(
    (Array.isArray(lockedGateDetails) ? lockedGateDetails : [])
      .flatMap((gate) => {
        const record = (gate && typeof gate === 'object') ? gate as GateDetailRecord : {};
        return Array.isArray(record?.sbts) ? record.sbts : [];
      })
      .map((sbt) => String(sbt?.label || sbt?.address || '').trim())
      .filter(Boolean)
  ));
  if (!labels.length) return '';
  const shown = labels.slice(0, 3);
  const extra = labels.length > shown.length ? ` +${labels.length - shown.length} more` : '';
  return `${translate('sbt')}${labels.length === 1 ? '' : 's'} required: ${shown.join(', ')}${extra}.`;
};

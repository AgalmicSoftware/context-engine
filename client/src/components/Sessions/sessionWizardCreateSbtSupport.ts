import { toStr } from '../../utilities/shared/primitives.js';

type SessionWizardCreateSbtGate = Record<string, unknown> & {
  id?: unknown;
  gateId?: unknown;
  label?: unknown;
  mode?: unknown;
  color?: unknown;
  sbts?: unknown;
};

type SessionWizardCreateSbtLaunchOptions = Record<string, unknown> & {
  targetType?: unknown;
  gateId?: unknown;
  sessionSlug?: unknown;
  arweaveJwkOverride?: unknown;
};

type SessionWizardCreateSbtLaunchState = {
  targetType: unknown;
  gateId: string;
  sessionSlug: string;
  arweaveJwkOverride: string;
};
type SessionWizardNetworkLike = Record<string, unknown> & {
  id?: unknown;
  chainId?: unknown;
  name?: unknown;
};
type SessionWizardSbtSelection = Record<string, unknown> & {
  address?: unknown;
};
type BuildSessionWizardDeferredCreateSbtComponentPropsArgs = {
  account?: unknown;
  accountOverride?: unknown;
  defaultGateId?: unknown;
  draft?: Record<string, unknown> | null;
  encryptionGates?: SessionWizardCreateSbtGate[];
  getChainById?: (chainId: number | null) => SessionWizardNetworkLike | null | undefined;
  getChainName?: (chainId: number | null) => string;
  getEnabledWorkerArweaveJwk?: (secrets: unknown) => unknown;
  network?: SessionWizardNetworkLike | null;
  normalizeSbtSelection?: (value: unknown) => SessionWizardSbtSelection[];
  normalizeWorkerAuthUrl?: (value: unknown) => string;
  provider?: unknown;
  registryChainId?: unknown;
  resolvedActiveSessionSlug?: unknown;
  resolvedWalletAccount?: unknown;
  sessionSlugOverride?: unknown;
  signAdminAction?: unknown;
  toggleLoginModal?: unknown;
  workerSecrets?: unknown;
  workerUrlOverride?: unknown;
};

export const getSessionWizardGateById = (
  gates: SessionWizardCreateSbtGate[] = [],
  gateId: unknown,
): SessionWizardCreateSbtGate | null => gates.find((gate) => toStr(gate?.id).trim() === toStr(gateId).trim()) || null;

export const resolveSessionWizardCreateSbtTargetGateId = ({
  allEncryptionGates = [],
  defaultGateId = '',
  requestedGateId = '',
}: {
  allEncryptionGates?: SessionWizardCreateSbtGate[];
  defaultGateId?: unknown;
  requestedGateId?: unknown;
} = {}): string => {
  const validGateIds = allEncryptionGates.map((gate) => toStr(gate?.id).trim()).filter(Boolean);
  const requested = toStr(requestedGateId).trim();
  if (requested && validGateIds.includes(requested)) return requested;
  const fallback = toStr(defaultGateId).trim();
  if (fallback && validGateIds.includes(fallback)) return fallback;
  return validGateIds[0] || '';
};

export const buildSessionWizardCreateSbtModalLaunchState = ({
  options = {},
  allEncryptionGates = [],
  defaultGateId = '',
  currentDraftSlug = '',
  currentArweaveJwk = '',
}: {
  options?: SessionWizardCreateSbtLaunchOptions;
  allEncryptionGates?: SessionWizardCreateSbtGate[];
  defaultGateId?: unknown;
  currentDraftSlug?: unknown;
  currentArweaveJwk?: unknown;
} = {}): SessionWizardCreateSbtLaunchState => ({
  targetType: options?.targetType || 'gate',
  gateId: resolveSessionWizardCreateSbtTargetGateId({
    allEncryptionGates,
    defaultGateId,
    requestedGateId: options?.gateId || '',
  }),
  sessionSlug: toStr(
    Object.prototype.hasOwnProperty.call(options, 'sessionSlug') ? options.sessionSlug : currentDraftSlug || '',
  ).trim(),
  arweaveJwkOverride: toStr(
    Object.prototype.hasOwnProperty.call(options, 'arweaveJwkOverride')
      ? options.arweaveJwkOverride
      : currentArweaveJwk,
  ).trim(),
});

export const resolveSessionWizardCreateSbtModalPlan = ({
  createSbtModalState = null,
  draft = {},
  getChainById = () => null,
  getChainName = () => '',
  getEnabledWorkerArweaveJwk = () => '',
  network = null,
  registryChainId = null,
  resolvedActiveSessionSlug = '',
  workerSecretsEnabled = false,
}: ResolveSessionWizardCreateSbtModalPlanArgs = {}): SessionWizardCreateSbtModalPlan => {
  const draftRecord = draft && typeof draft === 'object' ? draft : {};
  const modalState = createSbtModalState && typeof createSbtModalState === 'object' ? createSbtModalState : {};
  const chainId = Number(draftRecord.networkChainId || registryChainId || network?.id || network?.chainId || 0) || null;
  const resolvedNetwork =
    getChainById(chainId) ||
    (chainId ? { id: chainId, name: getChainName(chainId) || `Chain ${chainId}` } : network || { id: null, name: '' });
  const sessionSlug = toStr(modalState.sessionSlug || draftRecord.slug || resolvedActiveSessionSlug || '').trim();
  const arweaveJwkOverride = workerSecretsEnabled
    ? toStr(modalState.arweaveJwkOverride || getEnabledWorkerArweaveJwk()).trim()
    : '';

  return {
    arweaveJwkOverride,
    chainId,
    network: resolvedNetwork,
    sessionSlug,
  };
};

export const buildSessionWizardDeferredCreateSbtComponentProps = ({
  account = '',
  accountOverride = '',
  defaultGateId = '',
  draft = {},
  encryptionGates = [],
  getChainById = () => null,
  getChainName = () => '',
  getEnabledWorkerArweaveJwk = () => '',
  network = null,
  normalizeSbtSelection = (value) => (Array.isArray(value) ? (value as SessionWizardSbtSelection[]) : []),
  normalizeWorkerAuthUrl = (value) => toStr(value).trim(),
  provider = null,
  registryChainId = null,
  resolvedActiveSessionSlug = '',
  resolvedWalletAccount = '',
  sessionSlugOverride = '',
  signAdminAction = null,
  toggleLoginModal = null,
  workerSecrets = null,
  workerUrlOverride = '',
}: BuildSessionWizardDeferredCreateSbtComponentPropsArgs = {}) => {
  const draftRecord = draft && typeof draft === 'object' ? draft : {};
  const chainId =
    Number(draftRecord?.networkChainId || registryChainId || network?.id || network?.chainId || 0) || null;
  const sessionSlug = toStr(sessionSlugOverride || draftRecord?.slug || resolvedActiveSessionSlug || '').trim();
  const resolvedNetwork =
    getChainById(chainId) ||
    (chainId ? { id: chainId, name: getChainName(chainId) || `Chain ${chainId}` } : network || { id: null, name: '' });

  return {
    account: toStr(accountOverride || resolvedWalletAccount || account).trim(),
    provider,
    network: resolvedNetwork,
    loginComplete: true,
    toggleLoginModal,
    sessionSlug,
    sessionConfigOverride: {
      ...draftRecord,
      slug: sessionSlug,
      corsWorkerUrl: normalizeWorkerAuthUrl(toStr(workerUrlOverride || draftRecord?.corsWorkerUrl).trim()),
      networkChainId: chainId,
      contracts: draftRecord && typeof draftRecord?.contracts === 'object' ? draftRecord.contracts : {},
    },
    arweaveJwkOverride: getEnabledWorkerArweaveJwk(workerSecrets),
    encryptionGates: (Array.isArray(encryptionGates) ? encryptionGates : []).map((gate) => ({
      id: gate.id,
      gateId: gate.id,
      label: gate.label,
      name: gate.label,
      color: gate.color,
      mode: gate.mode,
      requireAll: gate.mode === 'all',
      sbtAddresses: normalizeSbtSelection(gate.sbts || []).map((entry) => entry.address),
      chainId,
    })),
    defaultGateId: defaultGateId || encryptionGates[0]?.id || '',
    defaultSbtTags: draftRecord?.defaultSbtTags || '',
    deferredDeploy: true,
    attemptImmediateDeferredUpload: true,
    hideNetworkSelector: true,
    preferDirectArweaveUpload: false,
    signAdminAction,
  };
};

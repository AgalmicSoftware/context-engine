import { toStr } from '../../utilities/shared/primitives.js';

type SessionWizardCreateSbtGate = Record<string, unknown> & {
  id?: unknown;
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

export const getSessionWizardGateById = (
  gates: SessionWizardCreateSbtGate[] = [],
  gateId: unknown,
): SessionWizardCreateSbtGate | null => (
  gates.find((gate) => toStr(gate?.id).trim() === toStr(gateId).trim()) || null
);

export const resolveSessionWizardCreateSbtTargetGateId = ({
  allEncryptionGates = [],
  defaultGateId = '',
  requestedGateId = '',
}: {
  allEncryptionGates?: SessionWizardCreateSbtGate[];
  defaultGateId?: unknown;
  requestedGateId?: unknown;
} = {}): string => {
  const validGateIds = allEncryptionGates
    .map((gate) => toStr(gate?.id).trim())
    .filter(Boolean);
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
    Object.prototype.hasOwnProperty.call(options, 'sessionSlug')
      ? options.sessionSlug
      : currentDraftSlug || ''
  ).trim(),
  arweaveJwkOverride: toStr(
    Object.prototype.hasOwnProperty.call(options, 'arweaveJwkOverride')
      ? options.arweaveJwkOverride
      : currentArweaveJwk
  ).trim(),
});

import { toStr } from '../../utilities/shared/primitives.js';
import type { AnyRecord } from '../shellTypes';

export const getSessionWizardGateById = (
  gates: AnyRecord[] = [],
  gateId: unknown,
): AnyRecord | null => (
  gates.find((gate) => toStr(gate?.id).trim() === toStr(gateId).trim()) || null
);

export const resolveSessionWizardCreateSbtTargetGateId = ({
  allEncryptionGates = [],
  defaultGateId = '',
  requestedGateId = '',
}: {
  allEncryptionGates?: AnyRecord[];
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
  options?: AnyRecord;
  allEncryptionGates?: AnyRecord[];
  defaultGateId?: unknown;
  currentDraftSlug?: unknown;
  currentArweaveJwk?: unknown;
} = {}): AnyRecord => ({
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

import { toStr } from '../../utilities/shared/primitives.js';
import { normalizeSbtSelection } from './sessionWizardSbtSelections';

type SessionWizardResourceGate = Record<string, unknown> & {
  id?: unknown;
  label?: unknown;
  color?: unknown;
  mode?: unknown;
  chainId?: unknown;
  perMemberLimit?: unknown;
  sbts?: unknown;
};

type SessionWizardGateOption = {
  id: unknown;
  label: unknown;
  color: unknown;
};

type SessionWizardResolvedResourceGate = {
  gateId: string;
  gateIds: string[];
  sbts: Array<{ address: string; name: string }>;
  mode: 'all' | 'any';
  chainId: number | null;
  perMemberLimit: number;
  hasConflicts: boolean;
  conflictSummary: {
    modeConflicts: boolean;
    chainIdConflicts: boolean;
    perMemberLimitConflicts: boolean;
  };
  registryRepresentable: boolean;
  registryUnsupportedReason: string;
};

export const buildSessionWizardGateOptions = (gates: SessionWizardResourceGate[] = []): SessionWizardGateOption[] =>
  gates.map((gate) => ({
    id: gate.id,
    label: gate.label,
    color: gate.color,
  }));

export const normalizeSessionWizardGateIds = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((id) => toStr(id).trim()).filter(Boolean);
  }
  const raw = toStr(value).trim();
  return raw ? [raw] : [];
};

const getSessionWizardGateOptionValue = (option: SessionWizardResourceGateOptionLike): string =>
  toStr(option?.value ?? option?.id).trim();

export const resolveSessionWizardResourceGateSelectionState = ({
  value = '',
  fallbackGateId = '',
  gateOptions = [],
}: SessionWizardResourceGateSelectionInput = {}): SessionWizardResourceGateSelectionStatePlan => {
  const availableGateIds = gateOptions.map((option) => getSessionWizardGateOptionValue(option)).filter(Boolean);
  const resolvedFallbackGateId = toStr(fallbackGateId).trim() || availableGateIds[0] || '';
  const selectedGateIds = normalizeSessionWizardGateIds(value || resolvedFallbackGateId).filter((id) =>
    availableGateIds.includes(id),
  );

  return {
    availableGateIds,
    disabled: availableGateIds.length <= 1,
    fallbackGateId: resolvedFallbackGateId,
    selectedGateIds,
  };
};

export const resolveSessionWizardResourceGateSelectionUpdate = ({
  nextIds = [],
  availableGateIds = [],
  fallbackGateId = '',
}: SessionWizardResourceGateSelectionUpdateInput = {}): SessionWizardResourceGateSelectionState => {
  const filteredGateIds = normalizeSessionWizardGateIds(nextIds).filter((id) => availableGateIds.includes(id));
  if (!filteredGateIds.length) return toStr(fallbackGateId).trim() || '';
  return filteredGateIds.length === 1 ? filteredGateIds[0] : filteredGateIds;
};

export const resolveSessionWizardResourceGateIds = (
  value: unknown,
  fallbackGateId: unknown,
  encryptionGates: SessionWizardResourceGate[] = [],
): string[] => {
  const availableGateIds = encryptionGates.map((gate) => toStr(gate?.id).trim()).filter(Boolean);
  const requestedGateIds = normalizeSessionWizardGateIds(value).filter((id) => availableGateIds.includes(id));
  const fallback = toStr(fallbackGateId).trim();
  if (requestedGateIds.length > 0) return requestedGateIds;
  if (fallback && availableGateIds.includes(fallback)) return [fallback];
  return availableGateIds[0] ? [availableGateIds[0]] : [];
};

export const resolveSessionWizardResourceGate = (
  value: unknown,
  fallbackGateId: unknown,
  encryptionGates: SessionWizardResourceGate[] = [],
): SessionWizardResolvedResourceGate | null => {
  const gateIds = resolveSessionWizardResourceGateIds(value, fallbackGateId, encryptionGates);
  if (!gateIds.length) return null;
  const gatesById = new Map<string, SessionWizardResourceGate>();
  gateIds.forEach((gateId) => {
    const gate = encryptionGates.find((entry) => toStr(entry?.id).trim() === gateId);
    if (!gate) return;
    gatesById.set(gateId, gate);
  });
  const resolvedGateIds = Array.from(gatesById.keys());
  const selectedGates = Array.from(gatesById.values());
  if (!selectedGates.length) return null;

  const sbtAddressSet = new Set<string>();
  selectedGates.forEach((gate) => {
    normalizeSbtSelection(gate.sbts || []).forEach((entry) => {
      const address = toStr(entry?.address).trim();
      if (address) sbtAddressSet.add(address);
    });
  });
  const sbtAddresses = Array.from(sbtAddressSet);

  const primaryGate = selectedGates[0];
  const gateId = toStr(primaryGate?.id).trim();
  const modeSet = new Set(selectedGates.map((gate) => (toStr(gate?.mode).trim() === 'all' ? 'all' : 'any')));
  const chainIdSet = new Set(selectedGates.map((gate) => Number(gate?.chainId || 0) || null));
  const perMemberLimitSet = new Set(selectedGates.map((gate) => Number(gate?.perMemberLimit || 0) || 0));
  const modeConflicts = modeSet.size > 1;
  const chainIdConflicts = chainIdSet.size > 1;
  const perMemberLimitConflicts = perMemberLimitSet.size > 1;
  const hasConflicts = modeConflicts || chainIdConflicts || perMemberLimitConflicts;
  const hasAllMode = modeSet.has('all');
  const hasUnrepresentableAllGroup = resolvedGateIds.length > 1 && hasAllMode;
  const mode = toStr(primaryGate?.mode).trim() === 'all' ? 'all' : 'any';
  const chainId = Number(primaryGate?.chainId || 0) || null;
  const perMemberLimit = Number(primaryGate?.perMemberLimit || 0) || 0;
  const sbts = sbtAddresses.map((address) => ({ address, name: address }));
  return {
    gateId,
    gateIds: resolvedGateIds,
    sbts,
    mode,
    chainId,
    perMemberLimit,
    hasConflicts,
    conflictSummary: {
      modeConflicts,
      chainIdConflicts,
      perMemberLimitConflicts,
    },
    registryRepresentable: !hasConflicts && !hasUnrepresentableAllGroup,
    registryUnsupportedReason: hasUnrepresentableAllGroup
      ? 'multiple gates with All semantics cannot be encoded as one registry gate'
      : '',
  };
};

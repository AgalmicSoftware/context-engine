import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { notify as defaultNotify } from '../../../utilities/ui/notify.js';
import { toStr } from '../../../utilities/shared/primitives.js';
import {
  buildPendingSbtSelection,
  dedupeSbtSelection,
  normalizeSbtSelection,
  promotePendingSbtSelectionsAfterDeploy,
  serializeDefaultFeaturedSbtSelections,
} from '../sessionWizardSbtSelections';
import {
  FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID,
  FEATURED_DRAFT_GATE_AUTO_LINK_SOURCE,
  normalizeFeaturedDraftGateAutoLink,
} from '../sessionWizardPendingSbtPublish';
import { getSessionWizardGateById } from '../sessionWizardCreateSbtSupport';
import { normalizePendingSbtDrafts, type PendingSbtDraft } from './usePendingSbtDrafts.js';
import type { AnyRecord, ChainIdLike, NetworkLike } from '../../shellTypes';

type StateUpdater<T> = (nextValueOrUpdater: T | ((prev: T) => T)) => void;

type EncryptionGateLike = AnyRecord & {
  id?: string;
  sbts?: unknown;
};

type CreateSbtModalStateLike = AnyRecord & {
  targetType?: string;
  gateId?: unknown;
};

type UseSessionWizardPendingSbtControllerOptions<TGate extends EncryptionGateLike = EncryptionGateLike> = {
  allEncryptionGates: TGate[];
  createSbtModalState: CreateSbtModalStateLike;
  draftDefaultFeaturedSBTs?: unknown;
  draftRef: MutableRefObject<AnyRecord>;
  encryptionGates: TGate[];
  featuredDraftGateAutoLink?: AnyRecord | null;
  network?: NetworkLike;
  pendingSbtDeployContextSignature: string;
  pendingSbtDrafts: PendingSbtDraft[];
  registryChainId?: ChainIdLike;
  closeCreateSbtModal: () => void;
  resolveCreateSbtTargetGateId: (requestedGateId?: unknown) => string;
  setEncryptionGates: StateUpdater<TGate[]>;
  setFeaturedDraftGateAutoLink: StateUpdater<AnyRecord | null>;
  setPendingSbtDrafts: StateUpdater<PendingSbtDraft[]>;
  setStatus: StateUpdater<string>;
  updateDraftValue: (path: string[], value: unknown) => void;
  notifySuccess?: (message: string) => void;
};

const notifySuccessDefault = (message: string) => defaultNotify.success(message);

const useSessionWizardPendingSbtController = <TGate extends EncryptionGateLike = EncryptionGateLike>({
  allEncryptionGates,
  createSbtModalState,
  draftDefaultFeaturedSBTs,
  draftRef,
  encryptionGates,
  featuredDraftGateAutoLink = null,
  network,
  pendingSbtDeployContextSignature,
  pendingSbtDrafts,
  registryChainId,
  closeCreateSbtModal,
  resolveCreateSbtTargetGateId,
  setEncryptionGates,
  setFeaturedDraftGateAutoLink,
  setPendingSbtDrafts,
  setStatus,
  updateDraftValue,
  notifySuccess = notifySuccessDefault,
}: UseSessionWizardPendingSbtControllerOptions<TGate>) => {
  const pendingSbtSelectorOptions = useMemo(
    () =>
      normalizePendingSbtDrafts(pendingSbtDrafts).map((draftEntry) => ({
        address: draftEntry.predictedAddress,
        name: `${draftEntry.displayName} (Pending)`,
        pending: true,
        metadataPreview: draftEntry.metadataPreview || null,
      })),
    [pendingSbtDrafts],
  );

  const getGateById = useCallback(
    (gateId: unknown): TGate | null => getSessionWizardGateById(allEncryptionGates, gateId) as TGate | null,
    [allEncryptionGates],
  );

  const updateEncryptionGate = useCallback(
    (gateId: string, updates: Partial<TGate>) => {
      const normalizedUpdates: Partial<TGate> = { ...updates };
      if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'sbts')) {
        normalizedUpdates.sbts = dedupeSbtSelection(normalizedUpdates.sbts || []) as TGate['sbts'];
      }
      setEncryptionGates((prev) =>
        prev.map((gate) => (gate.id === gateId ? ({ ...gate, ...normalizedUpdates } as TGate) : gate)),
      );
    },
    [setEncryptionGates],
  );

  const clearFeaturedDraftGateAutoLink = useCallback(
    (address: unknown = '') => {
      const addressLower = toStr(address).trim().toLowerCase();
      setFeaturedDraftGateAutoLink((prev) => {
        const current = normalizeFeaturedDraftGateAutoLink(prev);
        if (!current) return prev;
        if (addressLower && current.address.toLowerCase() !== addressLower) return prev;
        return null;
      });
    },
    [setFeaturedDraftGateAutoLink],
  );

  const dismissFeaturedDraftGateAutoLink = useCallback(
    ({ gateId = '', address = '' }: AnyRecord = {}) => {
      const gateIdStr = toStr(gateId).trim();
      const addressLower = toStr(address).trim().toLowerCase();
      setFeaturedDraftGateAutoLink((prev) => {
        const current = normalizeFeaturedDraftGateAutoLink(prev);
        if (!current) return prev;
        if (gateIdStr && toStr(current.gateId).trim() !== gateIdStr) return prev;
        if (addressLower && current.address.toLowerCase() !== addressLower) return prev;
        if (current.dismissed) return prev;
        return { ...current, dismissed: true };
      });
    },
    [setFeaturedDraftGateAutoLink],
  );

  const handleGateAddSbt = useCallback(
    (gateId: unknown, sbt: unknown) => {
      const gateIdStr = toStr(gateId).trim();
      const nextSbt = normalizeSbtSelection([sbt])[0];
      if (!gateIdStr || !nextSbt) return;
      const autoLink = normalizeFeaturedDraftGateAutoLink(featuredDraftGateAutoLink);
      const nextAddressLower = toStr(nextSbt?.address).trim().toLowerCase();
      if (
        autoLink &&
        autoLink.dismissed !== true &&
        toStr(autoLink.gateId).trim() === gateIdStr &&
        nextAddressLower &&
        nextAddressLower !== autoLink.address.toLowerCase()
      ) {
        dismissFeaturedDraftGateAutoLink({ gateId: gateIdStr });
      }
      const targetGate = getGateById(gateIdStr);
      updateEncryptionGate(gateIdStr, {
        sbts: [...normalizeSbtSelection(targetGate?.sbts || []), nextSbt],
      } as Partial<TGate>);
    },
    [dismissFeaturedDraftGateAutoLink, featuredDraftGateAutoLink, getGateById, updateEncryptionGate],
  );

  const handleGateRemoveSbt = useCallback(
    (gateId: unknown, address: unknown) => {
      const gateIdStr = toStr(gateId).trim();
      const addressLower = toStr(address).trim().toLowerCase();
      if (!gateIdStr || !addressLower) return;
      const autoLink = normalizeFeaturedDraftGateAutoLink(featuredDraftGateAutoLink);
      if (autoLink && toStr(autoLink.gateId).trim() === gateIdStr && autoLink.address.toLowerCase() === addressLower) {
        dismissFeaturedDraftGateAutoLink({ gateId: gateIdStr, address: toStr(address).trim() });
      }
      const targetGate = getGateById(gateIdStr);
      updateEncryptionGate(gateIdStr, {
        sbts: normalizeSbtSelection(targetGate?.sbts || []).filter(
          (sbt) => toStr(sbt.address).toLowerCase() !== addressLower,
        ),
      } as Partial<TGate>);
    },
    [dismissFeaturedDraftGateAutoLink, featuredDraftGateAutoLink, getGateById, updateEncryptionGate],
  );

  const handleRemoveDefaultFeaturedSbt = useCallback(
    (address: unknown) => {
      const addressLower = toStr(address).trim().toLowerCase();
      if (!addressLower) return;
      const nextSelections = normalizeSbtSelection(draftRef.current?.defaultFeaturedSBTs || []).filter(
        (sbt) => toStr(sbt.address).toLowerCase() !== addressLower,
      );
      updateDraftValue(['defaultFeaturedSBTs'], serializeDefaultFeaturedSbtSelections(nextSelections));

      const autoLink = normalizeFeaturedDraftGateAutoLink(featuredDraftGateAutoLink);
      if (
        !autoLink ||
        autoLink.dismissed === true ||
        toStr(autoLink.source).trim() !== FEATURED_DRAFT_GATE_AUTO_LINK_SOURCE ||
        autoLink.address.toLowerCase() !== addressLower
      ) {
        return;
      }

      clearFeaturedDraftGateAutoLink(address);
      const gateId = toStr(autoLink.gateId).trim() || FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID;
      const targetGate = getGateById(gateId);
      updateEncryptionGate(gateId, {
        sbts: normalizeSbtSelection(targetGate?.sbts || []).filter(
          (sbt) => toStr(sbt.address).toLowerCase() !== addressLower,
        ),
      } as Partial<TGate>);
    },
    [
      clearFeaturedDraftGateAutoLink,
      draftRef,
      featuredDraftGateAutoLink,
      getGateById,
      updateDraftValue,
      updateEncryptionGate,
    ],
  );

  const promoteDeployedPendingSbtSelections = useCallback(
    (deployedDrafts: unknown[] = []) => {
      const normalizedDeployedDrafts = normalizePendingSbtDrafts(deployedDrafts);
      if (!normalizedDeployedDrafts.length) return;
      const deployedAddressSet = new Set(
        normalizedDeployedDrafts
          .map((entry) =>
            toStr(entry?.deployedAddress || entry?.predictedAddress)
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      );
      if (!deployedAddressSet.size) return;

      setEncryptionGates((prev) =>
        prev.map(
          (gate) =>
            ({
              ...gate,
              sbts: promotePendingSbtSelectionsAfterDeploy({
                selections: gate?.sbts || [],
                deployedDrafts: normalizedDeployedDrafts,
              }),
            }) as TGate,
        ),
      );
      updateDraftValue(
        ['defaultFeaturedSBTs'],
        serializeDefaultFeaturedSbtSelections(
          promotePendingSbtSelectionsAfterDeploy({
            selections: draftRef.current?.defaultFeaturedSBTs || [],
            deployedDrafts: normalizedDeployedDrafts,
          }),
        ),
      );
      setFeaturedDraftGateAutoLink((prev) => {
        const current = normalizeFeaturedDraftGateAutoLink(prev);
        if (!current) return prev;
        return deployedAddressSet.has(current.address.toLowerCase()) ? null : prev;
      });
    },
    [draftRef, setEncryptionGates, setFeaturedDraftGateAutoLink, updateDraftValue],
  );

  const prunePendingSbtSelections = useCallback(
    (addressLowerSet: Set<string>) => {
      if (!(addressLowerSet instanceof Set) || addressLowerSet.size === 0) return;
      setEncryptionGates((prev) =>
        prev.map(
          (gate) =>
            ({
              ...gate,
              sbts: normalizeSbtSelection(gate?.sbts || []).filter(
                (sbt) => !addressLowerSet.has(toStr(sbt?.address).trim().toLowerCase()),
              ),
            }) as TGate,
        ),
      );
      updateDraftValue(
        ['defaultFeaturedSBTs'],
        serializeDefaultFeaturedSbtSelections(
          normalizeSbtSelection(draftRef.current?.defaultFeaturedSBTs || []).filter(
            (entry) => !addressLowerSet.has(toStr(entry?.address).trim().toLowerCase()),
          ),
        ),
      );
    },
    [draftRef, setEncryptionGates, updateDraftValue],
  );

  const pruneAllPendingSbtSelections = useCallback(() => {
    setEncryptionGates((prev) =>
      prev.map(
        (gate) =>
          ({
            ...gate,
            sbts: normalizeSbtSelection(gate?.sbts || []).filter((sbt) => sbt?.pending !== true),
          }) as TGate,
      ),
    );
    updateDraftValue(
      ['defaultFeaturedSBTs'],
      serializeDefaultFeaturedSbtSelections(
        normalizeSbtSelection(draftRef.current?.defaultFeaturedSBTs || []).filter((entry) => entry?.pending !== true),
      ),
    );
  }, [draftRef, setEncryptionGates, updateDraftValue]);

  const removePendingSbtDraft = useCallback(
    (predictedAddress: unknown) => {
      const addressLower = toStr(predictedAddress).trim().toLowerCase();
      if (!addressLower) return;
      setPendingSbtDrafts((prev) =>
        prev.filter((entry) => toStr(entry?.predictedAddress).trim().toLowerCase() !== addressLower),
      );
      prunePendingSbtSelections(new Set([addressLower]));
      clearFeaturedDraftGateAutoLink(predictedAddress);
    },
    [clearFeaturedDraftGateAutoLink, prunePendingSbtSelections, setPendingSbtDrafts],
  );

  const clearPendingSbtDrafts = useCallback(
    (draftsToClear: unknown[] = [], statusMessage = '') => {
      const normalizedDrafts = normalizePendingSbtDrafts(draftsToClear);
      if (!normalizedDrafts.length) return;
      const addressLowerSet = new Set(
        normalizedDrafts.map((entry) => toStr(entry?.predictedAddress).trim().toLowerCase()).filter(Boolean),
      );
      setPendingSbtDrafts((prev) =>
        prev.filter((entry) => !addressLowerSet.has(toStr(entry?.predictedAddress).trim().toLowerCase())),
      );
      prunePendingSbtSelections(addressLowerSet);
      if (statusMessage) {
        setStatus(statusMessage);
      }
    },
    [prunePendingSbtSelections, setPendingSbtDrafts, setStatus],
  );

  const handleSavePendingSbtDraft = useCallback(
    async (draftPayload: unknown) => {
      const normalizedDrafts = normalizePendingSbtDrafts([draftPayload]);
      const baseDraft = normalizedDrafts[0];
      const predictedAddress = toStr(baseDraft?.predictedAddress).trim();
      const nextDraft: PendingSbtDraft | null =
        baseDraft && predictedAddress
          ? {
              ...baseDraft,
              predictedAddress,
              deployed: false,
              networkChainId:
                Number(draftRef.current?.networkChainId || registryChainId || network?.id || network?.chainId || 0) ||
                0,
              sbtFactoryAddress: toStr(draftRef.current?.contracts?.sbtFactory?.address || '').trim(),
              deploymentContextSignature: pendingSbtDeployContextSignature,
            }
          : null;
      if (!nextDraft) {
        throw new Error('Unable to prepare the pending SBT draft.');
      }
      const pendingSelection = buildPendingSbtSelection(nextDraft);
      if (!pendingSelection) {
        throw new Error('Unable to build the pending SBT selector entry.');
      }

      setPendingSbtDrafts((prev) => {
        const filtered = prev.filter(
          (entry) => toStr(entry?.predictedAddress).trim().toLowerCase() !== nextDraft.predictedAddress?.toLowerCase(),
        );
        return [...filtered, nextDraft];
      });

      if (createSbtModalState.targetType === 'defaultFeaturedSBTs') {
        const next = [...normalizeSbtSelection(draftRef.current?.defaultFeaturedSBTs || []), pendingSelection];
        updateDraftValue(['defaultFeaturedSBTs'], serializeDefaultFeaturedSbtSelections(dedupeSbtSelection(next)));
        const gateA = getGateById(FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID);
        const gateASelections = dedupeSbtSelection(gateA?.sbts || []);
        if (!gateASelections.length) {
          updateEncryptionGate(FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID, {
            sbts: [...gateASelections, pendingSelection],
          } as Partial<TGate>);
          setFeaturedDraftGateAutoLink({
            gateId: FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID,
            address: pendingSelection.address,
            dismissed: false,
            source: FEATURED_DRAFT_GATE_AUTO_LINK_SOURCE,
          });
        }
      } else {
        const targetGateId = resolveCreateSbtTargetGateId(createSbtModalState.gateId);
        if (targetGateId) {
          const targetGate = getGateById(targetGateId);
          const nextSelections = dedupeSbtSelection([
            ...normalizeSbtSelection(targetGate?.sbts || []),
            pendingSelection,
          ]);
          updateEncryptionGate(targetGateId, { sbts: nextSelections } as Partial<TGate>);
        }
      }

      notifySuccess(`Prepared ${nextDraft.displayName} for deploy.`);
      closeCreateSbtModal();
    },
    [
      closeCreateSbtModal,
      createSbtModalState.gateId,
      createSbtModalState.targetType,
      draftRef,
      getGateById,
      network?.chainId,
      network?.id,
      notifySuccess,
      pendingSbtDeployContextSignature,
      registryChainId,
      resolveCreateSbtTargetGateId,
      setFeaturedDraftGateAutoLink,
      setPendingSbtDrafts,
      updateDraftValue,
      updateEncryptionGate,
    ],
  );

  const pendingSbtDeployContextRef = useRef(pendingSbtDeployContextSignature);

  useEffect(() => {
    const previousContextSignature = pendingSbtDeployContextRef.current;
    pendingSbtDeployContextRef.current = pendingSbtDeployContextSignature;
    const normalizedDrafts = normalizePendingSbtDrafts(pendingSbtDrafts);
    if (!previousContextSignature || previousContextSignature === pendingSbtDeployContextSignature) return;
    if (!normalizedDrafts.length) return;
    clearPendingSbtDrafts(
      normalizedDrafts,
      'Pending SBT drafts were cleared because the session chain or SBT factory changed. Recreate them before publishing.',
    );
    pruneAllPendingSbtSelections();
  }, [clearPendingSbtDrafts, pendingSbtDeployContextSignature, pendingSbtDrafts, pruneAllPendingSbtSelections]);

  useEffect(() => {
    const livePendingAddressSet = new Set(
      normalizePendingSbtDrafts(pendingSbtDrafts)
        .map((entry) => toStr(entry?.predictedAddress).trim().toLowerCase())
        .filter(Boolean),
    );
    const hasDanglingPendingSelection =
      encryptionGates.some((gate) =>
        normalizeSbtSelection(gate?.sbts || []).some(
          (sbt) => sbt?.pending === true && !livePendingAddressSet.has(toStr(sbt?.address).trim().toLowerCase()),
        ),
      ) ||
      normalizeSbtSelection(draftDefaultFeaturedSBTs || []).some(
        (entry) => entry?.pending === true && !livePendingAddressSet.has(toStr(entry?.address).trim().toLowerCase()),
      );
    if (!hasDanglingPendingSelection) return;
    prunePendingSbtSelections(
      new Set(
        [
          ...encryptionGates.flatMap((gate) => normalizeSbtSelection(gate?.sbts || [])),
          ...normalizeSbtSelection(draftDefaultFeaturedSBTs || []),
        ]
          .filter((entry) => entry?.pending === true)
          .map((entry) => toStr(entry?.address).trim().toLowerCase())
          .filter((addressLower) => addressLower && !livePendingAddressSet.has(addressLower)),
      ),
    );
  }, [draftDefaultFeaturedSBTs, encryptionGates, pendingSbtDrafts, prunePendingSbtSelections]);

  useEffect(() => {
    const autoLink = normalizeFeaturedDraftGateAutoLink(featuredDraftGateAutoLink);
    if (!autoLink) return;
    const gateId = toStr(autoLink.gateId).trim() || FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID;
    const linkedAddressLower = autoLink.address.toLowerCase();
    const liveDraft = normalizePendingSbtDrafts(pendingSbtDrafts).find(
      (entry) => toStr(entry?.predictedAddress).trim().toLowerCase() === linkedAddressLower,
    );
    if (!liveDraft) {
      clearFeaturedDraftGateAutoLink(autoLink.address);
      return;
    }
    const targetGate = encryptionGates.find((gate) => toStr(gate?.id).trim() === gateId);
    if (!targetGate) {
      clearFeaturedDraftGateAutoLink(autoLink.address);
      return;
    }
    const gateSelections = dedupeSbtSelection(targetGate?.sbts || []);
    const hasAutoLinkedSelection = gateSelections.some(
      (entry) => toStr(entry?.address).trim().toLowerCase() === linkedAddressLower,
    );
    const hasOtherSelections = gateSelections.some(
      (entry) => toStr(entry?.address).trim().toLowerCase() !== linkedAddressLower,
    );
    if (hasOtherSelections && autoLink.dismissed !== true) {
      dismissFeaturedDraftGateAutoLink({ gateId, address: autoLink.address });
      return;
    }
    if (autoLink.dismissed || hasAutoLinkedSelection) return;
    const pendingSelection = buildPendingSbtSelection(liveDraft);
    if (!pendingSelection) {
      clearFeaturedDraftGateAutoLink(autoLink.address);
      return;
    }
    setEncryptionGates((prev) =>
      prev.map((gate) => {
        if (toStr(gate?.id).trim() !== gateId) return gate;
        return {
          ...gate,
          sbts: dedupeSbtSelection([...normalizeSbtSelection(gate?.sbts || []), pendingSelection]),
        } as TGate;
      }),
    );
  }, [
    clearFeaturedDraftGateAutoLink,
    dismissFeaturedDraftGateAutoLink,
    encryptionGates,
    featuredDraftGateAutoLink,
    pendingSbtDrafts,
    setEncryptionGates,
  ]);

  return {
    clearPendingSbtDrafts,
    dismissFeaturedDraftGateAutoLink,
    handleGateAddSbt,
    handleGateRemoveSbt,
    handleRemoveDefaultFeaturedSbt,
    handleSavePendingSbtDraft,
    pendingSbtSelectorOptions,
    promoteDeployedPendingSbtSelections,
    pruneAllPendingSbtSelections,
    prunePendingSbtSelections,
    removePendingSbtDraft,
  };
};

export default useSessionWizardPendingSbtController;

import { useMemo } from 'react';
import { sessionRegistryPublishAdapter } from '../../../domains/sessions/publish/sessionPublishAdapters.js';
import type { UnknownRecord } from '../../../utilities/session/sessionTypes.js';
import type { ChainIdLike } from '../../shellTypes';
import { generateSessionId } from '../sessionWizardCoreUtils';
import { buildDefaultGateState, buildEncryptionGate } from '../sessionWizardGateUtils';
import type { SessionWizardCachedState } from '../sessionWizardLocalStateSupport';
import { normalizeFeaturedDraftGateAutoLink } from '../sessionWizardPendingSbtPublish';

export type SessionWizardEncryptionGateState = UnknownRecord & {
  id: string;
  label?: string;
  color?: string;
  mode?: string;
  chainId?: ChainIdLike | null;
  perMemberLimit?: unknown;
  sbts?: unknown[];
};

const useSessionWizardCachedInitialState = ({
  cachedWizard = null,
  initialDraftNetworkChainId,
  networkId,
  initialSessionId,
}: {
  cachedWizard?: SessionWizardCachedState | null;
  initialDraftNetworkChainId?: ChainIdLike;
  networkId?: ChainIdLike;
  initialSessionId?: unknown;
} = {}) => {
  const initialGates = useMemo<SessionWizardEncryptionGateState[]>(() => {
    const cachedGates = cachedWizard?.encryptionGates;
    if (Array.isArray(cachedGates) && cachedGates.length) return cachedGates as SessionWizardEncryptionGateState[];
    return [buildEncryptionGate(0) as SessionWizardEncryptionGateState];
  }, [cachedWizard]);
  const initialDefaultGateId = useMemo(() => {
    const cachedId = String(cachedWizard?.defaultGateId || '').trim();
    return cachedId || initialGates[0]?.id || '';
  }, [cachedWizard?.defaultGateId, initialGates]);
  const initialGateSelections = useMemo(() => {
    const cachedSelections = cachedWizard?.gateSelections;
    return cachedSelections && typeof cachedSelections === 'object'
      ? cachedSelections
      : buildDefaultGateState(initialDraftNetworkChainId || networkId);
  }, [cachedWizard?.gateSelections, initialDraftNetworkChainId, networkId]);
  const initialFeaturedDraftGateAutoLink = useMemo(
    () => normalizeFeaturedDraftGateAutoLink(cachedWizard?.featuredDraftGateAutoLink as UnknownRecord | null),
    [cachedWizard?.featuredDraftGateAutoLink],
  );
  const initialSessionIdValue = useMemo(
    () =>
      sessionRegistryPublishAdapter.formatSessionId(initialSessionId) ||
      sessionRegistryPublishAdapter.formatSessionId(cachedWizard?.sessionId) ||
      generateSessionId(),
    [cachedWizard?.sessionId, initialSessionId],
  );

  return {
    initialGates,
    initialDefaultGateId,
    initialGateSelections,
    initialFeaturedDraftGateAutoLink,
    initialSessionIdValue,
  };
};

export default useSessionWizardCachedInitialState;

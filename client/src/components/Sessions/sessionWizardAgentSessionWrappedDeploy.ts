import { normalizeAgentSessionWrappedCapability } from '../../utilities/session/agentSessionWrapped.js';
import { toStr } from '../../utilities/shared/primitives.js';
import {
  AGENT_BRIDGE_WORKER_BUNDLE_URL,
  WORKER_RELEASE_MANIFEST_URL,
} from '../../variables/publicDeploymentConfig.js';
import type { AnyRecord, ChainIdLike } from '../shellTypes';

export const resolveSessionWizardAgentSessionWrappedDeployment = ({
  draft,
  registryChainId,
  networkChainId,
  sessionId,
  sessionIdHex,
  slug,
}: {
  draft: AnyRecord;
  registryChainId?: ChainIdLike;
  networkChainId?: ChainIdLike;
  sessionId?: string | number | null;
  sessionIdHex?: string;
  slug: string;
}): { requested: boolean; payload: AnyRecord } => {
  const requested = draft.sessionModeProfile?.surfaces?.agentHttp === true;
  if (!requested) return { requested: false, payload: {} };

  return {
    requested: true,
    payload: {
      agentBridgeBundleUrl: AGENT_BRIDGE_WORKER_BUNDLE_URL,
      agentBridgeBundleManifestUrl: WORKER_RELEASE_MANIFEST_URL,
      agentSessionWrappedDeploymentIdentity: [
        'session',
        Number(registryChainId || networkChainId || 0) || 'worker',
        toStr(sessionIdHex || sessionId).trim() || 'pending',
        slug,
      ].join(':'),
    },
  };
};

export const requireSessionWizardAgentSessionWrappedCapability = ({
  requested,
  value,
}: {
  requested: boolean;
  value: unknown;
}) => {
  if (!requested) return null;
  const capability = normalizeAgentSessionWrappedCapability(value);
  if (!capability) {
    throw new Error('Agent Session Wrapped deployment did not return a verified capability.');
  }
  return capability;
};

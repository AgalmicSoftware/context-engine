import { normalizeAgentSessionWrappedCapability } from '../../utilities/session/agentSessionWrapped.js';
import type { AnyRecord, ChainIdLike } from '../shellTypes';

export const resolveSessionWizardAgentSessionWrappedDeployment = ({
  draft,
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
    payload: {},
  };
};

export const requireSessionWizardAgentSessionWrappedCapability = ({
  requested,
  value,
  workerUrl,
}: {
  requested: boolean;
  value: unknown;
  workerUrl?: unknown;
}) => {
  if (!requested) return null;
  const capability = normalizeAgentSessionWrappedCapability(value);
  if (!capability) {
    throw new Error('Agent Session Wrapped deployment did not return a verified capability.');
  }
  let workerOrigin = '';
  try {
    workerOrigin = new URL(String(workerUrl)).origin;
  } catch {
    /* rejected below */
  }
  if (capability.origin !== workerOrigin) {
    throw new Error(
      'Agent capability must use the Session Worker origin. Upgrade the deployment helper or sponsor before retrying.',
    );
  }
  return capability;
};

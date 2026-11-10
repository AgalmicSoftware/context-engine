import { normalizeHostedFaucetSelection } from './sessionWizardHostedFaucet';
import {
  normalizeSessionModeProfileForWrite,
  type SessionModeProfile,
} from '../../utilities/session/sessionModeProfile';
import type { UnknownRecord } from '../../utilities/session/sessionTypes';
import { deepClone } from './sessionWizardCoreUtils';
import { normalizeSessionStorageProfileConfig } from './sessionWizardStorageProfile';
import {
  DEFAULT_NEW_SESSION_GROUP_CREATION_POLICY,
  normalizeGroupCreationPolicy,
  type GroupCreationPolicy,
} from '../../utilities/session/groupCreationPolicy';

type SessionWizardModeDraft = UnknownRecord & {
  sessionModeProfile?: unknown;
  storageProfile?: unknown;
  groupCreationPolicy?: unknown;
};

type DraftWithGroupCreationPolicy<Draft extends SessionWizardModeDraft> = Draft & {
  groupCreationPolicy: GroupCreationPolicy;
};

type DraftWithSelectedModeProfile<Draft extends SessionWizardModeDraft> = DraftWithGroupCreationPolicy<Draft> & {
  sessionModeProfile: SessionModeProfile;
  storageProfile: UnknownRecord;
  networkChainId?: number;
};

export const applySessionModeProfileSelectionToDraft = <Draft extends SessionWizardModeDraft>(
  prev: Draft,
  profile: SessionModeProfile,
  compiled: { storageProfile: UnknownRecord },
): DraftWithSelectedModeProfile<Draft> => {
  const next = deepClone(prev) as DraftWithSelectedModeProfile<Draft>;
  next.sessionModeProfile = normalizeSessionModeProfileForWrite(profile);
  // Keep the header in step even while a newly added SBT rule is incomplete.
  if (profile.evm.registryChainId) next.networkChainId = profile.evm.registryChainId;
  next.storageProfile = normalizeSessionStorageProfileConfig(compiled.storageProfile);
  next.groupCreationPolicy = normalizeGroupCreationPolicy(
    next.groupCreationPolicy,
    DEFAULT_NEW_SESSION_GROUP_CREATION_POLICY,
  );
  if (profile.surfaces?.agentHttp !== true) delete next.agentSessionWrapped;
  return normalizeHostedFaucetSelection(next, prev);
};

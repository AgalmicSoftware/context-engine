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
  sessionMode?: unknown;
  sessionModeProfile?: unknown;
  storageProfile?: unknown;
  groupCreationPolicy?: unknown;
  telegram?: UnknownRecord;
  telegramBridgeEnabled?: unknown;
  telegramMode?: unknown;
  telegramOnly?: unknown;
  telegram_only?: unknown;
};

type DraftWithGroupCreationPolicy<Draft extends SessionWizardModeDraft> = Draft & {
  groupCreationPolicy: GroupCreationPolicy;
};

type DraftWithSelectedModeProfile<Draft extends SessionWizardModeDraft> = DraftWithGroupCreationPolicy<Draft> & {
  sessionModeProfile: SessionModeProfile;
  storageProfile: UnknownRecord;
  networkChainId?: number;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

// The storage profile field renders only for drafts without a session mode
// profile (getSessionWizardOrderedDraftEntries hides it otherwise), so a change
// never has a mode profile to keep in step.
export const applyStorageProfileChangeToModeDraft = <Draft extends SessionWizardModeDraft>(
  prev: Draft,
  nextProfile: unknown,
): Draft => {
  const next = deepClone(prev) as Draft;
  next.storageProfile = normalizeSessionStorageProfileConfig(nextProfile);
  return next;
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
  delete next.telegramOnly;
  delete next.telegram_only;
  delete next.telegramMode;
  delete next.sessionMode;
  delete next.telegramBridgeEnabled;
  if (profile.surfaces?.agentHttp !== true) delete next.agentSessionWrapped;
  if (isRecord(next.telegram)) {
    delete next.telegram.only;
    delete next.telegram.mode;
    if (!Object.keys(next.telegram).length) delete next.telegram;
  }
  return normalizeHostedFaucetSelection(next, prev);
};

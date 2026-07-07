import type { SessionModeProfile } from '../../utilities/session/sessionModeProfile';
import type { UnknownRecord } from '../../utilities/session/sessionTypes';
import { toStr } from '../../utilities/shared/primitives.js';
import { deepClone } from './sessionWizardCoreUtils';
import { normalizeSessionStorageProfileConfig } from './sessionWizardStorageProfile';

type SessionWizardModeDraft = UnknownRecord & {
  sessionMode?: unknown;
  sessionModeProfile?: unknown;
  storageProfile?: unknown;
  telegram?: UnknownRecord;
  telegramBridgeEnabled?: unknown;
  telegramMode?: unknown;
  telegramOnly?: unknown;
  telegram_only?: unknown;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const applyStorageProfileChangeToModeDraft = <Draft extends SessionWizardModeDraft>(
  prev: Draft,
  nextProfile: unknown,
): Draft => {
  const next = deepClone(prev) as Draft;
  const normalizedProfile = normalizeSessionStorageProfileConfig(nextProfile);
  next.storageProfile = normalizedProfile;
  if (isRecord(next.sessionModeProfile)) {
    const modeProfile = deepClone(next.sessionModeProfile) as UnknownRecord;
    const backend = toStr(normalizedProfile.backend).trim();
    modeProfile.preset = 'custom';
    modeProfile.storage = {
      ...(isRecord(modeProfile.storage) ? modeProfile.storage : {}),
      backend: backend === 'cloudflare' ? 'cloudflare' : 'arweave',
    };
    modeProfile.authority = {
      ...(isRecord(modeProfile.authority) ? modeProfile.authority : {}),
      mode: backend === 'cloudflare' ? 'worker_canonical' : 'evm_registry_canonical',
    };
    modeProfile.encryption = {
      ...(isRecord(modeProfile.encryption) ? modeProfile.encryption : {}),
      mode:
        backend === 'lit-arweave' || normalizedProfile.payloadAccessControl?.mode === 'lit_encrypted' ? 'lit' : 'none',
    };
    if (isRecord(modeProfile.surfaces)) {
      modeProfile.surfaces.web = true;
    }
    next.sessionModeProfile = modeProfile;
  }
  return next;
};

export const applySessionModeProfileSelectionToDraft = <Draft extends SessionWizardModeDraft>(
  prev: Draft,
  profile: SessionModeProfile,
  compiled: { storageProfile: UnknownRecord },
): Draft => {
  const next = deepClone(prev) as Draft;
  next.sessionModeProfile = deepClone(profile);
  next.storageProfile = normalizeSessionStorageProfileConfig(compiled.storageProfile);
  delete next.telegramOnly;
  delete next.telegram_only;
  delete next.telegramMode;
  delete next.sessionMode;
  delete next.telegramBridgeEnabled;
  if (isRecord(next.telegram)) {
    delete next.telegram.only;
    delete next.telegram.mode;
    if (!Object.keys(next.telegram).length) delete next.telegram;
  }
  return next;
};

import {
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
  compileSessionModeProfile,
  normalizeSessionModeProfileForWrite,
  validateSessionModeProfile,
  type SessionModeAccessConditionDocument,
  type SessionModeProfile,
  type SessionModeResultsVisibility,
} from '../../../utilities/session/sessionModeProfile';

// The quick path's profile: Worker-canonical, passkey-first, optional surfaces off,
// and public results, which need unencrypted answers. Every option on the page edits
// a copy of it.
export const defaultSessionSetupProfile = (): SessionModeProfile => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  profile.encryption = { mode: 'none' };
  setResultsVisibility(profile, PUBLIC_RESULTS);
  return profile;
};

export const PUBLIC_RESULTS: SessionModeResultsVisibility = 'public_full_if_storage_public';
export const DEFAULT_REGISTRY_CHAIN_ID = 11155420;

export const isSessionModeProfile = (value: unknown): value is SessionModeProfile =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (value as { profileVersion?: unknown }).profileVersion === 1;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

type PayloadAccess = NonNullable<SessionModeProfile['storage']['payloadAccessControl']>;

const payloadEncryptionFor = (profile: SessionModeProfile): PayloadAccess['encryption'] =>
  profile.encryption.mode === 'worker_envelope'
    ? 'worker_envelope'
    : profile.encryption.mode === 'lit'
      ? 'lit'
      : 'none';

// The access policy of a session whose results aren't public.
export const defaultCloudflarePayloadAccess = (profile?: SessionModeProfile): PayloadAccess => {
  const preset = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  const access = preset.storage.payloadAccessControl as PayloadAccess;
  return profile ? { ...access, encryption: payloadEncryptionFor(profile) } : access;
};

export const effectiveEnvelopeConditions = (profile: SessionModeProfile): SessionModeAccessConditionDocument =>
  clone(
    profile.encryption.accessConditions ||
      profile.storage.payloadAccessControl?.accessConditions || { match: 'any', conditions: [] },
  );

export const usesDefaultEnvelopeRules = (profile: SessionModeProfile): boolean =>
  !profile.encryption.accessConditions?.conditions.length &&
  JSON.stringify(effectiveEnvelopeConditions(profile)) ===
    JSON.stringify(defaultCloudflarePayloadAccess().accessConditions);

// No rules restores the default Cloudflare access policy.
export const setEnvelopeConditions = (profile: SessionModeProfile, conditions?: SessionModeAccessConditionDocument) => {
  profile.encryption = { ...profile.encryption };
  if (conditions?.conditions.length) profile.encryption.accessConditions = conditions;
  else {
    delete profile.encryption.accessConditions;
    profile.storage.payloadAccessControl = defaultCloudflarePayloadAccess(profile);
  }
};

const hasSbtRule = (profile: SessionModeProfile): boolean =>
  [profile.encryption.accessConditions, profile.storage.payloadAccessControl?.accessConditions].some((document) =>
    document?.conditions?.some((condition) => condition.kind === 'sbt_onchain'),
  );

// Public results are offered only for unencrypted answers.
export const supportsPublicResults = (profile: SessionModeProfile): boolean => profile.encryption.mode === 'none';

const hasPublicReadStorage = (profile: SessionModeProfile): boolean =>
  profile.storage.backend === 'arweave' ||
  (profile.storage.payloadAccessControl?.gate === 'none' && !profile.storage.payloadAccessControl.accessConditions);

// Keeps the page from leaving public results on storage that can't serve
// them, and drops the public-read Cloudflare policy once they are off.
const settlePublicResults = (profile: SessionModeProfile, previous: SessionModeProfile | null) => {
  const leavingPublic =
    profile.results.visibility === PUBLIC_RESULTS &&
    (!supportsPublicResults(profile) || !hasPublicReadStorage(profile));
  if (leavingPublic) profile.results.visibility = 'participant_aggregate';
  const access = profile.storage.payloadAccessControl;
  const keepsLitRules = profile.encryption.mode === 'lit' && previous?.encryption.mode === 'lit';
  if (
    profile.storage.backend === 'cloudflare' &&
    access?.gate === 'none' &&
    profile.results.visibility !== PUBLIC_RESULTS &&
    (leavingPublic || !keepsLitRules)
  ) {
    profile.storage.payloadAccessControl = {
      ...defaultCloudflarePayloadAccess(profile),
      ...(access.accessConditions ? { accessConditions: access.accessConditions } : {}),
    };
  }
};

// A Worker-hosted session keeps a registry chain only for Lit or SBT rules.
const clearUnusedChain = (profile: SessionModeProfile) => {
  if (profile.authority.mode === 'worker_canonical' && profile.encryption.mode !== 'lit' && !hasSbtRule(profile)) {
    profile.evm.registryChainId = null;
  }
};

export const setResultsVisibility = (profile: SessionModeProfile, visibility: SessionModeResultsVisibility) => {
  profile.results.visibility = visibility;
  if (visibility === PUBLIC_RESULTS && profile.storage.backend === 'cloudflare' && supportsPublicResults(profile)) {
    profile.storage.payloadAccessControl = { gate: 'none', encryption: 'none' };
  }
};

// Choosing where a session runs brings the storage, sign-in and permissions
// that hosting needs, so one choice doesn't leave three conflicts behind.
export const setHosting = (profile: SessionModeProfile, authority: string, registryChainId: number | null) => {
  if (authority === 'evm_registry_canonical') {
    profile.authority.mode = 'evm_registry_canonical';
    profile.storage = { backend: 'arweave' };
    profile.identity = { default: 'wallet', enabled: ['wallet', 'passkey'] };
    profile.authorization = { mechanisms: ['sbt_onchain'] };
    profile.evm.registryChainId = profile.evm.registryChainId || registryChainId || DEFAULT_REGISTRY_CHAIN_ID;
    if (profile.encryption.mode === 'worker_envelope') profile.encryption = { mode: 'none' };
    if (profile.export.scope === 'encrypted_envelopes_only' && profile.encryption.mode === 'none') {
      profile.export.scope = 'admin_raw';
    }
    return;
  }
  profile.authority.mode = 'worker_canonical';
  profile.storage = { backend: 'cloudflare', payloadAccessControl: defaultCloudflarePayloadAccess(profile) };
  setResultsVisibility(profile, profile.results.visibility);
  profile.identity = { default: 'passkey', enabled: ['passkey'] };
  profile.authorization = { mechanisms: ['worker_roles'] };
};

export const setEncryptionMode = (profile: SessionModeProfile, mode: string, registryChainId: number | null) => {
  profile.encryption = { mode: mode as SessionModeProfile['encryption']['mode'] };
  if (mode === 'lit')
    profile.evm.registryChainId = profile.evm.registryChainId || registryChainId || DEFAULT_REGISTRY_CHAIN_ID;
  if (mode === 'worker_envelope') profile.encryption.keyProvider = 'worker_secret';
  if (profile.storage.backend === 'cloudflare' && profile.storage.payloadAccessControl) {
    profile.storage.payloadAccessControl.encryption = payloadEncryptionFor(profile);
  }
  if (mode === 'none' && profile.export.scope === 'encrypted_envelopes_only') profile.export.scope = 'admin_raw';
};

export type SessionSetupProfileEdit = {
  profile: SessionModeProfile;
  /** Compiled from the edited profile when it is valid, else from the last valid one. */
  compiled: { storageProfile: Record<string, unknown> };
};

// Edits a copy of the profile (the quick-path default when there is none).
// A conflicting result is kept for the page to flag beside its options.
export const editSessionSetupProfile = (
  value: unknown,
  mutate: (profile: SessionModeProfile) => void,
): SessionSetupProfileEdit => {
  const previous = isSessionModeProfile(value) ? value : null;
  const profile = previous ? normalizeSessionModeProfileForWrite(previous) : defaultSessionSetupProfile();
  profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  mutate(profile);
  profile.surfaces.web = true;
  settlePublicResults(profile, previous);
  clearUnusedChain(profile);
  const source = validateSessionModeProfile(profile).valid
    ? profile
    : previous && validateSessionModeProfile(previous).valid
      ? previous
      : defaultSessionSetupProfile();
  return { profile, compiled: { storageProfile: compileSessionModeProfile(source).storageProfile } };
};

import {
  compileSessionModeProfile,
  sessionModeAllowsAnonymousWorkerGroupDiscovery,
  validateSessionModeProfile,
} from '../../../utilities/session/sessionModeProfile';
import { sessionAnswersRequireLogin } from '../../../utilities/session/sessionCapabilityProjection';
import {
  defaultCloudflarePayloadAccess,
  defaultSessionSetupProfile,
  editSessionSetupProfile,
  setEncryptionMode,
  setHosting,
  setResultsVisibility,
  usesDefaultEnvelopeRules,
} from './sessionSetupProfile';

const issueCodes = (profile: unknown) => validateSessionModeProfile(profile).issues.map((issue) => issue.code);

describe('session setup profile edits', () => {
  it('starts from the quick path: Worker-hosted, passkeys, optional surfaces off', () => {
    const profile = defaultSessionSetupProfile();
    expect(profile.authority.mode).toBe('worker_canonical');
    expect(profile.identity).toEqual({ default: 'passkey', enabled: ['passkey'] });
    expect(Object.entries(profile.surfaces).filter(([, on]) => on)).toEqual([['web', true]]);
  });

  it('starts with public results, which needs unencrypted answers on public-read storage', () => {
    const profile = defaultSessionSetupProfile();
    expect(profile.results.visibility).toBe('public_full_if_storage_public');
    expect(profile.encryption).toEqual({ mode: 'none' });
    expect(profile.storage.payloadAccessControl).toEqual({ gate: 'none', encryption: 'none' });
    expect(issueCodes(profile)).toEqual([]);
    expect(sessionModeAllowsAnonymousWorkerGroupDiscovery(profile)).toBe(true);
    expect(sessionAnswersRequireLogin(profile)).toBe(false);
  });

  it('asks visitors to log in only once the creator chooses non-public results', () => {
    const { profile } = editSessionSetupProfile(defaultSessionSetupProfile(), (draft) =>
      setResultsVisibility(draft, 'participant_aggregate'),
    );
    expect(sessionAnswersRequireLogin(profile)).toBe(true);
    expect(profile.storage.payloadAccessControl?.gate).toBe('role_gate');
    expect(issueCodes(profile)).toEqual([]);
  });

  it('keeps the private access policy for sessions that leave public results', () => {
    expect(defaultCloudflarePayloadAccess().gate).toBe('role_gate');
    expect(defaultCloudflarePayloadAccess().accessConditions?.conditions.length).toBeGreaterThan(0);
  });

  it('edits a copy, marks it custom and keeps the web surface on', () => {
    const before = defaultSessionSetupProfile();
    const { profile } = editSessionSetupProfile(before, (draft) => {
      draft.surfaces.agentHttp = true;
      draft.surfaces.web = false;
    });
    expect(before.surfaces.agentHttp).toBe(false);
    expect(profile.preset).toBe('custom');
    expect(profile.surfaces).toMatchObject({ web: true, agentHttp: true });
    expect(validateSessionModeProfile(profile).valid).toBe(true);
  });

  it('keeps a conflicting edit for the page to flag, compiling storage from the last valid profile', () => {
    const before = defaultSessionSetupProfile();
    const { profile, compiled } = editSessionSetupProfile(before, (draft) => {
      draft.storage = { backend: 'arweave' };
    });
    expect(profile.storage).toEqual({ backend: 'arweave' });
    expect(issueCodes(profile)).toContain('worker_authority_requires_cloudflare');
    expect(compiled.storageProfile).toEqual(compileSessionModeProfile(before).storageProfile);
  });

  it('brings the storage, sign-in and permissions each hosting choice needs', () => {
    const onChain = editSessionSetupProfile(defaultSessionSetupProfile(), (draft) =>
      setHosting(draft, 'evm_registry_canonical', 84532),
    ).profile;
    expect(onChain).toMatchObject({
      authority: { mode: 'evm_registry_canonical' },
      evm: { registryChainId: 84532 },
      storage: { backend: 'arweave' },
      identity: { default: 'wallet', enabled: ['wallet', 'passkey'] },
      authorization: { mechanisms: ['sbt_onchain'] },
      encryption: { mode: 'none' },
    });
    expect(issueCodes(onChain)).toEqual([]);
    const back = editSessionSetupProfile(onChain, (draft) => setHosting(draft, 'worker_canonical', null)).profile;
    expect(back.evm.registryChainId).toBeNull();
    expect(back.storage.backend).toBe('cloudflare');
    expect(issueCodes(back)).toEqual([]);
    expect(back.results.visibility).toBe('public_full_if_storage_public');
    expect(back.storage.payloadAccessControl).toEqual({ gate: 'none', encryption: 'none' });
  });

  it('moves public results off encrypted storage and back to the default access policy', () => {
    const open = editSessionSetupProfile(defaultSessionSetupProfile(), (draft) => {
      setEncryptionMode(draft, 'none', null);
      setResultsVisibility(draft, 'public_full_if_storage_public');
    }).profile;
    expect(open.storage.payloadAccessControl).toEqual({ gate: 'none', encryption: 'none' });
    expect(issueCodes(open)).toEqual([]);
    const encrypted = editSessionSetupProfile(open, (draft) =>
      setEncryptionMode(draft, 'worker_envelope', null),
    ).profile;
    expect(encrypted.results.visibility).toBe('participant_aggregate');
    expect(encrypted.storage.payloadAccessControl?.gate).toBe('role_gate');
    expect(usesDefaultEnvelopeRules(encrypted)).toBe(true);
    expect(issueCodes(encrypted)).toEqual([]);
  });
});

import { ethers } from 'ethers';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import {
  describeHostedFaucetSetup,
  setHostedFaucetEnabled,
  normalizeHostedFaucetSelection,
  faucetAddressFromKey,
} from './sessionWizardHostedFaucet';
import { resolveSessionWizardModeRequirements } from './sessionWizardModeRequirements';
import {
  buildSessionWizardWorkerRequirementProof,
  resolveSessionWizardWorkerRequirementReadiness,
  resolveSessionWizardWorkerSecretSelection,
} from './sessionWizardWorkerRequirementProof';

const condition = (chainId: number) => ({
  kind: 'sbt_onchain' as const,
  chainId,
  contract: ethers.Wallet.createRandom().address,
  anyOrAll: 'any' as const,
});
const draftWithSbt = () => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  profile.preset = 'custom';
  profile.evm.registryChainId = 11155420;
  profile.encryption.accessConditions = { match: 'any', conditions: [condition(11155420)] };
  return { sessionModeProfile: profile, networkChainId: 11155420 };
};

describe('hosted faucet setup', () => {
  it('defaults off and requires every SBT condition to use the supported session network', () => {
    const draft = draftWithSbt();
    expect(describeHostedFaucetSetup(draft)).toMatchObject({
      visible: true,
      eligible: true,
      enabled: false,
      network: 'OP Sepolia',
    });
    const enabled = setHostedFaucetEnabled(draft, true);
    expect(enabled.workerAuthority.participantScopes).toContain('faucet_self');
    expect(enabled.workerAuthority.participantScopes).not.toContain('faucet');
    expect(enabled.workerAuthority.participantScopes).toContain('storage');
    expect(describeHostedFaucetSetup(enabled).enabled).toBe(true);
    draft.sessionModeProfile.storage.payloadAccessControl!.accessConditions = {
      match: 'any',
      conditions: [condition(84532)],
    };
    expect(describeHostedFaucetSetup(draft)).toMatchObject({ visible: true, eligible: false });
    expect(describeHostedFaucetSetup(setHostedFaucetEnabled(draft, true)).enabled).toBe(false);
    expect(describeHostedFaucetSetup({ ...draftWithSbt(), networkChainId: 1 }).eligible).toBe(false);
  });

  it('replaces the broad legacy faucet grant when normalizing a hosted draft', () => {
    const draft = { ...draftWithSbt(), workerAuthority: { version: 1, participantScopes: ['storage', 'faucet'] } };
    expect(normalizeHostedFaucetSelection(draft).workerAuthority.participantScopes).toEqual(['storage', 'faucet_self']);
  });

  it('keeps normalized drafts stable across repeated wizard effects', () => {
    const draft = setHostedFaucetEnabled(draftWithSbt(), true);
    expect(normalizeHostedFaucetSelection(draft, draft)).toBe(draft);
    const legacy = {
      ...draft,
      workerAuthority: { ...draft.workerAuthority, participantScopes: ['storage', 'faucet'] },
    };
    const normalized = normalizeHostedFaucetSelection(legacy, legacy);
    expect(normalized.workerAuthority.participantScopes).toEqual(['storage', 'faucet_self']);
    expect(normalizeHostedFaucetSelection(normalized, legacy)).toBe(normalized);
    expect(normalizeHostedFaucetSelection(normalized, normalized)).toBe(normalized);
  });

  it('removes the scope after condition removal, a backend change, or any network change', () => {
    const before = setHostedFaucetEnabled(draftWithSbt(), true);
    const removed = JSON.parse(JSON.stringify(before));
    delete removed.sessionModeProfile.encryption.accessConditions;
    const registry = JSON.parse(JSON.stringify(before));
    registry.sessionModeProfile.authority.mode = 'evm_registry_canonical';
    const changedNetwork = JSON.parse(JSON.stringify(before));
    changedNetwork.networkChainId = 84532;
    changedNetwork.sessionModeProfile.evm.registryChainId = 84532;
    changedNetwork.sessionModeProfile.encryption.accessConditions.conditions[0].chainId = 84532;
    for (const draft of [removed, registry, changedNetwork]) {
      expect(normalizeHostedFaucetSelection(draft, before).workerAuthority.participantScopes).not.toContain(
        'faucet_self',
      );
    }
    expect(normalizeHostedFaucetSelection(before, before).workerAuthority.participantScopes).toContain('faucet_self');
    // A key left in the form must not reach a hosted Worker once its faucet turns off.
    // Removing the last SBT rule also clears the hosted registry chain, as the rule editor does.
    removed.sessionModeProfile.evm.registryChainId = null;
    const workerSecrets = { openaiKey: 'fixture-only', faucetPrivateKey: ethers.Wallet.createRandom().privateKey };
    for (const draft of [removed, changedNetwork]) {
      const normalized = normalizeHostedFaucetSelection(draft, before);
      const selection = resolveSessionWizardWorkerSecretSelection({
        sessionModeProfile: normalized.sessionModeProfile,
        sessionConfig: normalized,
        workerSecrets,
      });
      expect(selection.selectedSecrets).toEqual({ openaiKey: 'fixture-only' });
    }
  });

  it('selects and validates the opted-in key for deployment and exposes the txGas card', () => {
    const draft = setHostedFaucetEnabled(draftWithSbt(), true);
    const wallet = ethers.Wallet.createRandom();
    const workerSecrets = { openaiKey: 'fixture-only', faucetPrivateKey: wallet.privateKey };
    const options = { sessionModeProfile: draft.sessionModeProfile, sessionConfig: draft, workerSecrets };
    const requirements = resolveSessionWizardModeRequirements(draft.sessionModeProfile, { sessionConfig: draft });
    expect(requirements.visibleWorkerResourceKeys).toContain('txGas');
    expect(resolveSessionWizardWorkerSecretSelection(options).selectedSecrets).toEqual(workerSecrets);
    expect(faucetAddressFromKey(wallet.privateKey)).toBe(wallet.address);
    for (const key of ['invalid', '0x' + '0'.repeat(64), '0x' + 'f'.repeat(64)]) {
      expect(faucetAddressFromKey(key)).toBeNull();
      const invalidOptions = { ...options, workerSecrets: { ...workerSecrets, faucetPrivateKey: key } };
      expect(() => resolveSessionWizardWorkerSecretSelection(invalidOptions)).toThrow(/Faucet private key/);
    }
    const disabled = resolveSessionWizardWorkerSecretSelection({
      ...options,
      sessionConfig: setHostedFaucetEnabled(draft, false),
    });
    expect(disabled.selectedSecrets).toEqual({ openaiKey: 'fixture-only' });
  });

  it('binds the faucet key and opt-in to verified Worker readiness', () => {
    const draft = setHostedFaucetEnabled(draftWithSbt(), true);
    const options = {
      workerUrl: 'https://worker.example.test',
      sessionSlug: 'example',
      sessionId: '0x00112233445566778899aabbccddeeff',
      sessionModeProfile: draft.sessionModeProfile,
      sessionConfig: draft,
      workerSecrets: { openaiKey: 'fixture-only', faucetPrivateKey: ethers.Wallet.createRandom().privateKey },
    };
    const proof = buildSessionWizardWorkerRequirementProof(options);
    expect(proof?.requiredSecretFields).toContain('faucetPrivateKey');
    expect(resolveSessionWizardWorkerRequirementReadiness({ ...options, proof }).verified).toBe(true);
    const disabled = resolveSessionWizardWorkerRequirementReadiness({
      ...options,
      proof,
      sessionConfig: setHostedFaucetEnabled(draft, false),
    });
    expect(disabled).toMatchObject({ verified: false, reason: 'requirements-changed' });
    const missingKey = resolveSessionWizardWorkerRequirementReadiness({
      ...options,
      proof,
      workerSecrets: { openaiKey: 'fixture-only' },
    });
    expect(missingKey.verified).toBe(false);
  });
});

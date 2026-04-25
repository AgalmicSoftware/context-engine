import {
  buildSessionWizardCreateSbtModalLaunchState,
  getSessionWizardGateById,
  resolveSessionWizardCreateSbtTargetGateId,
} from './sessionWizardCreateSbtSupport';

describe('sessionWizardCreateSbtSupport', () => {
  const gates = [
    { id: 'gate-1', label: 'Gate 1' },
    { id: 'gate-2', label: 'Gate 2' },
  ];

  it('finds gates by id and resolves target gate fallback order', () => {
    expect(getSessionWizardGateById(gates, 'gate-2')).toEqual({ id: 'gate-2', label: 'Gate 2' });
    expect(getSessionWizardGateById(gates, 'missing')).toBeNull();

    expect(resolveSessionWizardCreateSbtTargetGateId({
      allEncryptionGates: gates,
      defaultGateId: 'gate-1',
      requestedGateId: 'gate-2',
    })).toBe('gate-2');
    expect(resolveSessionWizardCreateSbtTargetGateId({
      allEncryptionGates: gates,
      defaultGateId: 'gate-1',
      requestedGateId: 'missing',
    })).toBe('gate-1');
    expect(resolveSessionWizardCreateSbtTargetGateId({
      allEncryptionGates: gates,
      defaultGateId: '',
      requestedGateId: '',
    })).toBe('gate-1');
  });

  it('builds create-sbt launch state from explicit options and current defaults', () => {
    expect(buildSessionWizardCreateSbtModalLaunchState({
      allEncryptionGates: gates,
      defaultGateId: 'gate-1',
      currentDraftSlug: 'demo-session',
      currentArweaveJwk: '{"kty":"RSA"}',
    })).toEqual({
      targetType: 'gate',
      gateId: 'gate-1',
      sessionSlug: 'demo-session',
      arweaveJwkOverride: '{"kty":"RSA"}',
    });

    expect(buildSessionWizardCreateSbtModalLaunchState({
      options: {
        targetType: 'defaultFeaturedSBTs',
        gateId: 'gate-2',
        sessionSlug: 'custom-slug',
        arweaveJwkOverride: 'manual-jwk',
      },
      allEncryptionGates: gates,
      defaultGateId: 'gate-1',
      currentDraftSlug: 'demo-session',
      currentArweaveJwk: '{"kty":"RSA"}',
    })).toEqual({
      targetType: 'defaultFeaturedSBTs',
      gateId: 'gate-2',
      sessionSlug: 'custom-slug',
      arweaveJwkOverride: 'manual-jwk',
    });
  });
});

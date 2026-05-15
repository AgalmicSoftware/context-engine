import {
  buildSessionWizardCreateSbtModalLaunchState,
  buildSessionWizardDeferredCreateSbtComponentProps,
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

  it('builds deferred CreateSBT props from draft session context', () => {
    const signAdminAction = jest.fn();
    const props = buildSessionWizardDeferredCreateSbtComponentProps({
      account: '0xaccount',
      defaultGateId: '',
      draft: {
        slug: 'alpha',
        corsWorkerUrl: ' https://worker.example/ ',
        networkChainId: 84532,
        contracts: { SessionRegistry: '0xregistry' },
        defaultSbtTags: 'alpha,beta',
      },
      encryptionGates: [{
        id: 'gate-1',
        label: 'Gate 1',
        color: '#fff',
        mode: 'all',
        sbts: [{ address: '0xsbt1' }, { address: '0xsbt2' }],
      }],
      getChainById: (chainId) => ({ id: chainId, name: `Known ${chainId}` }),
      getChainName: (chainId) => `Chain ${chainId}`,
      getEnabledWorkerArweaveJwk: () => 'jwk',
      normalizeSbtSelection: (value) => Array.isArray(value) ? value : [],
      normalizeWorkerAuthUrl: (value) => String(value || '').trim().replace(/\/$/, ''),
      provider: 'provider',
      signAdminAction,
      toggleLoginModal: 'toggle',
      workerSecrets: { arweaveJwk: 'jwk' },
    });

    expect(props).toEqual(expect.objectContaining({
      account: '0xaccount',
      network: { id: 84532, name: 'Known 84532' },
      loginComplete: true,
      sessionSlug: 'alpha',
      arweaveJwkOverride: 'jwk',
      defaultGateId: 'gate-1',
      defaultSbtTags: 'alpha,beta',
      deferredDeploy: true,
      attemptImmediateDeferredUpload: true,
      hideNetworkSelector: true,
      preferDirectArweaveUpload: false,
      signAdminAction,
    }));
    expect(props.sessionConfigOverride).toEqual(expect.objectContaining({
      slug: 'alpha',
      corsWorkerUrl: 'https://worker.example',
      networkChainId: 84532,
      contracts: { SessionRegistry: '0xregistry' },
    }));
    expect(props.encryptionGates).toEqual([{
      id: 'gate-1',
      gateId: 'gate-1',
      label: 'Gate 1',
      name: 'Gate 1',
      color: '#fff',
      mode: 'all',
      requireAll: true,
      sbtAddresses: ['0xsbt1', '0xsbt2'],
      chainId: 84532,
    }]);
  });
});

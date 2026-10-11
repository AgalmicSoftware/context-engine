import {
  act,
  contractScripts,
  E2E_TESTIDS,
  ethers,
  fireEvent,
  makeFactoryReceiptLog,
  makeInstance,
  render,
  screen,
  setupCreateSBTGroupTestLifecycle,
} from './CreateSBTGroup.testUtils';

const PASSPHRASE_PATTERN = /^[a-z]+(-[a-z]+){4}$/;

const makeGroupPasswordInstance = (stateOverrides = {}, props = {}) => {
  const instance = makeInstance({
    account: '0x1111111111111111111111111111111111111111',
    loginComplete: true,
    network: { id: 84532, name: 'Base Sepolia' },
    provider: 'mock-provider',
    sessionSlug: 'test',
    toggleLoginModal: jest.fn(),
    ...props,
  });
  instance.state = {
    ...instance.state,
    sbtName: 'Password Group',
    distributionOptionsCollapsed: false,
    sbtDistribution: {
      ...instance.state.sbtDistribution,
      burnAuth: 'AdminOnly',
      distributionOption: 'groupPassword',
    },
    ...stateOverrides,
  };
  return instance;
};

const stubCreateUploads = (instance) => {
  instance.commitPendingDocumentUrl = jest.fn(async () => false);
  instance.uploadImageToArweave = jest.fn(async () => null);
  instance.uploadTokenUriToArweave = jest.fn(async () => null);
  instance.mintSBT = jest.fn(async () => null);
};

describe('CreateSBTGroup group password', () => {
  setupCreateSBTGroupTestLifecycle();

  it('prefills a generated passphrase when group-password minting is chosen', () => {
    const instance = makeGroupPasswordInstance({ groupPassword: '' });
    const prevState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution, distributionOption: 'anyoneCanMint' },
    };

    instance.componentDidUpdate(instance.props, prevState);

    expect(instance.state.groupPassword).toMatch(PASSPHRASE_PATTERN);
    instance.state.groupPassword
      .split('-')
      .forEach((word) => expect(ethers.wordlists.en.getWordIndex(word)).toBeGreaterThanOrEqual(0));
  });

  it('keeps a password the creator already entered', () => {
    const instance = makeGroupPasswordInstance({ groupPassword: 'my-own-long-group-password' });
    const prevState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution, distributionOption: 'anyoneCanMint' },
    };

    instance.componentDidUpdate(instance.props, prevState);

    expect(instance.state.groupPassword).toBe('my-own-long-group-password');
  });

  it('replaces the password with a new passphrase from "Generate new"', () => {
    const instance = makeGroupPasswordInstance({ groupPassword: 'short', groupPasswordWeakConfirmed: true });
    jest.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => array.fill(7));

    render(instance.render());
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_GENERATE));

    expect(instance.state.groupPassword).toBe(Array(5).fill(ethers.wordlists.en.getWord(7)).join('-'));
    expect(instance.state.groupPasswordWeakConfirmed).toBe(false);
  });

  it('shows no short-password warning for a generated passphrase', () => {
    const instance = makeGroupPasswordInstance({ groupPassword: 'orbit-maple-signal-tunnel-quartz' });

    render(instance.render());

    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_INPUT)).toHaveValue(
      'orbit-maple-signal-tunnel-quartz',
    );
    expect(screen.queryByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_WARNING)).not.toBeInTheDocument();
  });

  it('warns about short custom passwords and blocks creating until the risk is confirmed', async () => {
    const instance = makeGroupPasswordInstance({ groupPassword: 'short-secret' });
    stubCreateUploads(instance);

    const view = render(instance.render());
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_WARNING)).toHaveTextContent(
      /public on-chain, so a password shorter than 16 characters can be guessed offline/,
    );
    const confirm = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_CONFIRM);
    expect(confirm).not.toBeChecked();

    await act(async () => {
      await instance.handleMintClick();
    });
    expect(instance.mintSBT).not.toHaveBeenCalled();
    expect(instance.state.error).toMatch(/short group password/);

    fireEvent.click(confirm);
    expect(instance.state.groupPasswordWeakConfirmed).toBe(true);
    view.rerender(instance.render());
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_CONFIRM)).toBeChecked();

    await act(async () => {
      await instance.handleMintClick();
    });
    expect(instance.mintSBT).toHaveBeenCalledTimes(1);
  });

  it('clears the short-password confirmation when the password changes', () => {
    const instance = makeGroupPasswordInstance({ groupPassword: 'short-secret', groupPasswordWeakConfirmed: true });
    instance.persistFormCache = jest.fn();

    instance.handleInputChange({ target: { name: 'groupPassword', type: 'text', value: 'other-secret' } });

    expect(instance.state.groupPassword).toBe('other-secret');
    expect(instance.state.groupPasswordWeakConfirmed).toBe(false);
  });

  it('deploys group passwords to the predicted address even when predictable deployment is off', async () => {
    const predictedAddress = '0x00000000000000000000000000000000000000c7';
    const instance = makeGroupPasswordInstance({
      groupPassword: 'orbit-maple-signal-tunnel-quartz',
      tokenURI: 'ar://metadata',
      predictableAddressEnabled: false,
      create2Salt: '',
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'test', networkChainId: 84532 }));
    const countSpy = jest.spyOn(contractScripts, 'countSBTCreated').mockResolvedValue(3);
    jest.spyOn(contractScripts, 'predictSBTAddress').mockResolvedValue(predictedAddress);
    const hashSpy = jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockResolvedValue(`0x${'66'.repeat(32)}`);
    const createSpy = jest.spyOn(contractScripts, 'createSBT').mockResolvedValue({
      logs: [makeFactoryReceiptLog('SBTCreated', [predictedAddress])],
    });

    await instance.mintSBT();

    expect(countSpy).not.toHaveBeenCalled();
    expect(hashSpy).toHaveBeenCalledWith({
      password: 'orbit-maple-signal-tunnel-quartz',
      sbtAddress: predictedAddress,
    });
    const createArgs = createSpy.mock.calls[0];
    expect(createArgs[10]).toBe(`0x${'66'.repeat(32)}`);
    expect(createArgs[12]).toBe(instance.buildAutoCreate2SaltSource());
    expect(createArgs[13]).toEqual({ useConfiguredDeterministic: true, initializeGroupPasswordHash: true });
    expect(instance.state.sbtAddress.toLowerCase()).toBe(predictedAddress);
  });

  it('shows "Securing password…" on the create button while the hash is derived', async () => {
    const predictedAddress = '0x00000000000000000000000000000000000000c8';
    const instance = makeGroupPasswordInstance({
      groupPassword: 'orbit-maple-signal-tunnel-quartz',
      create2Salt: 'test/password-group',
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'test', networkChainId: 84532 }));
    jest.spyOn(contractScripts, 'predictSBTAddress').mockResolvedValue(predictedAddress);
    const labelsDuringDerivation = [];
    jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockImplementation(async () => {
      render(instance.render());
      labelsDuringDerivation.push(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_SUBMIT).textContent);
      return `0x${'77'.repeat(32)}`;
    });

    const plan = await instance.resolvePredictableDeployPlan({ tokenURI: 'ar://metadata' });

    expect(plan.finalGroupPasswordHash).toBe(`0x${'77'.repeat(32)}`);
    expect(labelsDuringDerivation).toEqual(['Securing password…']);
    expect(instance.state.groupPasswordSecuring).toBe(false);
  });

  describe('while a create is in flight', () => {
    const PASSPHRASE = 'orbit-maple-signal-tunnel-quartz';
    const PREDICTED = '0x00000000000000000000000000000000000000c9';

    const makeCreatingInstance = (stateOverrides = {}, props = {}) => {
      const instance = makeGroupPasswordInstance({ groupPassword: PASSPHRASE, ...stateOverrides }, props);
      instance.persistFormCache = jest.fn();
      instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'test', networkChainId: 84532 }));
      instance.commitPendingDocumentUrl = jest.fn(async () => false);
      instance.uploadImageToArweave = jest.fn(async () => null);
      instance.uploadTokenUriToArweave = jest.fn(async () => {
        instance.state = { ...instance.state, tokenURI: 'ar://metadata' };
        return 'ar://metadata';
      });
      jest.spyOn(contractScripts, 'predictSBTAddress').mockResolvedValue(PREDICTED);
      jest.spyOn(contractScripts, 'createSBT').mockResolvedValue({
        logs: [makeFactoryReceiptLog('SBTCreated', [PREDICTED])],
      });
      return instance;
    };

    it('locks the password and Generate new, and shows the deployed password afterwards', async () => {
      const instance = makeCreatingInstance();
      let lockedDuringCreate = null;
      const hashSpy = jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockImplementation(async () => {
        render(instance.render());
        const input = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_INPUT);
        const generate = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_GENERATE);
        lockedDuringCreate = input.disabled && generate.disabled;
        fireEvent.click(generate);
        instance.handleGenerateGroupPassword();
        return `0x${'66'.repeat(32)}`;
      });

      // Not wrapped in act(): React would defer the render inside the hash step until act() ends.
      await instance.handleMintClick();

      expect(lockedDuringCreate).toBe(true);
      expect(hashSpy).toHaveBeenCalledWith({ password: PASSPHRASE, sbtAddress: PREDICTED });
      expect(instance.state.sbtMinted).toBe(true);
      expect(instance.state.groupPassword).toBe(PASSPHRASE);
    });

    it('deploys the password captured at Create even if the field changes during the upload', async () => {
      const instance = makeCreatingInstance();
      instance.uploadImageToArweave = jest.fn(async () => {
        instance.handleInputChange({ target: { name: 'groupPassword', type: 'text', value: 'abc' } });
      });
      const hashSpy = jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockResolvedValue(`0x${'66'.repeat(32)}`);

      await act(async () => {
        await instance.handleMintClick();
      });

      expect(hashSpy).toHaveBeenCalledTimes(1);
      expect(hashSpy).toHaveBeenCalledWith({ password: PASSPHRASE, sbtAddress: PREDICTED });
      expect(contractScripts.createSBT).toHaveBeenCalledTimes(1);
      expect(instance.state.groupPassword).toBe(PASSPHRASE);
    });

    it('saves a deferred draft with the password captured at Create', async () => {
      const onSaveDraft = jest.fn().mockResolvedValue(undefined);
      const instance = makeCreatingInstance(
        { tokenURI: 'ar://metadata', create2Salt: 'test/password-group' },
        { deferredDeploy: true, onSaveDraft },
      );
      jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockImplementation(async () => {
        instance.handleInputChange({ target: { name: 'groupPassword', type: 'text', value: 'abc' } });
        return `0x${'77'.repeat(32)}`;
      });

      await act(async () => {
        await instance.handleMintClick();
      });

      expect(onSaveDraft).toHaveBeenCalledWith(
        expect.objectContaining({ groupPassword: PASSPHRASE, finalGroupPasswordHash: `0x${'77'.repeat(32)}` }),
      );
      expect(instance.state.groupPassword).toBe(PASSPHRASE);
    });
  });
});
